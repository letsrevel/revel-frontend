import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import {
	approveMembershipRequest,
	createOrganization,
	createSubscriptionPlan,
	createVerifiedUser,
	getUserId,
	requestMembership,
	staffCreateOfflineSubscription,
	uniqueName
} from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J23 (USER_JOURNEYS.md) — the subscription metrics header on the org admin
// Subs tab (MRR / active subscribers / new in 30 days / churn).
//
// Metrics are an aggregate, so they are only assertable against an org whose
// entire subscription population this test created. Hence a throwaway org with
// exactly ONE subscription, on an OFFLINE plan (no Stripe in the loop), priced
// €15.00/month with the initial payment recorded — the recorded payment is what
// flips the subscription PENDING → ACTIVE, and only ACTIVE subscriptions count
// toward MRR. That makes every figure on the header exact rather than
// "greater than zero": MRR €15.00, active 1, new 1 — and the status-breakdown
// strip a single "Active 1" chip.
//
// The subscribe target must already be an org member (the same constraint
// subscription-lifecycle.spec.ts documents), hence the requestMembership +
// approve arrange.

/**
 * The value line of a metric card. Layout is
 * `<CardContent><p>{label}</p><p>{value}</p></CardContent>`, and the deepest
 * div carrying the label IS that CardContent (ancestors precede descendants in
 * locator order), so the card's own two <p>s are the only ones in scope.
 */
function metricValue(page: Page, label: string): Locator {
	return page
		.locator('div')
		.filter({ has: page.getByText(label, { exact: true }) })
		.last()
		.locator('p')
		.nth(1);
}

test.describe('J23 subscription metrics @p2', () => {
	test('a single paid offline subscription yields exact MRR, active and new counts', async ({
		browser
	}) => {
		test.setTimeout(150_000);
		const [org, member] = await Promise.all([
			createOrganization({ acceptMembershipRequests: true }),
			createVerifiedUser('Metrics')
		]);
		const request = await requestMembership(member, org.slug);
		await approveMembershipRequest(org.owner, org.slug, request.id, org.defaultTierId);
		const plan = await createSubscriptionPlan(org.owner, org.slug, org.defaultTierId, {
			name: uniqueName('Plan'),
			price: '15.00',
			currency: 'EUR',
			period_unit: 'month',
			payment_method: 'offline'
		});
		await staffCreateOfflineSubscription(org.owner, org.slug, {
			planId: plan.id,
			userId: await getUserId(member),
			amount: '15.00'
		});

		const context = await browser.newContext();
		await authenticateContext(context, org.owner);
		const page = await context.newPage();
		await gotoHydrated(page, `/org/${org.slug}/admin/members`);
		await waitForClientAuth(page);
		await page.getByRole('tab', { name: /Subs/ }).click();

		// Exact strings, not substrings: '€15.00' would also match a '€15.00 / month'
		// plan line, and '1' would match any digit on the page.
		await expect(metricValue(page, 'Monthly recurring revenue')).toHaveText('€15.00', {
			timeout: 15_000
		});
		await expect(metricValue(page, 'Active subscribers')).toHaveText('1');
		await expect(metricValue(page, 'New (30 days)')).toHaveText('1');

		const subsPanel = page.getByRole('tabpanel');

		// The status-breakdown strip that completes the header (#695): the same
		// population as the four figures above it, sliced per status. Zero-count
		// statuses are not rendered, so this org's strip is exactly one chip and
		// its whole text can be pinned — `toHaveText` is a full-string match over
		// normalized whitespace, so this also asserts no second chip crept in.
		const statusStrip = subsPanel.getByRole('group', { name: 'By status' });
		await expect(statusStrip).toHaveText('Active 1');

		// The one subscription row behind those figures — a different claim from
		// the strip above, and still worth making: it pins the row-level state, not
		// the aggregate. The strip's chips are plain <span>s that never go through
		// `common/StatusBadge`, so the `status-badge` testid resolves to badges
		// only — a structural guarantee since #795, where it used to rest on the
		// chips happening to carry no aria-label.
		//
		// Scoped twice over. To the open tab panel, because the Members tab stays
		// mounted behind it and its membership rows carry an "Active" badge of
		// their own; and to VISIBLE nodes, because each subscription renders both a
		// desktop table row and a mobile card (one of which is always display:none)
		// — so an unfiltered count is 2 per subscription and layout-dependent.
		const activeBadges = subsPanel
			.getByTestId('status-badge')
			.filter({ hasText: 'Active' })
			.filter({ visible: true });
		await expect(activeBadges).toHaveCount(1);
		await expect(subsPanel.getByText(member.email).filter({ visible: true })).toHaveCount(1);

		await context.close();
	});
});
