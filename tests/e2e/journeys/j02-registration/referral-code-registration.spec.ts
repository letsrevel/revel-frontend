import { test, expect } from '../../support/fixtures';
import { uniqueEmail } from '../../support/factories';
import { revealRegistrationForm } from '../../support/auth-forms';
import { gotoHydrated } from '../../support/navigation';

// J2.4 (USER_JOURNEYS.md) — registering with a referral code. The seeded code
// B2CREF01 (referrer.b2c@example.com) enters via ?ref= and auto-validates;
// submitting lands on the check-email page. A bogus code is rejected inline.
//
// SPEC DRIFT (noted): the design's "verify via referrer payout page" isn't
// achievable — a fresh registration creates the Referral row immediately but
// no ReferralPayout (payouts only exist for periods with real payments), and
// there's no referred-users list surface. So we assert the FE-observable
// applied/rejected states and a successful submit instead.

const CODE = 'B2CREF01';
const PASSWORD = 'E2e-test-Pass!123';

test.describe('J02 referral-code registration @p2', () => {
	test('applies a valid code from ?ref= and registers', async ({ page }) => {
		await gotoHydrated(page, `/register?ref=${CODE}`);
		await revealRegistrationForm(page);

		// The code auto-fills and validates on mount.
		await expect(page.getByText('Referral code applied')).toBeVisible();
		await expect(page.getByText(CODE, { exact: true })).toBeVisible();

		const email = uniqueEmail('Referred');
		const emailInput = page.getByLabel('Email address');
		const passwordInput = page.getByLabel('Password', { exact: true });
		const confirmInput = page.getByLabel('Confirm password');
		const terms = page.getByLabel(/I accept the/);
		const submit = page.getByRole('button', { name: 'Create your account' });
		await expect(async () => {
			await emailInput.fill(email);
			await passwordInput.fill(PASSWORD);
			await confirmInput.fill(PASSWORD);
			if (!(await terms.isChecked())) await terms.check();
			await expect(emailInput).toHaveValue(email, { timeout: 2_000 });
			await expect(submit).toBeEnabled({ timeout: 2_000 });
		}).toPass({ timeout: 45_000 });
		await submit.click();

		await page.waitForURL(/\/register\/check-email/);
	});

	test('rejects an invalid referral code inline', async ({ page }) => {
		await gotoHydrated(page, '/register?ref=NOTAREALCODE');
		await revealRegistrationForm(page);
		await expect(page.getByText('Invalid referral code')).toBeVisible();
	});
});
