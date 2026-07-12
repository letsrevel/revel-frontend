import { test, expect } from '../../support/fixtures';
import { uniqueEmail } from '../../support/factories';
import { RegisterPage } from '../../support/pages/register';

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
		const registerPage = new RegisterPage(page);
		await registerPage.goto(CODE);

		// The code auto-fills and validates on mount.
		await registerPage.confirmReferralCode(CODE);

		const email = uniqueEmail('Referred');
		await expect(async () => {
			await registerPage.fillForm(email, PASSWORD);
			await expect(registerPage.emailInput).toHaveValue(email, { timeout: 2_000 });
			await registerPage.expectSubmitEnabled();
		}).toPass({ timeout: 45_000 });
		await registerPage.submit();

		await page.waitForURL(/\/register\/check-email/);
	});

	test('rejects an invalid referral code inline', async ({ page }) => {
		const registerPage = new RegisterPage(page);
		await registerPage.goto('NOTAREALCODE');
		await expect(page.getByText('Invalid referral code')).toBeVisible();
	});
});
