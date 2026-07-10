import { test, expect } from '../../support/fixtures';
import { gotoHydrated } from '../../support/navigation';

// J1.1 (USER_JOURNEYS.md) — anonymous browsing of /events against the
// bootstrap seed: list rendering, filters, search, view toggle, click-through.
// Read-only: no data is mutated.
//
// The filter sidebar is desktop-only (`hidden lg:block`); on mobile filters
// live behind a floating "Filters" sheet, covered by later-phase specs. The
// list itself and click-through run on both viewports.

const eventCards = (page: import('@playwright/test').Page) =>
	page.getByRole('list', { name: 'Event listings' }).getByRole('article');

test.describe('J1 guest browses events @p0', () => {
	test.beforeEach(async ({ page }) => {
		await gotoHydrated(page, '/events');
	});

	test('renders the seeded event list', async ({ page }) => {
		await expect(
			page.getByRole('heading', { level: 1, name: 'Discover Events' }).first()
		).toBeVisible();
		await expect(page.getByText(/\d+ events? found/)).toBeVisible();

		// The seed creates 20+ open public/members-only events. (No assertions on
		// a SPECIFIC event here: page 1 shifts as other specs create events.)
		expect(await eventCards(page).count()).toBeGreaterThanOrEqual(10);

		// Cards carry the essentials: name heading and a price-type badge.
		const first = eventCards(page).first();
		await expect(first.getByRole('heading')).toBeVisible();
		await expect(first.getByText(/Ticketed|Free RSVP/).first()).toBeVisible();
	});

	test('filters by ticket type', async ({ page, isMobile }) => {
		test.skip(isMobile, 'Filter sidebar is desktop-only; the mobile sheet is covered separately.');

		await page.getByRole('button', { name: 'Free RSVP' }).click();
		await page.waitForURL(/ticket_type=free/);

		// Every remaining card is a Free RSVP event.
		await expect(eventCards(page).first()).toBeVisible();
		await expect(eventCards(page).filter({ hasText: 'Ticketed' })).toHaveCount(0);
	});

	test('searches events by name', async ({ page, isMobile }) => {
		test.skip(
			isMobile,
			'Search lives in the desktop sidebar; the mobile sheet is covered separately.'
		);

		const before = await eventCards(page).count();
		await page.getByRole('searchbox', { name: 'Search events' }).fill('Sunset');

		// Search is fuzzy (matches descriptions too) — assert it narrows the list
		// and the obvious hit is present.
		await expect(
			eventCards(page).getByRole('heading', { name: 'Summer Sunset Music Festival' })
		).toBeVisible({ timeout: 10_000 });
		await expect(async () => {
			expect(await eventCards(page).count()).toBeLessThan(before);
		}).toPass();
	});

	test('toggles to the calendar view and back', async ({ page }) => {
		await page.getByRole('button', { name: 'Calendar' }).click();
		await expect(page.getByRole('list', { name: 'Event listings' })).toBeHidden();

		await page.getByRole('button', { name: 'List' }).click();
		await expect(page.getByRole('list', { name: 'Event listings' })).toBeVisible();
	});

	test('clicks through to the event detail page', async ({ page }) => {
		// Any first-page card works (a specific event may have been paged out).
		const firstCard = eventCards(page).first();
		const name = await firstCard.getByRole('heading').innerText();
		await firstCard.getByRole('link').first().click();

		await page.waitForURL(/\/events\/[^/]+\/[^/]+/);
		await expect(page.getByRole('heading', { level: 1, name }).first()).toBeVisible();
	});
});
