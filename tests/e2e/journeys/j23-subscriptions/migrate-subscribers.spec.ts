import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import {
	archiveSubscriptionPlan,
	createMembershipTier,
	createSubscriptionPlan,
	createVerifiedUser,
	getOrganizationId,
	subscribeViaApi,
	uniqueName,
	updateSubscriptionPlan
} from '../../support/factories';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J23.9 (USER_JOURNEYS.md) — "Migrate subscribers after a price change":
// existing subscribers are GRANDFATHERED on the price they signed up at until
// staff run the migration from the plan row (PlansList → RefreshCw icon →
// MigrateSubscribersDialog → POST …/plans/{id}/migrate-subscribers → 202 with
// the number queued).
//
// Note on scope: the backend migrates subscribers to the SAME plan's current
// price — there is no plan-to-plan move in the UI (plan switches are a member
// action, see manage-subscription.spec.ts).
//
// The action is only offered for ONLINE plans with at least one non-terminal
// subscriber, so the plan lives on Org Alpha (the only Stripe-connected org).
// The subscriber is a PENDING online subscription minted by subscribeViaApi —
// no hosted checkout needed: `active_subscription_count` counts every
// non-terminal row, and the migration task skips rows without a Stripe
// subscription id (nothing to modify), so no webhook is in the loop.
//
// Isolation: own uniqueName()-d tier + plan + throwaway subscriber per test;
// the plan is archived afterwards so Org Alpha's public page stays tidy.

const ORG_SLUG = 'revel-events-collective';

/** The tier card on the Tiers tab (see plans-admin.spec.ts for the rationale). */
function tierCard(page: Page, tierName: string): Locator {
	return page
		.locator('div')
		.filter({ hasText: tierName })
		.filter({ has: page.getByRole('button', { name: 'Add plan' }) })
		.last();
}

/** A plan's row: the deepest container with its name AND its action buttons. */
function planRow(page: Page, scope: Locator, planName: string): Locator {
	return scope
		.locator('div')
		.filter({ hasText: planName })
		.filter({ has: page.getByRole('button', { name: 'Delete plan' }) })
		.last();
}

test.describe('J23 migrate subscribers to the current price @p2', () => {
	test('price change → migrate from the plan row → migration queued', async ({ asOwner }) => {
		test.setTimeout(120_000);

		const tierName = uniqueName('Migrate Tier');
		const [tier, subscriber, orgId] = await Promise.all([
			createMembershipTier('owner', ORG_SLUG, tierName),
			createVerifiedUser('MigrateSub'),
			getOrganizationId(ORG_SLUG)
		]);
		const plan = await createSubscriptionPlan('owner', ORG_SLUG, tier.id, {
			name: uniqueName('Migrate Plan'),
			payment_method: 'online',
			price: '15.00',
			currency: 'EUR'
		});

		try {
			// One grandfathered subscriber at €15, then the organizer raises the
			// price to €20 — the state the migration exists for.
			await subscribeViaApi(subscriber, orgId, plan.id);
			await updateSubscriptionPlan('owner', ORG_SLUG, plan.id, { price: '20.00' });

			const page = asOwner;
			await gotoHydrated(page, `/org/${ORG_SLUG}/admin/members`);
			await waitForClientAuth(page);
			await page.getByRole('tab', { name: /Tiers/ }).click();

			const card = tierCard(page, tierName);
			const row = planRow(page, card, plan.name);
			await expect(row).toBeVisible({ timeout: 20_000 });
			await expect(row.getByText('€20.00 / month')).toBeVisible();
			await expect(row.getByText('1 active')).toBeVisible();

			await row.getByRole('button', { name: 'Migrate subscribers to current price' }).click();
			const dialog = page.getByRole('dialog', { name: 'Migrate subscribers to current price' });
			await expect(dialog).toBeVisible({ timeout: 10_000 });
			// The confirmation names the population and the target price.
			await expect(
				dialog.getByText(/queues a migration of 1 active subscribers to the current price/)
			).toBeVisible();
			await expect(dialog.getByText(/€20\.00 \/ month/)).toBeVisible();
			await expect(dialog.getByText(/No proration/)).toBeVisible();

			await dialog.getByRole('button', { name: 'Migrate', exact: true }).click();
			await expect(page.getByText('Migration queued for 1 subscribers')).toBeVisible({
				timeout: 20_000
			});
			await expect(dialog).toBeHidden();

			// Migration never cancels or detaches anyone: the subscriber is still
			// counted on the plan, which stays at its new price.
			await expect(row.getByText('1 active')).toBeVisible();
			await expect(row.getByText('€20.00 / month')).toBeVisible();
		} finally {
			await archiveSubscriptionPlan('owner', ORG_SLUG, plan.id).catch(() => undefined);
		}
	});

	test('the action is absent for plans with no subscribers', async ({ asOwner }) => {
		const tierName = uniqueName('Empty Tier');
		const tier = await createMembershipTier('owner', ORG_SLUG, tierName);
		const plan = await createSubscriptionPlan('owner', ORG_SLUG, tier.id, {
			name: uniqueName('Empty Plan'),
			payment_method: 'online'
		});

		try {
			const page = asOwner;
			await gotoHydrated(page, `/org/${ORG_SLUG}/admin/members`);
			await waitForClientAuth(page);
			await page.getByRole('tab', { name: /Tiers/ }).click();

			const row = planRow(page, tierCard(page, tierName), plan.name);
			await expect(row).toBeVisible({ timeout: 20_000 });
			await expect(row.getByText('0 active')).toBeVisible();
			// Control: the row's other actions are there, so the absence is real.
			await expect(row.getByRole('button', { name: 'Edit', exact: true })).toBeVisible();
			await expect(
				row.getByRole('button', { name: 'Migrate subscribers to current price' })
			).toHaveCount(0);
		} finally {
			await archiveSubscriptionPlan('owner', ORG_SLUG, plan.id).catch(() => undefined);
		}
	});
});
