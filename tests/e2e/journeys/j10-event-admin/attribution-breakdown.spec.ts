import { test, expect } from '../../support/fixtures';
import { ApiClient } from '../../support/api';
import { PERSONAS } from '../../support/personas';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// Purchase attribution (#880 / BE #922, #944) — the seeded `test-sold-out-event`
// (Eligibility Test Organization) carries a deterministic campaign mix across
// its five ACTIVE tickets, in ticketholder0..4@test.com order: newsletter/
// email/spring-2026 x2, instagram/social/spring-2026 x1, revel-embed/embed/
// partner.example.org x1, direct (no tags) x1. This spec pins the admin
// Sales-by-source card's bucket counts and its click-to-filter/clear round
// trip against that fixture.
//
// Read-only: the filter/clear clicks only rewrite the URL's query string, so
// this owns no inventory of its own and can run alongside any other spec.

const ORG_SLUG = 'eligibility-test-org';
const EVENT_SLUG = 'test-sold-out-event';

test.describe('J10 attribution breakdown @p1', () => {
	test('sales-by-source shows the seeded buckets and filters on click', async ({ asTestAdmin }) => {
		const api = await ApiClient.login(PERSONAS.testAdmin.email, PERSONAS.testAdmin.password);
		const event = await api.get<{ id: string }>(`/api/events/${ORG_SLUG}/event/${EVENT_SLUG}`);

		const page = asTestAdmin;
		await gotoHydrated(page, `/org/${ORG_SLUG}/admin/events/${event.id}/tickets`);
		await waitForClientAuth(page);
		await expect(page.getByRole('heading', { name: 'Manage Tickets' })).toBeVisible();

		// The heading's grandparent is the card (`rounded-lg border bg-card p-4`):
		// its own parent is only the flex row holding the title + "Clear filter"
		// pill, a sibling of the table wrapper — one ancestor hop up is not
		// enough to reach the table.
		const card = page.getByRole('heading', { name: 'Sales by source' }).locator('..').locator('..');
		await expect(card).toBeVisible();

		const newsletterRow = card.locator('tr').filter({ hasText: 'newsletter' });
		const instagramRow = card.locator('tr').filter({ hasText: 'instagram' });
		const embedRow = card.locator('tr').filter({ hasText: 'revel-embed' });
		const directRow = card.locator('tr').filter({ hasText: 'Direct' });

		// Pin the exact seeded counts (2 / 1 / 1 / 1), not just row presence.
		await expect(newsletterRow.locator('td').last()).toHaveText('2');
		await expect(instagramRow.locator('td').last()).toHaveText('1');
		await expect(embedRow.locator('td').last()).toHaveText('1');
		await expect(directRow.locator('td').last()).toHaveText('1');

		// Unfiltered list holds all 5 seeded tickets.
		await expect(page.getByText('Showing page 1 of 1 (5 total tickets)')).toBeVisible();

		// Click the newsletter row: filters the URL AND the ticket list down to
		// exactly the two newsletter holders (utm_campaign is carried too, since
		// the newsletter bucket has one).
		await newsletterRow.getByRole('link').click();
		await expect(page).toHaveURL(/utm_source=newsletter/);
		await expect(page).toHaveURL(/utm_campaign=spring-2026/);
		await expect(page.getByText('Showing page 1 of 1 (2 total tickets)')).toBeVisible();
		await expect(
			page.getByText('ticketholder0@test.com').filter({ visible: true }).first()
		).toBeVisible();
		await expect(
			page.getByText('ticketholder1@test.com').filter({ visible: true }).first()
		).toBeVisible();
		await expect(page.getByText('ticketholder2@test.com')).toBeHidden();
		await expect(page.getByText('ticketholder3@test.com')).toBeHidden();
		await expect(page.getByText('ticketholder4@test.com')).toBeHidden();

		// Clear filter restores the full, unfiltered list.
		await card.getByRole('link', { name: 'Clear filter' }).click();
		await expect(page).not.toHaveURL(/utm_source/);
		await expect(page).not.toHaveURL(/utm_campaign/);
		await expect(page.getByText('Showing page 1 of 1 (5 total tickets)')).toBeVisible();
	});
});
