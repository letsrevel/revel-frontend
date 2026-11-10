import type { MembershipRecordSchema, OrgUserLookupSchema } from '$lib/api/generated/types.gen';
import { getRecord, listPersonPeriods, lookupAccount } from './api';
import { pickCurrentEntry } from './person-target';

/**
 * What an account lookup means for the admin:
 * - `pending-application`: the person already asked to join; review that instead.
 * - `has-membership`: a membership row exists in ANY state (the add endpoint
 *   refuses all of them); managing it is the person sheet's job.
 * - `addable`: a verified account with no membership, ready to be added.
 */
export type LookupKind = 'pending-application' | 'has-membership' | 'addable';

export function classifyLookup(user: OrgUserLookupSchema): LookupKind {
	if (user.pending_request_id) return 'pending-application';
	if (user.membership_status != null || user.is_member) return 'has-membership';
	return 'addable';
}

/** The name to show: the account's, or the email the admin typed when it has none. */
export function lookupDisplayName(user: OrgUserLookupSchema, typedEmail: string): string {
	return user.display_name.trim() || typedEmail.trim();
}

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Client-side check for an empty or obviously malformed value only; the server decides the rest. */
export function validateLookupEmail(raw: string): 'required' | 'invalid' | null {
	const email = raw.trim();
	if (!email) return 'required';
	return EMAIL_SHAPE.test(email) ? null : 'invalid';
}

export interface SeedDeps {
	getRecord: (recordId: string) => Promise<MembershipRecordSchema>;
	listPeriods: (userId: string) => Promise<readonly MembershipRecordSchema[]>;
}

/**
 * The register entry the person sheet opens on. The lookup's own
 * `register_record_id` wins; a vanished record (404) or none at all falls back
 * to the person's periods (current entry, else the latest). Null when the
 * person has no register entry at all.
 */
export async function resolveSeed(
	user: OrgUserLookupSchema,
	deps: SeedDeps
): Promise<MembershipRecordSchema | null> {
	if (user.register_record_id) {
		try {
			return await deps.getRecord(user.register_record_id);
		} catch (error) {
			const status = (error as { status?: unknown }).status;
			if (status !== 404) throw error;
		}
	}
	return pickCurrentEntry(await deps.listPeriods(user.user_id), 'standard');
}

export function seedDeps(slug: string, accessToken: string | null | undefined): SeedDeps {
	return {
		getRecord: (id) => getRecord(slug, accessToken, id),
		listPeriods: async (userId) =>
			(await listPersonPeriods(slug, accessToken, userId)).results ?? []
	};
}

export type AccountLookupOutcome =
	| { kind: 'not-found' }
	| { kind: 'found'; user: OrgUserLookupSchema; seed: MembershipRecordSchema | null };

/** Look the email up; for someone who already has a membership, also resolve their sheet seed. */
export async function lookupWithSeed(
	slug: string,
	accessToken: string | null | undefined,
	email: string
): Promise<AccountLookupOutcome> {
	const user = await lookupAccount(slug, accessToken, email.trim());
	if (!user) return { kind: 'not-found' };
	const seed =
		classifyLookup(user) === 'has-membership'
			? await resolveSeed(user, seedDeps(slug, accessToken))
			: null;
	return { kind: 'found', user, seed };
}
