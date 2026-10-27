import type { OrganizationAdminDetailSchema, Visibility } from '$lib/api/generated/types.gen';

export interface SetupCounts {
	eventCount: number | null;
	publishedCount: number | null;
	latestDraft: { id: string; name: string } | null;
}

export type StripeSetupState = 'none' | 'incomplete' | 'needs-billing' | 'ready';
export type EventSetupState = 'none' | 'draft' | 'published';

export interface SetupProgress {
	pageHidden: boolean;
	event: EventSetupState;
	latestDraft: { id: string; name: string } | null;
	stripe: StripeSetupState;
	doneCount: number;
	total: 5;
	allDone: boolean;
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

const HIDDEN_VISIBILITY: ReadonlySet<Visibility> = new Set<Visibility>(['private', 'staff-only']);

/** True when the org page is not publicly reachable (members-only/unlisted are deliberate). */
export function isPageHidden(visibility: Visibility): boolean {
	return HIDDEN_VISIBILITY.has(visibility);
}

/** The setup card is a launch aid: it retires once the first event is published. */
export function shouldShowSetupCard(progress: SetupProgress): boolean {
	return progress.event !== 'published';
}

/**
 * Derives the org onboarding checklist. `null` counts mean "unknown" and are
 * treated as zero. The org itself counts as the first completed step.
 */
export function buildSetupProgress(
	org: Pick<
		OrganizationAdminDetailSchema,
		'visibility' | 'stripe_account_id' | 'stripe_charges_enabled'
	> &
		BillingFields,
	counts: SetupCounts
): SetupProgress {
	const pageHidden = isPageHidden(org.visibility);
	const eventCount = counts.eventCount ?? 0;
	const publishedCount = counts.publishedCount ?? 0;

	// A 'draft' with no reviewable draft (cancelled-only org, or the draft lookup
	// failed) can't be continued, so it is presented as 'none'.
	const event: EventSetupState =
		publishedCount > 0
			? 'published'
			: eventCount > 0 && counts.latestDraft !== null
				? 'draft'
				: 'none';
	const stripe: StripeSetupState = !org.stripe_account_id
		? 'none'
		: !org.stripe_charges_enabled
			? 'incomplete'
			: billingNeedsAttention(org)
				? 'needs-billing'
				: 'ready';

	const doneCount =
		1 +
		(pageHidden ? 0 : 1) +
		(event !== 'none' ? 1 : 0) +
		(event === 'published' ? 1 : 0) +
		(stripe === 'ready' ? 1 : 0);

	return {
		pageHidden,
		event,
		latestDraft: counts.latestDraft,
		stripe,
		doneCount,
		total: 5,
		allDone: doneCount === 5
	};
}
