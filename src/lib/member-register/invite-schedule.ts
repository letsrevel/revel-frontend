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
