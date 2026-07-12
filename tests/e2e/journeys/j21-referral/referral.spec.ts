import { test, expect } from '../../support/fixtures';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J21 (USER_JOURNEYS.md) — the referrer surface: a seeded B2B referrer sees
// their code on /account/referral and a PAID payout with a downloadable
// self-billing statement on /account/referral/payouts. The referrer accounts
// use password "password" (NOT the persona bootstrap password), and both
// referral routes redirect users without a referral code away — so this must
// run as an actual referrer.
//
// Payout amounts are computed from the previous month's real payments, so we
// assert the "Paid" status + a viewable statement, never an exact figure.

const REFERRER = { email: 'referrer.b2b@example.com', password: 'password' };

test.describe('J21 referral program @p2', () => {
	test('shows the referral code and a paid payout statement', async ({ browser }) => {
		const context = await browser.newContext();
		await authenticateContext(context, REFERRER);
		const page = await context.newPage();

		await gotoHydrated(page, '/account/referral');
		await waitForClientAuth(page);
		// The mobile nav drawer also has a "Referral Program" heading — scope to h1.
		await expect(page.getByRole('heading', { level: 1, name: 'Referral Program' })).toBeVisible();
		await expect(page.getByText('Your referral code')).toBeVisible();
		await expect(page.getByText('B2BREF01', { exact: true })).toBeVisible();

		await gotoHydrated(page, '/account/referral/payouts');
		await waitForClientAuth(page);
		await expect(page.getByRole('heading', { level: 1, name: 'Payout History' })).toBeVisible();
		// The seeded payout is PAID with a generated statement.
		await expect(page.getByText('Paid', { exact: true }).first()).toBeVisible();
		await page.getByRole('button', { name: 'View Statement' }).first().click();
		// The mobile nav drawer is also role=dialog — scope to the statement one.
		const dialog = page.getByRole('dialog', { name: 'Payout Statement' });
		await expect(dialog).toBeVisible();
		// B2B (VAT-registered) referrer → self-billing invoice document type.
		await expect(dialog.getByText('Self-Billing Invoice (Gutschrift)')).toBeVisible();
		await expect(dialog.getByRole('button', { name: 'Download PDF' })).toBeVisible();

		await context.close();
	});
});
