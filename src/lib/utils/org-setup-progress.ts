import type { OrganizationAdminDetailSchema, Visibility } from '$lib/api/generated/types.gen';

export interface SetupCounts {
	eventCount: number | null;
	publishedCount: number | null;
	latestDraft: { id: string; name: string } | null;
}

export type StripeSetupState = 'none' | 'incomplete' | 'ready';
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

const HIDDEN_VISIBILITY: ReadonlySet<Visibility> = new Set<Visibility>(['private', 'staff-only']);

/** True when the org page is not publicly reachable (members-only/unlisted are deliberate). */
export function isPageHidden(visibility: Visibility): boolean {
	return HIDDEN_VISIBILITY.has(visibility);
}

/**
 * Derives the org onboarding checklist. `null` counts mean "unknown" and are
 * treated as zero. The org itself counts as the first completed step.
 */
export function buildSetupProgress(
	org: Pick<
		OrganizationAdminDetailSchema,
		'visibility' | 'stripe_account_id' | 'stripe_charges_enabled'
	>,
	counts: SetupCounts
): SetupProgress {
	const pageHidden = isPageHidden(org.visibility);
	const eventCount = counts.eventCount ?? 0;
	const publishedCount = counts.publishedCount ?? 0;

	const event: EventSetupState =
		publishedCount > 0 ? 'published' : eventCount > 0 ? 'draft' : 'none';
	const stripe: StripeSetupState = !org.stripe_account_id
		? 'none'
		: !org.stripe_charges_enabled
			? 'incomplete'
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
