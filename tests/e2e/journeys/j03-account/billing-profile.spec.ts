import { test, expect } from '../../support/fixtures';
import { createVerifiedUser } from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J3.x (USER_JOURNEYS.md) — buyer billing profile on /account/settings:
// create the profile through the "Billing Information" card, verify it
// persists across a reload (the save button flips to "Update billing
// information" and the VAT ID section appears once a profile exists).
//
// SPEC DRIFT, deliberate scope cut: the self-billing agreement checkbox is
// behind BillingProfileForm's `showSelfBilling` prop, which only the
// /account/referral page sets — and that page redirects any user without a
// referral code to /dashboard, so a throwaway can never reach it. It's not
// reachable from settings, so this spec covers the settings billing fields
// only; self-billing is exercised by the referrer-authenticated j21 suite.

test.describe('J03 billing profile @p2', () => {
	test('creates the billing profile and it persists', async ({ browser }) => {
		const user = await createVerifiedUser('Billing');
		const context = await browser.newContext();
		await authenticateContext(context, user);
		const page = await context.newPage();

		await gotoHydrated(page, '/account/settings');
		await waitForClientAuth(page);
		await expect(page.getByRole('heading', { name: 'Billing Information' })).toBeVisible();

		await page.getByLabel(/Legal Name/).fill('E2E Billing GmbH');
		await page.getByLabel(/Billing Address/).fill('Teststraße 1, 1010 Wien');
		await page.getByLabel(/^Country/).fill('at');
		// The country input auto-uppercases.
		await expect(page.getByLabel(/^Country/)).toHaveValue('AT');
		await page.getByLabel(/Billing Email/).fill(user.email);

		await page.getByRole('button', { name: 'Save billing information' }).click();
		await expect(page.getByText('Billing information saved').first()).toBeVisible();

		// Reload → fields hydrate from GET /api/me/billing; the form is now in
		// update mode and the VAT ID section renders.
		await gotoHydrated(page, '/account/settings');
		await waitForClientAuth(page);
		await expect(page.getByLabel(/Legal Name/)).toHaveValue('E2E Billing GmbH');
		await expect(page.getByLabel(/Billing Address/)).toHaveValue('Teststraße 1, 1010 Wien');
		await expect(page.getByLabel(/^Country/)).toHaveValue('AT');
		await expect(page.getByRole('button', { name: 'Update billing information' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'VAT ID' })).toBeVisible();

		await context.close();
	});
});
