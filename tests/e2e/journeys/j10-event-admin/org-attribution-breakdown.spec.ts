import { test, expect } from '../../support/fixtures';
import { ApiClient } from '../../support/api';
import { PERSONAS } from '../../support/personas';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import { pickSelectOption } from '../../support/ui';

// Purchase attribution, org-wide follow-up (#880) — `/org/[slug]/admin/tickets`
// aggregates the org's "Sales by source" across every ticketed event, with
// since/event_ids URL-param filters (see attribution-presets.ts and the
// +page.server.ts load). Unlike the per-event card
// (attribution-breakdown.spec.ts), this one renders with `filterable={false}`
// (no single ticket list to filter into), so its bucket rows are plain text,
// never links.
//
// The Eligibility Test Organization has several ticketed events, so this page
// does NOT redirect (shouldRedirectToSingle only fires for exactly one active
// event) — landing on the org page itself is asserted before proceeding.
//
// Selecting the seeded `test-sold-out-event` in the event filter narrows the
// org-wide totals down to that event's deterministic 2/1/1/1 bucket mix (see
// tagged-purchase-attribution.spec.ts's header comment for the fixture
// layout). Unfiltered, the org total also includes randomly-attributed
// tickets from the org's other seeded events, so only the event-filtered view
// is asserted for exact counts.
//
// Read-only: filter changes only rewrite the URL query string (replaceState),
// so this owns no inventory of its own and can run alongside any other spec.

const ORG_SLUG = 'eligibility-test-org';
const EVENT_SLUG = 'test-sold-out-event';

test.describe('J10 org-wide attribution breakdown @p1', () => {
	test('sales-by-source renders org-wide, unlinked, with working since/event filters', async ({
		asTestAdmin
	}) => {
		const api = await ApiClient.login(PERSONAS.testAdmin.email, PERSONAS.testAdmin.password);
		const event = await api.get<{ id: string; name: string }>(
			`/api/events/${ORG_SLUG}/event/${EVENT_SLUG}`
		);

		const page = asTestAdmin;
		await gotoHydrated(page, `/org/${ORG_SLUG}/admin/tickets`);
		await waitForClientAuth(page);

		// Confirm we actually landed on the org-wide picker page, not redirected
		// to a single event's tickets page (shouldRedirectToSingle).
		await expect(page).toHaveURL(new RegExp(`/org/${ORG_SLUG}/admin/tickets(\\?|$)`));
		await expect(page).not.toHaveURL(/\/admin\/events\/.+\/tickets/);
		await expect(page.getByRole('heading', { name: 'Tickets', exact: true }).first()).toBeVisible();

		// The card renders with `showHeading={false}` here (the SectionHeader
		// above it already provides the "Sales by source" heading, so the card
		// doesn't duplicate it) — only one heading with that name exists.
		const heading = page.getByRole('heading', { name: 'Sales by source' });
		await expect(heading).toHaveCount(1);
		await expect(heading).toBeVisible();

		const sinceControl = page.getByLabel('Time range');
		const eventControl = page.getByLabel('Filter by event');
		await expect(sinceControl).toBeVisible();
		await expect(eventControl).toBeVisible();

		// The page renders exactly one <table> (the SalesBySourceCard's); the
		// events list below it is a <ul>, not a table.
		const table = page.locator('table');
		await expect(table).toBeVisible();
		await expect(table.locator('tbody tr').first()).toBeVisible();

		// Org has direct sales from seed: a "Direct" row is present.
		await expect(table.locator('tr').filter({ hasText: 'Direct' })).toHaveCount(1);

		// Aggregate view is not filterable: no bucket row (nor a "Clear filter"
		// pill, since nothing is filtered yet) renders as a link.
		await expect(table.getByRole('link')).toHaveCount(0);

		// Select the sold-out fixture event in the event dropdown. bits-ui's
		// CheckboxItem doesn't reliably auto-close the menu on select, and a
		// still-open menu overlay would intercept the next click — close it
		// explicitly afterwards.
		await eventControl.click();
		await page.getByRole('menuitemcheckbox', { name: event.name }).click();
		await page.keyboard.press('Escape');
		await expect(page).toHaveURL(new RegExp(`event_ids=${event.id}`));
		// Dropdown trigger label reflects the one selected event.
		await expect(eventControl).toHaveText('1 event');

		// The table now shows exactly the deterministic seeded buckets.
		const newsletterRow = table.locator('tr').filter({ hasText: 'newsletter' });
		const instagramRow = table.locator('tr').filter({ hasText: 'instagram' });
		const embedRow = table.locator('tr').filter({ hasText: 'revel-embed' });
		const directRow = table.locator('tr').filter({ hasText: 'Direct' });
		await expect(newsletterRow.locator('td').last()).toHaveText('2');
		await expect(instagramRow.locator('td').last()).toHaveText('1');
		await expect(embedRow.locator('td').last()).toHaveText('1');
		await expect(directRow.locator('td').last()).toHaveText('1');

		// Still no links: the event filter doesn't change filterable={false}.
		await expect(table.getByRole('link')).toHaveCount(0);

		// Pick a since preset: the URL gains a `since=` ISO param, combined with
		// the still-active event filter (both params coexist).
		await pickSelectOption(page, sinceControl, 'Last 7 days');
		await expect(page).toHaveURL(/since=/);
		await expect(page).toHaveURL(new RegExp(`event_ids=${event.id}`));
		const sinceParam = new URL(page.url()).searchParams.get('since');
		expect(sinceParam).not.toBeNull();
		expect(Number.isFinite(new Date(sinceParam as string).getTime())).toBe(true);

		// The seeded tickets' created_at values are recent (fixture setup time),
		// so "last 7 days" combined with the event filter is expected to still
		// surface the same deterministic buckets rather than an empty result.
		await expect(newsletterRow.locator('td').last()).toHaveText('2');
		await expect(instagramRow.locator('td').last()).toHaveText('1');
		await expect(embedRow.locator('td').last()).toHaveText('1');
		await expect(directRow.locator('td').last()).toHaveText('1');
	});
});
