import { test, expect } from '../../support/fixtures';
import { gotoHydrated } from '../../support/navigation';

// J18.1 (USER_JOURNEYS.md) — the public event-series page: hero with the
// series badge, the events the series contains, and the way in from the org
// profile. Read-only on seeded data.
//
// The seeded `monthly-tech-talks` series is a grouping-only series (no
// RecurrenceRule → `is_recurring: false`), and the page's hero badge is the
// unconditional "Event Series" badge — there is no separate "Recurring" badge
// to assert with seeded data. Recurring-series authoring is j18
// `recurring-admin` (@p2).

const SERIES_PATH = '/events/tech-innovators-network/series/monthly-tech-talks';

test.describe('J18 series page @p1', () => {
	test('renders the series hero and lists its events', async ({ page }) => {
		await gotoHydrated(page, SERIES_PATH);

		// Hero: name, series badge, owning org attribution.
		await expect(page.getByRole('heading', { name: 'Monthly Tech Talks', level: 1 })).toBeVisible();
		await expect(page.getByText('Event Series', { exact: true }).first()).toBeVisible();
		await expect(page.getByText('Tech Innovators Network').first()).toBeVisible();

		// The seeded series contains the May tech talk, linked to its detail page.
		await expect(page.getByRole('heading', { name: 'Events in this Series' })).toBeVisible();
		const eventLink = page.getByRole('link', { name: /Tech Talk May: Scaling Microservices/ });
		await expect(eventLink.first()).toBeVisible();

		// Click-through lands on the event detail page.
		await eventLink.first().click();
		await page.waitForURL(/\/events\/tech-innovators-network\/tech-talk-may-2025/);
		await expect(
			page.getByRole('heading', { name: 'Tech Talk May: Scaling Microservices', level: 1 })
		).toBeVisible();
	});

	test('is reachable from the org profile’s Event Series section', async ({ page }) => {
		await gotoHydrated(page, '/org/tech-innovators-network');

		await expect(page.getByRole('heading', { name: 'Event Series' })).toBeVisible();
		// The card's overlay link accumulates the whole card into its
		// accessible name ("Monthly Tech Talks, by Tech Innovators Network, …")
		// — match on that prefix rather than the sr-only span.
		const card = page.getByRole('link', {
			name: /^Monthly Tech Talks, by Tech Innovators Network/
		});
		await card.first().click();

		await page.waitForURL(/\/series\/monthly-tech-talks$/);
		await expect(page.getByRole('heading', { name: 'Monthly Tech Talks', level: 1 })).toBeVisible();
	});
});
