import { test, expect } from '../../support/fixtures';
import { uniqueEmail } from '../../support/factories';
import { revealRegistrationForm } from '../../support/auth-forms';
import { gotoHydrated } from '../../support/navigation';

// J21.2 (USER_JOURNEYS.md; referral codes per 21.1) — registering with a
// referral code. The seeded code B2CREF01 (referrer.b2c@example.com) enters
// via ?ref= and auto-validates; submitting lands on the check-email page. A
// bogus code is rejected inline.
//
// Codes are matched case-INSENSITIVELY (21.1/21.2) and the frontend sends
// them as typed (ReferralCodeInput only trims), so the lowercase variant
// exercises the backend's `code__iexact` lookups end to end: GET
// /referral/validate must accept it, and POST /account/register would 422
// ("Invalid or inactive referral code") instead of reaching check-email if
// registration matched case-sensitively. The form POST is asserted to carry
// the code, so a green run can't come from the code being silently dropped.
//
// SPEC DRIFT (noted): the design's "verify via referrer payout page" isn't
// achievable — a fresh registration creates the Referral row immediately but
// no ReferralPayout (payouts only exist for periods with real payments), and
// there's no referred-users list surface. So we assert the FE-observable
// applied/rejected states and a successful submit instead.

const CODE = 'B2CREF01';
const PASSWORD = 'E2e-test-Pass!123';

test.describe('J02 referral-code registration @p2', () => {
	for (const { title, ref } of [
		{ title: 'applies a valid code from ?ref= and registers', ref: CODE },
		{
			title: 'applies a lowercase code (case-insensitive match) and registers',
			ref: CODE.toLowerCase()
		}
	]) {
		test(title, async ({ page }) => {
			await gotoHydrated(page, `/register?ref=${ref}`);
			await revealRegistrationForm(page);

			// The code auto-fills and validates on mount, and is shown as typed.
			await expect(page.getByText('Referral code applied')).toBeVisible();
			await expect(page.getByText(ref, { exact: true })).toBeVisible();

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

			const [registerPost] = await Promise.all([
				page.waitForRequest(
					(r) => r.method() === 'POST' && new URL(r.url()).pathname.startsWith('/register')
				),
				submit.click()
			]);
			// use:enhance serializes the form url-encoded.
			expect(new URLSearchParams(registerPost.postData() ?? '').get('referralCode')).toBe(ref);

			await page.waitForURL(/\/register\/check-email/);
		});
	}

	test('rejects an invalid referral code inline', async ({ page }) => {
		await gotoHydrated(page, '/register?ref=NOTAREALCODE');
		await revealRegistrationForm(page);
		await expect(page.getByText('Invalid referral code')).toBeVisible();
	});
});
