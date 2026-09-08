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
// #880 follow-up D: the card is now a collapsible <details> (collapsed by
// default), auto-opening only when a utm filter is active in the URL — see
// SalesBySourceCard.svelte and its unit tests for the disclosure semantics.
//
// Read-only: the filter/clear clicks only rewrite the URL's query string, so
// this owns no inventory of its own and can run alongside any other spec.

const ORG_SLUG = 'eligibility-test-org';
const EVENT_SLUG = 'test-sold-out-event';

test.describe('J10 attribution breakdown @p1', () => {
	test('sales-by-source starts collapsed, expands on click, filters on click, and auto-opens when landed on with a utm filter', async ({
		asTestAdmin
	}) => {
		const api = await ApiClient.login(PERSONAS.testAdmin.email, PERSONAS.testAdmin.password);
		const event = await api.get<{ id: string }>(`/api/events/${ORG_SLUG}/event/${EVENT_SLUG}`);

		const page = asTestAdmin;
		await gotoHydrated(page, `/org/${ORG_SLUG}/admin/events/${event.id}/tickets`);
		await waitForClientAuth(page);
		await expect(page.getByRole('heading', { name: 'Manage Tickets' })).toBeVisible();

		// The heading's grandparent is the <details> (its own parent is only the
		// <summary>) — the disclosure body (table, "Filtered by" chip) is a
		// sibling <div> of the summary, both children of <details>.
		const heading = page.getByRole('heading', { name: 'Sales by source' });
		await expect(heading).toBeVisible();
		const card = heading.locator('..').locator('..');

		// Collapsed by default: the table is present in the DOM (inside the
		// closed <details>) but not visible.
		await expect(card.getByRole('table')).toBeHidden();

		// Expand: clicking anywhere inside the <summary> (the heading lives
		// there) toggles the disclosure open.
		await heading.click();
		await expect(card.getByRole('table')).toBeVisible();

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

		// Clear filter restores the full, unfiltered list. Manual expansion
		// persists across this same-page navigation (bind:open, not a one-way
		// prop) — the card stays open.
		await card.getByRole('link', { name: 'Clear filter' }).click();
		await expect(page).not.toHaveURL(/utm_source/);
		await expect(page).not.toHaveURL(/utm_campaign/);
		await expect(page.getByText('Showing page 1 of 1 (5 total tickets)')).toBeVisible();

		// Landing fresh (full page load, not a client nav) with an active utm
		// filter already in the URL auto-opens the card — a shared or
		// back-navigated filtered link must never render the buckets hidden.
		await gotoHydrated(
			page,
			`/org/${ORG_SLUG}/admin/events/${event.id}/tickets?utm_source=newsletter&utm_campaign=spring-2026`
		);
		await waitForClientAuth(page);
		await expect(card.getByRole('table')).toBeVisible();
		await expect(newsletterRow.locator('td').last()).toHaveText('2');
	});
});
