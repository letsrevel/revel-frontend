import { PERSONAS } from '../../support/personas';
import { revealLoginForm } from '../../support/auth-forms';
import { test, expect } from '../../support/fixtures';
import { uiLogin } from '../../support/session';
import { gotoHydrated } from '../../support/navigation';
import { ssoProvider } from '../../support/skip';
import {
	FRONTEND_ORIGIN,
	TENANT_HOST,
	TENANT_ORIGIN,
	tenantPage,
	tenantUnavailableReason
} from '../../support/tenant';

// Custom domains (#1056) — signing in on the tenant host. Cookies are host-only,
// so the session is established by a UI login ON `tenant.localhost` (a session
// from localhost:5173 would not carry over). The tenant org's owner is used
// precisely because on the platform their menu offers org admin; on the tenant
// host it must not.

test.describe('J30 tenant login @p1', () => {
	// eslint-disable-next-line no-empty-pattern
	test.beforeEach(async ({}, testInfo) => {
		const reason = await tenantUnavailableReason(TENANT_HOST, { needsTenantMode: true });
		testInfo.skip(reason !== null, reason ?? '');
	});

	test('logs in on the tenant host, no SSO buttons, host-scoped cookies, no admin entries', async ({
		browser
	}) => {
		const page = await tenantPage(browser, TENANT_ORIGIN);

		// SSO is not offered on a tenant host (the OIDC callback is pinned to the
		// platform). Only meaningful when the backend has a provider: confirm the
		// platform login does show it, so absence here is not vacuous.
		const keycloak = await ssoProvider('keycloak');
		// In demo mode the full form (and any SSO buttons) sits behind "Show login
		// form", so reveal it on both hosts or the absence check is vacuous.
		await gotoHydrated(page, '/login');
		await revealLoginForm(page);
		await expect(page.getByLabel('Email address')).toBeVisible();
		await expect(page.getByRole('link', { name: /Continue with/ })).toHaveCount(0);
		if (keycloak) {
			const platform = await browser.newPage();
			await gotoHydrated(platform, `${FRONTEND_ORIGIN}/login`);
			await revealLoginForm(platform);
			await expect(platform.getByRole('link', { name: /Continue with/ }).first()).toBeVisible();
			await platform.close();
		}

		// Sign in as the tenant org's owner; lands on the dashboard of the SAME host.
		// Credentials, not the persona name: in demo mode a persona name goes through
		// the test-account picker, which only lists the platform demo personas.
		const { email, password } = PERSONAS.tenantOwner;
		await uiLogin(page, { email, password }, { startAt: `${TENANT_ORIGIN}/login` });
		expect(new URL(page.url()).host).toBe(new URL(TENANT_ORIGIN).host);
		await expect(page).toHaveURL(/\/dashboard(\/|$|\?)/);

		// Auth cookies exist for the tenant host only: none leaked to `localhost`.
		const cookies = await page.context().cookies();
		const names = cookies.map((cookie) => cookie.name);
		expect(names).toContain('refresh_token');
		for (const cookie of cookies) {
			expect(cookie.domain.replace(/^\./, ''), `cookie ${cookie.name}`).toBe(TENANT_HOST);
		}

		// Account menu: the usual entries, but no org admin / create-organization.
		await page.getByRole('button', { name: 'User menu' }).click();
		await expect(page.getByRole('menuitem', { name: 'Log Out' })).toBeVisible();
		await expect(page.getByRole('menuitem', { name: 'Admin Dashboard' })).toHaveCount(0);
		await expect(page.getByRole('menuitem', { name: 'Create Organization' })).toHaveCount(0);
		await expect(page.getByRole('link', { name: 'Admin Dashboard' })).toHaveCount(0);
		await expect(page.getByRole('link', { name: 'Create Organization' })).toHaveCount(0);

		await page.context().close();
	});
});
