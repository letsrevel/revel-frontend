import type { CheckInMembershipSchema } from '$lib/api/generated/types.gen';
import * as m from '$lib/paraglide/messages.js';
import { formatDateTime } from '$lib/utils/date';

/** A membership standing ready to hand to {@link ScanCallout}. */
export interface ScanMembershipCallout {
	title: string;
	/** Markdown (tier names are escaped, so they render literally). */
	body: string;
}

/** Tier names are organizer-typed: keep `*`, `_`, `[` ... literal inside the callout's markdown. */
function escapeMarkdown(text: string): string {
	return text.replace(/([\\`*_{}[\]()#+\-.!|<>~&])/g, '\\$1');
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
		return { title, body: `${head} ${m['scanMembership.dayNoBenefits']()}` };
	}
	return {
		title,
		body: m['scanMembership.standard']({ tier: escapeMarkdown(membership.tier_name) })
	};
}
