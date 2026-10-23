import type { Page } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import { createVerifiedUser, uniqueEmail } from '../../support/factories';
import { fillRegistrationForm } from '../../support/auth-forms';
import { gotoHydrated } from '../../support/navigation';
import { extractLink, listEmailIds, waitForEmail } from '../../support/mailpit';
import { uiLogin } from '../../support/session';
import {
	FRONTEND_ORIGIN,
	TENANT_HOST,
	TENANT_ORIGIN,
	tenantPage,
	tenantUnavailableReason
} from '../../support/tenant';

// Custom domains (#1070) — account-email flows started on a tenant host. The
// email link carries an account-level token, so it ALWAYS points at the platform
// (never the custom domain); the backend only appends `return_host=<host>` and
// the frontend then offers a token-free way back to `<tenant>/login`. A forged
// or unknown `return_host` must be ignored (no open redirect).
//
// Each test uses a throwaway user (createVerifiedUser): resetting a seeded
// persona's password would break every parallel worker. `uniqueEmail` is right
// here, nothing is suppressed, so no `isolatedEmail` is needed.

const NEW_PASSWORD = 'E2e-return-Pass!456';
const RESET_SUBJECT = 'Password reset request';

/** Submit the reset-request form at `${origin}/password-reset` and return the emailed link. */
async function requestResetLink(page: Page, origin: string, email: string): Promise<URL> {
	const seen = await listEmailIds({ to: email });
	await gotoHydrated(page, `${origin}/password-reset`);
	await page.getByLabel('Email address').fill(email);
	await page.getByRole('button', { name: 'Send reset link' }).click();
	await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
	const message = await waitForEmail({ to: email, subject: RESET_SUBJECT, excludeIds: seen });
	return new URL(extractLink(message, /reset-password\?token=/));
}

/** Open a reset link, set the new password, wait for the success screen. */
async function completeReset(page: Page, link: URL, password: string): Promise<void> {
	await gotoHydrated(page, link.toString());
	const field = page.getByLabel('New password');
	const confirm = page.getByLabel('Confirm password');
	await expect(async () => {
		await field.fill(password);
		await confirm.fill(password);
		await expect(field).toHaveValue(password, { timeout: 2_000 });
		await expect(confirm).toHaveValue(password, { timeout: 2_000 });
	}).toPass({ timeout: 30_000 });
	await page.getByRole('button', { name: 'Reset password' }).click();
	await expect(page.getByRole('heading', { name: 'Password reset successful' })).toBeVisible();
}

test.describe('J30 account emails return to the custom domain @p1', () => {
	// eslint-disable-next-line no-empty-pattern
	test.beforeEach(async ({}, testInfo) => {
		const reason = await tenantUnavailableReason(TENANT_HOST, { needsTenantMode: true });
		testInfo.skip(reason !== null, reason ?? '');
	});

	test('password reset started on the tenant host links via the platform and returns to the tenant login', async ({
		browser
	}) => {
		const user = await createVerifiedUser('TenantReset');
		const page = await tenantPage(browser, TENANT_ORIGIN);

		const link = await requestResetLink(page, TENANT_ORIGIN, user.email);
		// The token link stays on the platform, never the custom domain...
		expect(link.host).toBe(new URL(FRONTEND_ORIGIN).host);
		// ...and remembers where the user came from.
		expect(link.searchParams.get('return_host')).toBe(TENANT_HOST);
		expect(link.searchParams.get('token')).toBeTruthy();

		await completeReset(page, link, NEW_PASSWORD);

		// Token-free, query-free way back to the tenant's login.
		const back = page.getByRole('link', { name: /^Continue to / });
		await expect(back).toBeVisible();
		await expect(back).toHaveAttribute('href', `${TENANT_ORIGIN}/login`);
		await expect(page.getByRole('link', { name: 'Sign in to your account' })).toHaveCount(0);

		// Following it works, and the new password signs in on the tenant host.
		await back.click();
		await page.waitForURL(`${TENANT_ORIGIN}/login`);
		await uiLogin(
			page,
			{ email: user.email, password: NEW_PASSWORD },
			{ startAt: `${TENANT_ORIGIN}/login` }
		);
		expect(new URL(page.url()).host).toBe(new URL(TENANT_ORIGIN).host);

		await page.context().close();
	});

	test('the same request started on the platform has no return_host and shows the normal sign-in CTA', async ({
		page
	}) => {
		const user = await createVerifiedUser('PlatformReset');

		const link = await requestResetLink(page, FRONTEND_ORIGIN, user.email);
		expect(link.host).toBe(new URL(FRONTEND_ORIGIN).host);
		expect(link.searchParams.has('return_host')).toBe(false);

		await completeReset(page, link, NEW_PASSWORD);
		await expect(page.getByRole('link', { name: 'Sign in to your account' })).toBeVisible();
		await expect(page.getByRole('link', { name: /^Continue to / })).toHaveCount(0);
	});

	test('a forged return_host is ignored (unknown host, platform host)', async ({ page }) => {
		const user = await createVerifiedUser('ForgedReturn');

		for (const [index, forged] of ['evil.example.com', 'localhost'].entries()) {
			// A fresh, real token per attempt (reset tokens are single-use).
			const link = await requestResetLink(page, FRONTEND_ORIGIN, user.email);
			link.searchParams.set('return_host', forged);

			await completeReset(page, link, `${NEW_PASSWORD}${index}`);

			// Validation rejects it: today's behaviour, no link off the platform.
			await expect(
				page.getByRole('link', { name: /^Continue to / }),
				`return_host=${forged}`
			).toHaveCount(0);
			await expect(page.getByRole('link', { name: 'Sign in to your account' })).toBeVisible();
			await expect(page.locator('a[href*="evil.example.com"]')).toHaveCount(0);
		}
	});

	test('registering on the tenant host verifies on the platform, then offers the way back', async ({
		browser
	}) => {
		const email = uniqueEmail('TenantRegister');
		const page = await tenantPage(browser, TENANT_ORIGIN);

		// fillRegistrationForm dismisses the demo-mode nudge when there is one.
		await fillRegistrationForm(page, email, NEW_PASSWORD, {
			startAt: `${TENANT_ORIGIN}/register`
		});
		await page.getByRole('button', { name: 'Create your account' }).click();
		await page.waitForURL(/\/register\/check-email/);

		const message = await waitForEmail({ to: email });
		const link = new URL(extractLink(message, /token=/));
		expect(link.host).toBe(new URL(FRONTEND_ORIGIN).host);
		expect(link.searchParams.get('return_host')).toBe(TENANT_HOST);

		// Verifying happens on the platform. The way back is an explicit button,
		// never an automatic redirect to the (owner-controlled) custom domain.
		await page.goto(link.toString());
		const cont = page.getByRole('link', { name: /^Continue to / });
		await expect(cont).toHaveAttribute('href', `${TENANT_ORIGIN}/login`);
		expect(new URL(page.url()).host).toBe(new URL(FRONTEND_ORIGIN).host);
		await cont.click();
		await page.waitForURL(`${TENANT_ORIGIN}/login`);

		await page.context().close();
	});
});
