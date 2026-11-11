import type { MembershipRecordSchema } from '$lib/api/generated/types.gen';

/** Cap well under the 2^31-1 ms setTimeout limit (about 24.8 days). */
export const MAX_REFETCH_DELAY_MS = 24 * 60 * 60 * 1000;
const GRACE_MS = 1000;

/**
 * Delay in ms until the register list should be refetched because a row that is
 * not invitable only for want of having started will have started, or `null`
 * when there is nothing upcoming. `can_invite` is computed by the backend at
 * fetch time, so a row whose `valid_from` passes while the page is open needs a
 * refetch to flip. Rows blocked for any other reason (linked, no email, ended,
 * non-standard) never become invitable by time passing and are ignored.
 */
export function nextInviteRefetchDelay(
	records: readonly MembershipRecordSchema[],
	now: number = Date.now()
): number | null {
	let nearest: number | null = null;
	for (const r of records) {
		if (r.can_invite || r.has_account || r.invite_status === 'linked') continue;
		if (!r.email || r.kind !== 'standard' || r.valid_until) continue;
		const start = Date.parse(r.valid_from);
		if (Number.isNaN(start) || start <= now) continue;
		if (nearest === null || start < nearest) nearest = start;
	}
	if (nearest === null) return null;
	return Math.min(nearest - now + GRACE_MS, MAX_REFETCH_DELAY_MS);
}

/**
 * Delay in ms until the nearest displayed row's `valid_until` passes, plus the
 * grace, or `null` when no listed row has a future end. The Current list (active
 * at an instant) keeps a row until its end, so the row would stay "Active" past
 * its end until the next refetch.
 */
export function nextExpiryRefetchDelay(
	records: readonly MembershipRecordSchema[],
	now: number = Date.now()
): number | null {
	let nearest: number | null = null;
	for (const r of records) {
		if (!r.valid_until) continue;
		const end = Date.parse(r.valid_until);
		if (Number.isNaN(end) || end <= now) continue;
		if (nearest === null || end < nearest) nearest = end;
	}
	if (nearest === null) return null;
	return Math.min(nearest - now + GRACE_MS, MAX_REFETCH_DELAY_MS);
}

/**
 * The ONE list-refetch delay: the nearer of the invite-start boundary and, while
 * the Current list is showing, the expiry boundary. `null` when neither applies.
 */
export function nextListRefetchDelay(
	records: readonly MembershipRecordSchema[],
	{ activeNow }: { activeNow: boolean },
	now: number = Date.now()
): number | null {
	const invite = nextInviteRefetchDelay(records, now);
	const expiry = activeNow ? nextExpiryRefetchDelay(records, now) : null;
	if (invite === null) return expiry;
	if (expiry === null) return invite;
	return Math.min(invite, expiry);
}
