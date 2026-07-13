import { generateSync } from 'otplib';
import type { Page } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import { obtainTokenPair } from '../../support/api';
import { createVerifiedUser } from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { revealLoginForm } from '../../support/auth-forms';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J17.2 (USER_JOURNEYS.md) — TOTP 2FA lifecycle: enable on
// /account/security (the base32 secret is exposed behind "Can't scan?
// Enter manually" — otplib generates codes from it), then prove login now
// requires the code (the password step answers with a temp token and the
// login page swaps to the 6-digit form), then disable again.
//
// Throwaway user: 2FA on a seeded persona would lock every other worker's
// API login for that persona out (obtainTokenPair has no OTP step).
//
// TOTP codes are time-windowed, so every submit generates a FRESH code and
// retries in an outcome-keyed loop — a code minted near a 30s boundary can
// expire between generate and verify.

/** Fill the 6-digit TwoFactorInput; each box is labelled "Digit N". */
async function fillOtp(page: Page, code: string): Promise<void> {
	for (let i = 0; i < 6; i++) {
		await page.getByLabel(`Digit ${i + 1}`, { exact: true }).fill(code[i]);
	}
}

/** Generate-fill-submit with fresh codes until `success` becomes visible. */
async function submitOtpUntil(
	page: Page,
	secret: string,
	submitName: string,
	success: () => Promise<void>
): Promise<void> {
	for (let attempt = 1; ; attempt++) {
		await fillOtp(page, generateSync({ secret }));
		const submit = page.getByRole('button', { name: submitName });
		await expect(submit).toBeEnabled();
		await submit.click();
		try {
			await success();
			return;
		} catch (error) {
			if (attempt >= 4) throw error;
		}
	}
}

test.describe('J17 two-factor authentication @p2', () => {
	test('enables TOTP, login requires the code, then disables it', async ({ browser }) => {
		test.setTimeout(240_000);
		const user = await createVerifiedUser('TwoFA');
		const context = await browser.newContext();
		await authenticateContext(context, user);
		const page = await context.newPage();

		await gotoHydrated(page, '/account/security');
		await waitForClientAuth(page);
		await expect(
			page.getByRole('heading', { name: 'Two-Factor Authentication (2FA)' })
		).toBeVisible();
		await expect(page.getByText('Disabled', { exact: true })).toBeVisible();

		// Enable: the setup panel exposes the provisioning secret as text.
		await page.getByRole('button', { name: 'Enable 2FA' }).click();
		await expect(
			page.getByRole('heading', { name: 'Set up Two-Factor Authentication' })
		).toBeVisible();
		await page.getByText("Can't scan? Enter manually").click();
		const secret = (await page.locator('details code').innerText()).trim();
		expect(secret).toMatch(/^[A-Z2-7]+$/);

		await submitOtpUntil(page, secret, 'Verify and Enable 2FA', async () => {
			await expect(page.getByText('Enabled', { exact: true })).toBeVisible({ timeout: 15_000 });
		});

		// The plain password grant no longer yields a token pair…
		await expect(obtainTokenPair(user.email, user.password)).rejects.toThrow(/2FA/);

		// …and a UI login gets the second, 6-digit step. Fresh context: the
		// first one still holds a valid session.
		const loginContext = await browser.newContext();
		const loginPage = await loginContext.newPage();
		await gotoHydrated(loginPage, '/login');
		await revealLoginForm(loginPage);
		const emailInput = loginPage.getByLabel('Email address');
		const passwordInput = loginPage.getByLabel('Password', { exact: true });
		await expect(async () => {
			await emailInput.fill(user.email);
			await passwordInput.fill(user.password);
			await expect(emailInput).toHaveValue(user.email, { timeout: 2_000 });
			await expect(passwordInput).toHaveValue(user.password, { timeout: 2_000 });
		}).toPass({ timeout: 30_000 });
		await loginPage.getByRole('button', { name: 'Sign in', exact: true }).click();
		await expect(
			loginPage.getByRole('heading', { name: 'Two-factor authentication' })
		).toBeVisible();

		await submitOtpUntil(loginPage, secret, 'Verify and sign in', async () => {
			await loginPage.waitForURL(/\/dashboard(\/|$|\?)/, { timeout: 15_000 });
		});

		// Disable from the freshly logged-in session. The card's toggle button
		// unmounts once the panel opens, so the panel submit's identical name
		// stays unique.
		await gotoHydrated(loginPage, '/account/security');
		await waitForClientAuth(loginPage);
		await expect(loginPage.getByText('Enabled', { exact: true })).toBeVisible();
		await loginPage.getByRole('button', { name: 'Disable 2FA' }).click();
		await expect(
			loginPage.getByRole('heading', { name: 'Disable Two-Factor Authentication' })
		).toBeVisible();

		await submitOtpUntil(loginPage, secret, 'Disable 2FA', async () => {
			await expect(loginPage.getByText('Disabled', { exact: true })).toBeVisible({
				timeout: 15_000
			});
		});

		// Password-only login works again.
		await obtainTokenPair(user.email, user.password);

		await loginContext.close();
		await context.close();
	});
});
