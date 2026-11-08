import type { CheckInMembershipSchema } from '$lib/api/generated/types.gen';
import * as m from '$lib/paraglide/messages.js';
import { formatDateTime } from '$lib/utils/date';

/** A membership standing ready to hand to {@link ScanCallout}. */
export interface ScanMembershipCallout {
	title: string;
	/** Plain text (organizer-typed tier names must render literally): pass with `plain` to {@link ScanCallout}. */
	body: string;
	/** Always true: the body is not markdown. */
	plain: true;
}

/**
 * The membership block of a check-in / member-card scan response, as callout copy.
 *
 * - `temporary` (a day membership): "Day member, valid until {date}". It is a
 *   register entry for this event only, so the copy says it grants no member
 *   benefits rather than letting staff assume a member's privileges.
 * - `standard`: "Member: {tier}" (a standard record wins over a day record,
 *   server-side).
 * - `null`/absent: nothing.
 *
 * Visible to app tokens as well (not private data), unlike the staff note.
 */
export function membershipCalloutFrom(
	membership: CheckInMembershipSchema | null | undefined
): ScanMembershipCallout | null {
	if (!membership) return null;
	const title = m['scanMembership.title']();
	if (membership.kind === 'temporary') {
		const head = membership.valid_until
			? m['scanMembership.day']({ date: formatDateTime(membership.valid_until) })
			: m['scanMembership.dayNoEnd']();
		return { title, body: `${head} ${m['scanMembership.dayNoBenefits']()}`, plain: true };
	}
	return {
		title,
		body: m['scanMembership.standard']({ tier: membership.tier_name }),
		plain: true
	};
}
