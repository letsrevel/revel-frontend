import { test, expect } from '../../support/fixtures';
import { gotoHydrated } from '../../support/navigation';
import { createVerifiedUser, uniqueEmail } from '../../support/factories';
import { extractLink, waitForEmail } from '../../support/mailpit';
import { uiLogin } from '../../support/session';
import { obtainTokenPair } from '../../support/api';

// J17.1 (USER_JOURNEYS.md) — password reset: request at /password-reset →
// Mailpit link → /login/reset-password → new password → login works with it
// (and only it). The request response is deliberately generic — the same
// success screen for unknown addresses, so accounts can't be enumerated.
//
// Registers a throwaway user per run: resetting a seeded persona's password
// would break every parallel worker logging in as them.

const NEW_PASSWORD = 'E2e-reset-Pass!456';

test.describe('J17 password reset @p1', () => {
	test('resets the password via the emailed link and signs in with it', async ({ page }) => {
		const user = await createVerifiedUser('PwReset');

		// Request the reset link.
		await gotoHydrated(page, '/password-reset');
		await page.getByLabel('Email address').fill(user.email);
		await page.getByRole('button', { name: 'Send reset link' }).click();
		await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();

		// Follow the emailed link (subject disambiguates from the signup
		// verification email this address already received).
		const message = await waitForEmail({ to: user.email, subject: 'Password reset request' });
		const link = extractLink(message, /reset-password\?token=/);
		await gotoHydrated(page, link);

		// Set the new password. The submit is enabled from first render (gated
		// only on isSubmitting), so re-fill until the values provably landed
		// before clicking — a fill in the hydration-settling window can be
		// swallowed by the input bindings catching up.
		const password = page.getByLabel('New password');
		const confirm = page.getByLabel('Confirm password');
		await expect(async () => {
			await password.fill(NEW_PASSWORD);
			await confirm.fill(NEW_PASSWORD);
			await expect(password).toHaveValue(NEW_PASSWORD, { timeout: 2_000 });
			await expect(confirm).toHaveValue(NEW_PASSWORD, { timeout: 2_000 });
		}).toPass({ timeout: 30_000 });
		await page.getByRole('button', { name: 'Reset password' }).click();
		await expect(page.getByRole('heading', { name: 'Password reset successful' })).toBeVisible();

		// The old password is dead…
		await expect(obtainTokenPair(user.email, user.password)).rejects.toThrow();

		// …and the new one signs in through the UI (uiLogin lands on /dashboard).
		await uiLogin(page, { email: user.email, password: NEW_PASSWORD });
	});

	test('answers an unknown email with the same generic success (no enumeration)', async ({
		page
	}) => {
		await gotoHydrated(page, '/password-reset');
		await page.getByLabel('Email address').fill(uniqueEmail('NoSuchAccount'));
		await page.getByRole('button', { name: 'Send reset link' }).click();

		// Identical outcome to the real-account path: same heading, same "if an
		// account exists" phrasing, no error.
		await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
		await expect(page.getByText('If an account exists with that email')).toBeVisible();
	});

	test('explains an invalid or missing token instead of showing the form', async ({ page }) => {
		await gotoHydrated(page, '/login/reset-password');

		await expect(page.getByText('Invalid or missing reset token').first()).toBeVisible();
		await expect(page.getByRole('link', { name: 'Request new reset link' })).toBeVisible();
		await expect(page.getByLabel('New password')).toBeHidden();
	});
});
