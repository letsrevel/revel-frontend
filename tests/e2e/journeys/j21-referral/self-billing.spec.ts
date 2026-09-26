import { test, expect } from '../../support/fixtures';
import { ApiClient } from '../../support/api';
import { authenticateContext, type Credentials } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J21.4 / J3.7 (USER_JOURNEYS.md) — a referrer agrees to the self-billing
// (Gutschrift) terms in the payout-setup billing form on /account/referral,
// and the agreement survives a reload. Regression guard for BE #1006: the
// POST/PUT /me/billing write schemas silently dropped `self_billing_agreed`
// (it only existed on the read schema), so the checkbox "saved" with a
// success toast and came back unchecked — referrers could never complete
// payout setup.
//
// The checkbox only renders on /account/referral (BillingProfileForm's
// `showSelfBilling`), and that page bounces anyone without a referral code,
// so this has to run as an enrolled referrer — and referrers can only be
// enrolled through the Django admin, so a throwaway is not an option.
//
// Isolation: ONE seeded referrer PER PROJECT, so desktop and mobile never
// toggle the same row concurrently. Neither account's agreement state is
// read by any other spec (apply.spec only reads test.referrer's code,
// referral-code-registration only uses B2CREF01 as a code, and referral.spec's
// payout statement is pre-seeded for referrer.b2b, which is not used here).
// The arrange step resets the flag to FALSE via the API, so the UI assertion
// is never vacuous regardless of what a previous run left behind, and the
// test always leaves it TRUE (the seeded value for referrer.b2c).
// Consequence: not safe under `--repeat-each` with parallel workers on the
// same project (two copies would reset each other's row) — run repeats with
// `--workers=1`.

const REFERRER_BY_PROJECT: Record<string, Credentials> = {
	// Seeded by bootstrap_test_events; has no billing profile on a fresh seed.
	chromium: { email: 'test.referrer@example.com', password: 'password123' },
	// Seeded by bootstrap_helpers/billing.py with a complete B2C profile.
	'mobile-chrome': { email: 'referrer.b2c@example.com', password: 'password' }
};

interface BillingProfile {
	billing_name: string;
	billing_address: string;
	vat_country_code: string;
	billing_email: string;
	self_billing_agreed: boolean;
}

/**
 * Leave the referrer with a complete billing profile whose agreement is OFF.
 * PUT /me/billing is a full replace, so the existing fields are echoed back.
 */
async function resetAgreement(referrer: Credentials): Promise<void> {
	const api = await ApiClient.login(referrer.email, referrer.password);
	const existing = await api.get<BillingProfile | null>('/api/me/billing');
	if (existing) {
		await api.put('/api/me/billing', {
			billing_name: existing.billing_name,
			billing_address: existing.billing_address,
			vat_country_code: existing.vat_country_code,
			billing_email: existing.billing_email,
			self_billing_agreed: false
		});
	} else {
		await api.post('/api/me/billing', {
			billing_name: 'E2E Referrer',
			billing_address: 'Teststraße 1, 1010 Wien',
			vat_country_code: 'AT',
			self_billing_agreed: false
		});
	}
}

test.describe('J21 referral program: self-billing agreement @p1', () => {
	test('agreeing to self-billing persists across a reload', async ({ browser }) => {
		const referrer = REFERRER_BY_PROJECT[test.info().project.name];
		test.skip(!referrer, 'no dedicated referrer for this project');
		await resetAgreement(referrer);

		const context = await browser.newContext();
		try {
			await authenticateContext(context, referrer);
			const page = await context.newPage();

			await gotoHydrated(page, '/account/referral');
			await waitForClientAuth(page);
			await expect(page.getByRole('heading', { level: 1, name: 'Referral Program' })).toBeVisible();

			const form = page.getByRole('form', { name: 'Billing Information' });
			const agreement = form.getByRole('checkbox', { name: /issue invoices \(Gutschrift\)/ });
			// Profile loaded (update mode) with the agreement off — the arranged state.
			await expect(form.getByRole('button', { name: 'Update billing information' })).toBeVisible();
			await expect(form.getByLabel(/Legal Name/)).not.toHaveValue('');
			await expect(agreement).not.toBeChecked();

			await agreement.check();
			await form.getByRole('button', { name: 'Update billing information' }).click();
			await expect(page.getByText('Billing information saved').first()).toBeVisible();

			// Reload → the form re-hydrates from GET /api/me/billing.
			await page.reload();
			await page.locator('body[data-hydrated="true"]').waitFor({ state: 'attached' });
			await waitForClientAuth(page);
			await expect(form.getByLabel(/Legal Name/)).not.toHaveValue('');
			await expect(agreement).toBeChecked();
		} finally {
			await context.close();
		}
	});
});
