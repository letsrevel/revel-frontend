import { test, expect } from '../../support/fixtures';
import { hexToHslTriplet } from '../../../../src/lib/utils/brand-theme';
import {
	TENANT_HOST,
	TENANT_ORIGIN,
	fetchTenantOrg,
	tenantPage,
	tenantUnavailableReason
} from '../../support/tenant';
import { gotoHydrated } from '../../support/navigation';

// Custom domains (#1056) — the tenant home. `tenant.localhost` serves ONE
// organization: the org page at `/`, wrapped in the tenant header/footer rather
// than the platform chrome. Needs backend #1161 (DEBUG seed) and a frontend
// started with PLATFORM_HOSTS (playwright.config.ts does); self-skips otherwise.
// Desktop Chromium only (the config ignores this directory on mobile-chrome).

test.describe('J30 tenant home @p1', () => {
	// eslint-disable-next-line no-empty-pattern
	test.beforeEach(async ({}, testInfo) => {
		const reason = await tenantUnavailableReason(TENANT_HOST, { needsTenantMode: true });
		testInfo.skip(reason !== null, reason ?? '');
	});

	test('serves the org page at / with the tenant header and footer', async ({ browser }) => {
		const org = await fetchTenantOrg(TENANT_HOST);
		if (!org) throw new Error('tenant org vanished after the probe');

		const page = await tenantPage(browser, TENANT_ORIGIN);
		await gotoHydrated(page, '/');
		expect(new URL(page.url()).host).toBe(new URL(TENANT_ORIGIN).host);

		// The org page itself, at the root URL.
		await expect(page.getByRole('heading', { level: 1, name: org.name })).toBeVisible();

		// Tenant header: org name linking home, Events, Membership only when the
		// org offers it (mirrors TenantHeader's own condition), no platform nav.
		const header = page.getByRole('banner');
		await expect(header.getByRole('link', { name: org.name })).toBeVisible();
		const nav = header.getByRole('navigation', { name: 'Organization navigation' });
		await expect(nav.getByRole('link', { name: 'Events', exact: true })).toBeVisible();
		const offersMembership = !!(org.has_membership_plans || org.accept_membership_requests);
		await expect(nav.getByRole('link', { name: 'Membership', exact: true })).toHaveCount(
			offersMembership ? 1 : 0
		);
		await expect(header.getByRole('link', { name: 'Browse Events' })).toHaveCount(0);
		await expect(header.getByRole('link', { name: 'Organizations' })).toHaveCount(0);

		// Tenant footer: "Powered by Revel · Privacy · Terms".
		const footer = page.getByRole('contentinfo');
		await expect(footer).toContainText(org.name);
		await expect(footer).toContainText('Powered by');
		await expect(footer.getByRole('link', { name: 'Revel', exact: true })).toBeVisible();
		await expect(footer.getByRole('link', { name: 'Privacy' })).toHaveAttribute(
			'href',
			/\/legal\/privacy$/
		);
		await expect(footer.getByRole('link', { name: 'Terms' })).toHaveAttribute(
			'href',
			/\/legal\/terms$/
		);

		await page.context().close();
	});

	// The tenant payload's `brand_theme` applies app-wide on the custom domain
	// (#1055): the `<style data-org-brand>` override sets --primary to the
	// server-adjusted light primary, so compare the computed token, not the CSS
	// text (the FE writes HSL triplets, and the server may darken the entered hex).
	test('applies the org brand primary on every page', async ({ browser }) => {
		const org = await fetchTenantOrg(TENANT_HOST);
		const lightPrimary = org?.brand_theme?.light.primary;
		expect(lightPrimary, 'seeded tenant-test-org carries a brand_theme').toBeTruthy();
		const expected = hexToHslTriplet(lightPrimary ?? '');

		const page = await tenantPage(browser, TENANT_ORIGIN);
		for (const path of ['/', '/login', '/legal/privacy']) {
			await gotoHydrated(page, path);
			await expect(page.locator('style[data-org-brand]')).toHaveCount(1);
			const primary = await page.evaluate(() =>
				getComputedStyle(document.documentElement).getPropertyValue('--primary').trim()
			);
			expect(primary, path).toBe(expected);
		}

		await page.context().close();
	});
});
