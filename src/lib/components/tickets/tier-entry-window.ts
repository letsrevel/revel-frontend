import { formatEventDateRange } from '$lib/utils/date';

/** The slice of the public `TicketTierSchema` that describes its check-in window. */
export interface TierCheckInWindowFields {
	check_in_opens_offset?: string | null;
	check_in_closes_offset?: string | null;
	effective_check_in_opens_at?: string | null;
	effective_check_in_closes_at?: string | null;
}

/**
 * The tier's own entry window as display text (#945), or `null` when the tier
 * just follows the event's check-in window (both offsets unset) or the backend
 * sent no resolved times.
 *
 * Always renders the backend-resolved `effective_check_in_*` instants, never a
 * client-side `start + offset`: the backend applies offsets in the event's
 * wall-clock time, which naive browser arithmetic gets wrong on DST weekends.
 */
export function tierEntryWindow(
	tier: TierCheckInWindowFields | null | undefined,
	timeZone?: string | null
): string | null {
	if (!tier) return null;
	if (tier.check_in_opens_offset == null && tier.check_in_closes_offset == null) return null;
	const opens = tier.effective_check_in_opens_at;
	const closes = tier.effective_check_in_closes_at;
	if (!opens || !closes) return null;
	return formatEventDateRange(opens, closes, timeZone ?? undefined);
}
