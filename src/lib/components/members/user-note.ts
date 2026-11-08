import {
	organizationadminusernotesGetNote,
	organizationadminusernotesUpsertNote,
	organizationadminusernotesDeleteNote
} from '$lib/api/generated/sdk.gen';
import type { UserNoteSchema } from '$lib/api/generated/types.gen';

/**
 * Private organizer notes (BE #1314 / FE #1165).
 *
 * The note is keyed on (organization, user), so it also exists for attendees who
 * are not members and survives a member's removal. Only staff with
 * `manage_members` may read or write it; scanners get a read-only copy on the
 * check-in / verify payloads.
 */

/** Server-enforced cap, in characters of unescaped text. */
export const NOTE_MAX_LENGTH = 5000;
/** The counter starts being announced to assistive tech from this fill ratio. */
const NEAR_LIMIT_RATIO = 0.9;

export type NoteCounterState = 'ok' | 'near' | 'over';

export interface NoteCounter {
	count: number;
	remaining: number;
	over: number;
	state: NoteCounterState;
}

const BASIC_ENTITIES: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	nbsp: '\u00a0'
};

/** Minimal entity decoder, used only where there is no DOM (SSR). */
function decodeBasicEntities(text: string): string {
	return text.replace(
		/&(?:#(\d+)|#[xX]([0-9a-fA-F]+)|([a-zA-Z]+));/g,
		(match: string, dec?: string, hex?: string, name?: string) => {
			const code = dec ? Number(dec) : hex ? parseInt(hex, 16) : null;
			if (code !== null) {
				return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
			}
			return (name && BASIC_ENTITIES[name]) || match;
		}
	);
}

/**
 * Equivalent of the server's `html.unescape`. A textarea parses its content as
 * RCDATA (entities decoded, nothing executed), so it knows every HTML5 entity.
 */
export function unescapeHtml(text: string): string {
	if (typeof document === 'undefined') return decodeBasicEntities(text);
	const el = document.createElement('textarea');
	el.innerHTML = text;
	return el.value;
}

/**
 * The text the server measures against the cap: `len(html.unescape(body.strip()))`
 * (user_note_service.upsert_note). Counted in code points, like Python's `len`.
 */
export function noteLength(body: string): number {
	return Array.from(unescapeHtml(body.trim())).length;
}

/**
 * Counter figures for the editor. `state` drives the aria-live announcement:
 * silent while `ok`, so a screen reader is not read a number on every keystroke.
 */
export function noteCounter(body: string, max: number = NOTE_MAX_LENGTH): NoteCounter {
	const count = noteLength(body);
	const remaining = Math.max(0, max - count);
	const over = Math.max(0, count - max);
	const state: NoteCounterState =
		count > max ? 'over' : count >= max * NEAR_LIMIT_RATIO ? 'near' : 'ok';
	return { count, remaining, over, state };
}

/** Query key for one person's note inside one organization. */
export function userNoteKey(slug: string, userId: string): readonly unknown[] {
	return ['organization', slug, 'user-note', userId];
}

/** Prefix of every members-list query, used to refresh the `private_note` indicator. */
export function membersListKey(slug: string): readonly unknown[] {
	return ['organization', slug, 'members'];
}

function authHeaders(accessToken: string | null | undefined): { Authorization: string } {
	return { Authorization: `Bearer ${accessToken}` };
}

/**
 * Fetch the note. A 404 means "no note yet" and maps to `null`; every other
 * failure throws the response error (the generated client resolves on HTTP
 * errors instead of rejecting).
 */
export async function fetchUserNote(
	slug: string,
	userId: string,
	accessToken: string | null | undefined
): Promise<UserNoteSchema | null> {
	const res = await organizationadminusernotesGetNote({
		path: { slug, user_id: userId },
		headers: authHeaders(accessToken)
	});
	if (res.response?.status === 404) return null;
	if (res.error) throw res.error;
	return res.data ?? null;
}

export async function saveUserNote(
	slug: string,
	userId: string,
	body: string,
	accessToken: string | null | undefined
): Promise<UserNoteSchema> {
	const res = await organizationadminusernotesUpsertNote({
		path: { slug, user_id: userId },
		body: { body },
		headers: authHeaders(accessToken)
	});
	if (res.error) throw res.error;
	if (!res.data) throw new Error('Empty response');
	return res.data;
}

export async function deleteUserNote(
	slug: string,
	userId: string,
	accessToken: string | null | undefined
): Promise<void> {
	const res = await organizationadminusernotesDeleteNote({
		path: { slug, user_id: userId },
		headers: authHeaders(accessToken)
	});
	// Deleting a note that is already gone is the outcome the user asked for.
	if (res.response?.status === 404) return;
	if (res.error) throw res.error;
}
