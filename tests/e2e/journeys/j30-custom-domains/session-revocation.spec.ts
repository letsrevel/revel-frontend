import type { Browser, Page } from '@playwright/test';
import { API_URL } from '../../support/api';
import { PERSONAS } from '../../support/personas';
import { test, expect } from '../../support/fixtures';
import { uiLogin } from '../../support/session';
import {
	REVOKE_HOST,
	REVOKE_ORIGIN,
	fetchTenantOrg,
	tenantPage,
	tenantUnavailableReason
} from '../../support/tenant';

// Custom domains (#1148, backend #1186/#1200) — a session issued on a tenant
// host dies with the domain. Driven through the real Django admin kill switch
// (`OrganizationAdmin.save_model`), not a test endpoint:
//
// - switching `custom_domain_enabled` off drops the backend's tenant cache, so
//   the backend refuses the session at once;
// - switching it back on moves the domain's `verified_at` forward
//   (`restart_domain_sessions`), so the OLD session can no longer refresh,
//   even though it was never presented while the switch was off (finding D).
//
// Uses its own fixture org on `revoke.localhost`: flipping the switch on the
// shared tenant fixture would take `tenant.localhost` down for the j30 specs
// running in parallel.

const ADMIN_EMAIL = process.env.E2E_SUPERUSER_EMAIL ?? 'admin@revel.io';
const ADMIN_PASSWORD = process.env.E2E_SUPERUSER_PASSWORD ?? 'password';

async function signInOnTenant(page: Page): Promise<void> {
	const { email, password } = PERSONAS.tenantOwner;
	await uiLogin(page, { email, password }, { startAt: `${REVOKE_ORIGIN}/login` });
	expect(new URL(page.url()).host).toBe(new URL(REVOKE_ORIGIN).host);
}

/** Flip the org's kill switch in the Django admin, as a platform superuser. */
async function setKillSwitch(browser: Browser, orgId: string, enabled: boolean): Promise<void> {
	const context = await browser.newContext();
	const admin = await context.newPage();
	try {
		const changeUrl = `${API_URL}/admin/events/organization/${orgId}/change/`;
		await admin.goto(`${API_URL}/admin/login/?next=${encodeURIComponent(changeUrl)}`);
		// The admin uses django-unfold: <button>s, not Django's stock <input type=submit>.
		await admin.locator('#id_username').fill(ADMIN_EMAIL);
		await admin.locator('#id_password').fill(ADMIN_PASSWORD);
		await admin.locator('form button[type="submit"]').first().click();
		await expect(admin).toHaveURL(changeUrl);

		await admin.locator('#id_custom_domain_enabled').setChecked(enabled);
		await admin.locator('button[name="_save"]').click();
		await expect(admin).not.toHaveURL(changeUrl);
	} finally {
		await context.close();
	}
	// save_model drops the backend's tenant cache on commit: the host's
	// resolution follows the switch at once.
	await expect
		.poll(async () => (await fetchTenantOrg(REVOKE_HOST)) !== null, { timeout: 10_000 })
		.toBe(enabled);
}

test.describe('J30 tenant session revocation @p1', () => {
	// The kill switch is shared state of the fixture org: one test at a time.
	test.describe.configure({ mode: 'serial' });

	// eslint-disable-next-line no-empty-pattern
	test.beforeEach(async ({}, testInfo) => {
		const reason = await tenantUnavailableReason(REVOKE_HOST, { needsTenantMode: true });
		testInfo.skip(
			reason !== null,
			reason ? `${reason} (fixture tenant-revoke-org on revoke.localhost)` : ''
		);
	});

	test('the kill switch signs the tenant session out, and re-enabling it does not revive it', async ({
		browser
	}) => {
		test.slow();
		const org = await fetchTenantOrg(REVOKE_HOST);
		expect(org, 'fixture org resolves').not.toBeNull();
		const orgId = (org as { id: string }).id;

		const page = await tenantPage(browser, REVOKE_ORIGIN);
		await signInOnTenant(page);
		await expect(page).toHaveURL(/\/dashboard(\/|$|\?)/);

		try {
			// Off: the backend refuses the session immediately. The frontend may keep
			// serving the host for up to its 60 s tenant cache; then either the host is
			// gone (404) or the page renders without a signed-in user: the session's
			// refresh is refused, so the account menu never appears. (The auth-guarded
			// route itself still renders until then, from the not-yet-expired access
			// cookie; tracked as a follow-up, no data is served.)
			await setKillSwitch(browser, orgId, false);
			const off = await page.goto('/dashboard');
			if (off?.status() !== 404) {
				await expect(page.getByRole('button', { name: 'User menu' })).toHaveCount(0, {
					timeout: 15_000
				});
			}
		} finally {
			// Always re-enable: later tests and reruns need the fixture host up.
			await setKillSwitch(browser, orgId, true);
		}

		// The re-enable test starts from a FRESH session issued before the restart.
		await page.context().close();
		const fresh = await tenantPage(browser, REVOKE_ORIGIN);
		await signInOnTenant(fresh);
		await expect(fresh).toHaveURL(/\/dashboard(\/|$|\?)/);

		// Off and straight back on, without presenting the session in between.
		await setKillSwitch(browser, orgId, false);
		await setKillSwitch(browser, orgId, true);

		// The old access token stays valid until it expires (by design); simulate
		// that, so the next request has to refresh: refused, back to the tenant login.
		await fresh.context().clearCookies({ name: 'access_token' });
		await fresh.goto('/dashboard');
		await expect(fresh).toHaveURL(/\/login(\?|$)/);
		expect(new URL(fresh.url()).host).toBe(new URL(REVOKE_ORIGIN).host);

		// A new login on the re-enabled domain works.
		await signInOnTenant(fresh);
		await expect(fresh).toHaveURL(/\/dashboard(\/|$|\?)/);

		await fresh.context().close();
	});
});
