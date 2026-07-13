import { test, expect } from '../../support/fixtures';
import { createOrganization, createMembershipTier, uniqueName } from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J23 (USER_JOURNEYS.md) — subscription plans admin: plans are created PER
// MEMBERSHIP TIER from the Tiers tab (each tier card embeds its own plans
// list), archived in place, and deleted when unused (native confirm()).
//
// The design doc's "org policy fields" (membership_grace_period_days /
// membership_refund_policy) are edited on the org admin Settings page, not here
// — see org-policy.spec.ts (delivered with FE #631 / BE #695).
//
// Runs in a throwaway org so tier/plan state never collides across
// parallel projects or re-runs.

/**
 * The deepest container holding both the tier's name and its "Add plan"
 * button is the tier card (ancestors precede descendants in locator order).
 */
function tierCard(page: import('@playwright/test').Page, tierName: string) {
	return page
		.locator('div')
		.filter({ hasText: tierName })
		.filter({ has: page.getByRole('button', { name: 'Add plan' }) })
		.last();
}

/**
 * A plan's row inside a tier card: the deepest container with the plan's
 * name AND its action buttons (filtering on text alone would resolve to the
 * name/price column, which excludes the buttons).
 */
function planRow(
	page: import('@playwright/test').Page,
	scope: ReturnType<typeof tierCard>,
	planName: string
) {
	return scope
		.locator('div')
		.filter({ hasText: planName })
		.filter({ has: page.getByRole('button', { name: 'Delete plan' }) })
		.last();
}

test.describe('J23 subscription plans admin @p2', () => {
	test('create a plan per tier → archive → delete unused', async ({ browser }) => {
		const org = await createOrganization();
		const secondTierName = uniqueName('Tier');
		await createMembershipTier(org.owner, org.slug, secondTierName);

		const context = await browser.newContext();
		await authenticateContext(context, org.owner);
		const page = await context.newPage();
		await gotoHydrated(page, `/org/${org.slug}/admin/members`);
		await waitForClientAuth(page);
		await page.getByRole('tab', { name: /Tiers/ }).click();

		const generalCard = tierCard(page, 'General membership');
		const secondCard = tierCard(page, secondTierName);
		await expect(generalCard.getByText('No plans yet.')).toBeVisible({ timeout: 15_000 });

		// Monthly plan on the default tier.
		const monthlyPlan = uniqueName('Monthly');
		await generalCard.getByRole('button', { name: 'Add plan' }).click();
		const dialog = page.getByRole('dialog', { name: 'Create plan' });
		await dialog.locator('#plan-name').fill(monthlyPlan);
		await dialog.locator('#plan-price').fill('15');
		await dialog.getByRole('button', { name: 'Create plan' }).click();
		await expect(dialog).toBeHidden({ timeout: 15_000 });
		await expect(generalCard.getByText(monthlyPlan)).toBeVisible({ timeout: 15_000 });
		await expect(generalCard.getByText('€15.00 / month')).toBeVisible();

		// Yearly plan on the second tier — plans really are per tier.
		const yearlyPlan = uniqueName('Yearly');
		await secondCard.getByRole('button', { name: 'Add plan' }).click();
		await dialog.locator('#plan-name').fill(yearlyPlan);
		await dialog.locator('#plan-price').fill('100');
		await dialog.locator('#plan-period-unit').selectOption('year');
		await dialog.getByRole('button', { name: 'Create plan' }).click();
		await expect(dialog).toBeHidden({ timeout: 15_000 });
		await expect(secondCard.getByText(yearlyPlan)).toBeVisible({ timeout: 15_000 });
		await expect(secondCard.getByText('€100.00 / year')).toBeVisible();
		await expect(generalCard.getByText(yearlyPlan)).toBeHidden();

		// Archive the monthly plan in place (no confirm dialog).
		await planRow(page, generalCard, monthlyPlan).getByRole('button', { name: 'Archive' }).click();
		await expect(generalCard.getByText('Archived')).toBeVisible({ timeout: 15_000 });

		// Delete the unused yearly plan (native confirm()).
		page.once('dialog', (d) => void d.accept());
		await planRow(page, secondCard, yearlyPlan)
			.getByRole('button', { name: 'Delete plan' })
			.click();
		await expect(secondCard.getByText(yearlyPlan)).toBeHidden({ timeout: 15_000 });
		await expect(secondCard.getByText('No plans yet.')).toBeVisible();

		await context.close();
	});
});
