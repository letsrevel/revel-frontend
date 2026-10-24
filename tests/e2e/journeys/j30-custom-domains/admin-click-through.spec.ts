import { revealLoginForm } from '../../support/auth-forms';
import type { Locator, Page } from '@playwright/test';
import { PERSONAS } from '../../support/personas';
import { test, expect } from '../../support/fixtures';
import { uiLogin } from '../../support/session';
import {
	FRONTEND_ORIGIN,
	TENANT_HOST,
	TENANT_ORG_SLUG,
	TENANT_ORIGIN,
	tenantPage,
	tenantUnavailableReason
} from '../../support/tenant';

// Custom domains (#1056) — clicking "Admin" on the tenant dashboard.
//
// Org admin lives on the platform only. The tenant routing hook answers the
// client-side navigation's `__data.json` request with a 302 to the platform
// origin. SvelteKit must turn that cross-origin redirect into a full navigation,
// not a fetch error + error page. route-scoping.spec.ts only covers the redirect
// with raw HTTP / `page.goto`; here the link is actually CLICKED.

const ADMIN_PATH = `/org/${TENANT_ORG_SLUG}/admin`;

/** Sign in as the tenant org's owner ON the tenant host; lands on its /dashboard. */
async function signInOnTenant(page: Page): Promise<void> {
	// Credentials, not the persona name: demo mode's picker only lists platform personas.
	const { email, password } = PERSONAS.tenantOwner;
	await uiLogin(page, { email, password }, { startAt: `${TENANT_ORIGIN}/login` });
	expect(new URL(page.url()).host).toBe(new URL(TENANT_ORIGIN).host);
}

/** Wait until the browser has left the tenant host for the platform origin. */
async function waitForPlatform(page: Page): Promise<URL> {
	await page.waitForURL((url) => url.origin === FRONTEND_ORIGIN, { timeout: 30_000 });
	return new URL(page.url());
}

/** Both Admin links share this accessible name; the page renders the quick action first. */
function adminLinks(page: Page): Locator {
	return page.getByRole('link', { name: 'Admin', exact: true });
}

function expectNoErrorPage(page: Page): Promise<void> {
	// +error.svelte renders the status as a kicker ("Error 500"); a normal page never does.
	return expect(page.getByText(/^Error \d{3}$/)).toHaveCount(0);
}

test.describe('J30 tenant admin click-through @p1', () => {
	// eslint-disable-next-line no-empty-pattern
	test.beforeEach(async ({}, testInfo) => {
		const reason = await tenantUnavailableReason(TENANT_HOST, { needsTenantMode: true });
		testInfo.skip(reason !== null, reason ?? '');
	});

	test('the quick-action Admin link leaves the tenant host for the platform login', async ({
		browser
	}) => {
		const page = await tenantPage(browser, TENANT_ORIGIN);
		await signInOnTenant(page);

		// Quick action (hero) + My Organizations card: two links. Take the one outside the card.
		await expect(adminLinks(page)).toHaveCount(2);
		const quickAction = adminLinks(page).first();
		await expect(
			page.locator('#organizations-section').getByRole('link', { name: 'Admin' })
		).toHaveCount(1);
		await quickAction.click();

		const url = await waitForPlatform(page);
		// The platform session is separate (host-only cookies): the guard sends us to login.
		expect(url.pathname).toBe('/login');
		expect(url.searchParams.get('returnUrl')).toBe(ADMIN_PATH);
		expect(url.host).not.toBe(TENANT_HOST + ':5173');
		await expectNoErrorPage(page);
		// Demo mode hides the form behind "Show login form"; reveal it before checking.
		await revealLoginForm(page);
		await expect(page.getByLabel('Email address')).toBeVisible();

		await page.context().close();
	});

	test('the My Organizations card Admin link leaves the tenant host for the platform login', async ({
		browser
	}) => {
		const page = await tenantPage(browser, TENANT_ORIGIN);
		await signInOnTenant(page);

		const cardLink = page.locator('#organizations-section').getByRole('link', { name: 'Admin' });
		await expect(cardLink).toBeVisible();
		await cardLink.click();

		const url = await waitForPlatform(page);
		expect(url.pathname).toBe('/login');
		expect(url.searchParams.get('returnUrl')).toBe(ADMIN_PATH);
		expect(url.hostname).not.toBe(TENANT_HOST);
		await expectNoErrorPage(page);

		await page.context().close();
	});

	test('with a platform session too, Admin lands directly on the platform org admin', async ({
		browser
	}) => {
		const page = await tenantPage(browser, TENANT_ORIGIN);

		// Same browser context, second tab: cookies are host-only, so this creates a
		// separate session on `localhost` next to the one on the tenant host.
		const platform = await page.context().newPage();
		const { email, password } = PERSONAS.tenantOwner;
		await uiLogin(platform, { email, password }, { startAt: `${FRONTEND_ORIGIN}/login` });
		await platform.close();

		await signInOnTenant(page);
		await adminLinks(page).first().click();

		const url = await waitForPlatform(page);
		expect(url.pathname).toBe(ADMIN_PATH);
		expect(url.hostname).not.toBe(TENANT_HOST);
		await expectNoErrorPage(page);

		await page.context().close();
	});
});
