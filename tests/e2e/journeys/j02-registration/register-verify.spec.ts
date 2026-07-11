import type { Page } from '@playwright/test';
import { test, expect, PERSONAS } from '../../support/fixtures';
import { gotoHydrated } from '../../support/navigation';
import { uniqueEmail } from '../../support/factories';
import { extractLink, waitForEmail } from '../../support/mailpit';
import { revealRegistrationForm } from '../../support/auth-forms';

// J2.1 (USER_JOURNEYS.md) — email registration: form → check-email page →
// Mailpit verification link → verified. Unhappy paths: weak password,
// already-registered email. Each run registers a unique throwaway address.
//
// On DEMO_MODE backends the form is gated behind a nudge overlay (#600);
// revealRegistrationForm dismisses it and is a no-op on non-demo backends.

const STRONG_PASSWORD = 'E2e-test-Pass!123';

async function fillRegistrationForm(page: Page, email: string, password: string): Promise<void> {
	await gotoHydrated(page, '/register');
	await revealRegistrationForm(page);
	await page.getByLabel('Email address').fill(email);
	await page.getByLabel('Password', { exact: true }).fill(password);
	await page.getByLabel('Confirm password').fill(password);
	await page.getByLabel(/I accept the/).check();
}

test.describe('J2 registration & email verification @p0', () => {
	test('registers, receives the verification email, and verifies', async ({ page }) => {
		const email = uniqueEmail('Register');

		await fillRegistrationForm(page, email, STRONG_PASSWORD);
		await page.getByRole('button', { name: 'Create your account' }).click();

		// Check-email interstitial.
		await page.waitForURL(/\/register\/check-email/);
		await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();

		// The verification email arrives (inline Celery → immediate).
		const message = await waitForEmail({ to: email });
		const link = extractLink(message, /token=/);

		// Following the link verifies the account and lands authenticated.
		await page.goto(link);
		await page.waitForURL(/\/account\/profile/);

		// The session is live: the profile page shows the verified address. Assert
		// the (disabled) Email field's value rather than a bare text match — the
		// only full-email *text* node is the always-in-DOM mobile user menu, which
		// is display:none on desktop, so getByText().first() would hit it.
		await expect(page.getByRole('textbox', { name: 'Email' })).toHaveValue(email);
	});

	test('rejects a weak password inline', async ({ page }) => {
		await fillRegistrationForm(page, uniqueEmail('WeakPw'), 'weak');

		// Client-side validation blocks submission with an accessible error.
		const submit = page.getByRole('button', { name: 'Create your account' });
		if (await submit.isEnabled()) {
			await submit.click();
		}
		await expect(page.getByText(/at least|too short|8 characters|stronger/i).first()).toBeVisible();
		expect(new URL(page.url()).pathname).toBe('/register');
	});

	test('rejects an already-registered email', async ({ page }) => {
		await fillRegistrationForm(page, PERSONAS.user.email, STRONG_PASSWORD);
		await page.getByRole('button', { name: 'Create your account' }).click();

		// Stays on /register with an error surfaced (no check-email redirect).
		await expect(page.getByRole('alert').filter({ hasNotText: 'Demo Mode' }).first()).toBeVisible();
		expect(new URL(page.url()).pathname).toBe('/register');
	});
});
