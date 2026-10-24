import type {
	EventInListSchema,
	OrganizationAdminDetailSchema
} from '$lib/api/generated/types.gen';

export const UPCOMING_LIMIT = 6;

export interface DashboardModel {
	/** Events that have not ended yet (running or future), templates excluded, by start. */
	live: EventInListSchema[];
	/** First live event that is not cancelled (drafts allowed). */
	nextEvent: EventInListSchema | null;
	isHappeningNow: boolean;
	/** Live events after `nextEvent`, capped. Cancelled ones stay (they show a badge). */
	upcoming: EventInListSchema[];
	/** Live events still in draft. */
	draftCount: number;
}

export function buildDashboardModel(events: EventInListSchema[], now: Date): DashboardModel {
	const live = events
		.filter((e) => !e.is_template && new Date(e.end) > now)
		.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
	const nextEvent = live.find((e) => e.status !== 'cancelled') ?? null;
	const isHappeningNow =
		nextEvent !== null && new Date(nextEvent.start) <= now && now < new Date(nextEvent.end);
	const upcoming = live.filter((e) => e !== nextEvent).slice(0, UPCOMING_LIMIT);
	const draftCount = live.filter((e) => e.status === 'draft').length;
	return { live, nextEvent, isHappeningNow, upcoming, draftCount };
}

type BillingFields = Pick<
	OrganizationAdminDetailSchema,
	| 'is_stripe_connected'
	| 'platform_fee_percent'
	| 'platform_fee_fixed'
	| 'vat_country_code'
	| 'billing_address'
	| 'billing_name'
>;

/**
 * True when the org takes payments with a platform fee but has not filled in the
 * billing identity the invoices need. Shared by the admin nav badge and the
 * dashboard attention list so the two cannot drift.
 */
export function billingNeedsAttention(org: BillingFields): boolean {
	return (
		!!org.is_stripe_connected &&
		(parseFloat(org.platform_fee_percent) > 0 || parseFloat(org.platform_fee_fixed) > 0) &&
		(!org.vat_country_code || !org.billing_address || !org.billing_name)
	);
}
