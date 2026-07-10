import { test, expect } from '../../support/fixtures';
import { gotoHydrated } from '../../support/navigation';

// J1.3 (USER_JOURNEYS.md) — anonymous browsing of /organizations and the
// public org profile. Read-only.

test.describe('J1 guest browses organizations @p0', () => {
	test('renders the seeded organization list and searches it', async ({ page, isMobile }) => {
		await gotoHydrated(page, '/organizations');

		const cards = page.getByRole('list', { name: 'Organization listings' }).getByRole('article');
		// Seed: Revel Events Collective, Tech Innovators Network, Eligibility Test Org.
		await expect(cards.filter({ hasText: 'Revel Events Collective' })).toBeVisible();
		await expect(cards.filter({ hasText: 'Tech Innovators Network' })).toBeVisible();
		expect(await cards.count()).toBeGreaterThanOrEqual(3);

		// Search lives in the desktop sidebar only.
		// NOTE: the searchbox on /organizations is (mis)labelled "Search events".
		if (!isMobile) {
			await page.getByRole('searchbox').fill('Tech Innovators');
			await expect(cards).toHaveCount(1);
			await expect(cards.getByRole('heading', { name: 'Tech Innovators Network' })).toBeVisible();
		}
	});

	test('clicks through to a public org profile', async ({ page }) => {
		await gotoHydrated(page, '/organizations');

		await page.getByRole('link', { name: /^Revel Events Collective,/ }).click();
		await page.waitForURL(/\/org\/revel-events-collective/);

		await expect(
			page.getByRole('heading', { level: 1, name: 'Revel Events Collective' }).first()
		).toBeVisible();
		await expect(
			page.getByRole('heading', { name: 'About Revel Events Collective' })
		).toBeVisible();
		// Public org page exposes follow/membership CTAs and its events.
		await expect(page.getByRole('button', { name: 'Follow' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Request Membership' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Events', exact: true })).toBeVisible();
	});
});
