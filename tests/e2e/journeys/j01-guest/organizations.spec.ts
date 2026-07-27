import { test, expect } from '../../support/fixtures';
import { gotoHydrated } from '../../support/navigation';

// J1.3 (USER_JOURNEYS.md) — anonymous browsing of /organizations and the
// public org profile. Read-only.

test.describe('J1 guest browses organizations @p0', () => {
	test('renders the seeded organization list and searches it', async ({ page, isMobile }) => {
		await gotoHydrated(page, '/organizations');

		const cards = page.getByRole('list', { name: 'Organization listings' }).getByRole('article');
		// The platform-wide list is large (`make seed` creates 100+ showcase
		// orgs) and page 1 ordering is arbitrary, so specific orgs are asserted
		// through search — never through page-1 presence.
		expect(await cards.count()).toBeGreaterThanOrEqual(3);

		// The ?search= param works on every viewport (the searchbox itself lives
		// in the desktop sidebar only).
		await gotoHydrated(page, '/organizations?search=Revel Events Collective');
		await expect(cards.filter({ hasText: 'Revel Events Collective' })).toBeVisible();

		// NOTE: the searchbox on /organizations is (mis)labelled "Search events".
		if (!isMobile) {
			await page.getByRole('searchbox').fill('Tech Innovators Network');
			// Seeded faker org names could legitimately contain the needle, so
			// assert the match is present rather than an exact result count.
			await expect(cards.getByRole('heading', { name: 'Tech Innovators Network' })).toBeVisible();
		}
	});

	test('clicks through to a public org profile', async ({ page }) => {
		await gotoHydrated(page, '/organizations?search=Revel Events Collective');

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
		// The guest membership CTA is a real LINK into login carrying a returnUrl
		// back to this org (MembershipCta's anonymous branch — it replaced the
		// legacy "Request Membership" button), so it survives no-JS and
		// middle-click.
		const joinLink = page.getByRole('link', { name: 'Join Revel Events Collective' });
		await expect(joinLink).toBeVisible();
		await expect(joinLink).toHaveAttribute(
			'href',
			/\/login\?returnUrl=%2Forg%2Frevel-events-collective$/
		);
		await expect(page.getByRole('heading', { name: 'Events', exact: true })).toBeVisible();
	});
});
