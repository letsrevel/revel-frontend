/**
 * Helpers for the event schedule editor.
 *
 * The backend stores each session as `offset_minutes` relative to the event
 * start (so a schedule survives event duplication/recurrence verbatim). The
 * editor, however, works in absolute wall-clock times — `datetime-local`
 * strings in the viewer's timezone, consistent with the rest of EventEditor.
 * These helpers translate between the two representations, anchored to the
 * event start. Both seeding and encoding use the SAME anchor so a round-trip
 * reproduces the original offsets.
 */
import type { EventScheduleSession } from '$lib/api/generated/types.gen';
import { toDateTimeLocal } from '$lib/utils/datetime';

export interface ScheduleRow {
	/** Stable key for `{#each}` — local to the session, never persisted. */
	id: number;
	title: string;
	/** `datetime-local` string in the viewer's timezone. */
	startLocal: string;
	durationMinutes: number | null;
	location: string;
	description: string;
	isRequired: boolean;
}

let counter = 0;

/** Monotonic local id for keying editor rows (uniqueness within a session). */
export function nextRowId(): number {
	return counter++;
}

/**
 * Seed editor rows from saved sessions, projecting each offset back to an
 * absolute `datetime-local` against `anchorLocal` (the event start).
 */
export function sessionsToRows(
	sessions: EventScheduleSession[],
	anchorLocal: string
): ScheduleRow[] {
	const anchorMs = new Date(anchorLocal).getTime();
	return [...sessions]
		.sort((a, b) => a.offset_minutes - b.offset_minutes)
		.map((s) => ({
			id: nextRowId(),
			title: s.title,
			startLocal: Number.isNaN(anchorMs)
				? ''
				: toDateTimeLocal(new Date(anchorMs + s.offset_minutes * 60_000).toISOString()),
			durationMinutes: s.duration_minutes ?? null,
			location: s.location ?? '',
			description: s.description ?? '',
			isRequired: s.is_required ?? false
		}));
}

/**
 * A row is `complete` (persisted) when it has a title and a start; `blank`
 * (ignored) when fully empty; otherwise `invalid` (blocks save).
 */
export function rowCompleteness(row: ScheduleRow): 'complete' | 'blank' | 'invalid' {
	const hasTitle = !!row.title.trim();
	const hasStart = !!row.startLocal;
	if (hasTitle && hasStart) return 'complete';
	const isBlank =
		!hasTitle &&
		!hasStart &&
		!row.location.trim() &&
		!row.description.trim() &&
		row.durationMinutes == null &&
		!row.isRequired;
	return isBlank ? 'blank' : 'invalid';
}

/** Offset of a row from the anchor, clamped to ≥0 (backend rejects negatives). */
export function offsetMinutes(row: ScheduleRow, anchorLocal: string): number {
	return Math.max(
		0,
		Math.round((new Date(row.startLocal).getTime() - new Date(anchorLocal).getTime()) / 60_000)
	);
}

/** True when a row's start falls before the event start (it gets pinned to 0). */
export function startsBeforeAnchor(row: ScheduleRow, anchorLocal: string): boolean {
	return !!row.startLocal && new Date(row.startLocal).getTime() < new Date(anchorLocal).getTime();
}

/** Encode complete rows into the offset-based payload, ordered by start. */
export function rowsToSessions(rows: ScheduleRow[], anchorLocal: string): EventScheduleSession[] {
	return rows
		.filter((r) => rowCompleteness(r) === 'complete')
		.map((r) => ({
			title: r.title.trim(),
			description: r.description.trim() || null,
			offset_minutes: offsetMinutes(r, anchorLocal),
			duration_minutes: r.durationMinutes ?? null,
			location: r.location.trim() || null,
			is_required: r.isRequired
		}))
		.sort((a, b) => a.offset_minutes - b.offset_minutes);
}

/** No half-filled rows. */
export function scheduleRowsValid(rows: ScheduleRow[]): boolean {
	return rows.every((r) => rowCompleteness(r) !== 'invalid');
}

/** A fresh, empty row starting at the event start. */
export function emptyRow(startLocal: string): ScheduleRow {
	return {
		id: nextRowId(),
		title: '',
		startLocal,
		durationMinutes: null,
		location: '',
		description: '',
		isRequired: false
	};
}
