import type { TicketMembershipRecordSchema } from '$lib/api/generated/types.gen';

export type DayMemberBadgeState = 'live' | 'ended' | 'hidden';

/**
 * Visibility policy for the day-member badge, derived from the backend record
 * (never from the ticket tier: a tier can grant a day membership whose record
 * has already ended).
 *
 * - `live`: temporary, not ended, and `valid_until` is null or in the future.
 * - `ended`: temporary and ended for any reason but `revoked`, or `valid_until`
 *   already passed.
 * - `hidden`: standard / missing records (covered by the existing member badge)
 *   and revoked records.
 *
 * `now` is injected so callers and tests are deterministic.
 */
export function dayMemberBadgeState(
	record: TicketMembershipRecordSchema | null | undefined,
	now: Date = new Date()
): DayMemberBadgeState {
	if (!record || record.kind !== 'temporary') return 'hidden';
	if (record.ended_reason === 'revoked') return 'hidden';
	if (record.ended_reason) return 'ended';
	if (record.valid_until && new Date(record.valid_until).getTime() <= now.getTime()) {
		return 'ended';
	}
	return 'live';
}
