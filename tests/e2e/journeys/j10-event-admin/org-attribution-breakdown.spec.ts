import { test, expect } from '../../support/fixtures';
import { ApiClient } from '../../support/api';
import { PERSONAS } from '../../support/personas';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import { pickSelectOption } from '../../support/ui';

// Purchase attribution, org-wide follow-up (#880, follow-up D) — the org-wide
// "Sales by source" breakdown moved from `/org/[slug]/admin/tickets` to its
// own collapsed-by-default disclosure on `/org/[slug]/admin/financials`
// (AttributionBreakdownSection.svelte), with since/event_ids URL-param
// filters (see attribution-presets.ts). It now loads client-side via
// TanStack Query, gated on the disclosure having been opened at least once —
// so this spec expands the section first and waits for query results with
// `expect(...).toBeVisible()` polling rather than fixed sleeps.
//
// Unlike the per-event card (attribution-breakdown.spec.ts), this one renders
// with `filterable={false}` (no single ticket list to filter into), so its
// bucket rows are plain text, never links.
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
	test('sales-by-source lives on financials, starts collapsed, and filters work once expanded', async ({
		asTestAdmin
	}) => {
		const api = await ApiClient.login(PERSONAS.testAdmin.email, PERSONAS.testAdmin.password);
		const event = await api.get<{ id: string; name: string }>(
			`/api/events/${ORG_SLUG}/event/${EVENT_SLUG}`
		);

		const page = asTestAdmin;
		await gotoHydrated(page, `/org/${ORG_SLUG}/admin/financials`);
		await waitForClientAuth(page);
		await expect(page.getByRole('heading', { name: 'Financials' })).toBeVisible();

		// Only one heading with this name exists: the section's own <summary>
		// heading (the nested SalesBySourceCard renders with showHeading={false}
		// so it doesn't duplicate it).
		const heading = page.getByRole('heading', { name: 'Sales by source' });
		await expect(heading).toHaveCount(1);
		await expect(heading).toBeVisible();

		// The heading's grandparent is the <details> (its own parent is only the
		// <summary>) — the controls and card live in a sibling <div> of the
		// summary, both children of <details>.
		const card = heading.locator('..').locator('..');

		const sinceControl = page.getByLabel('Time range');
		const eventControl = page.getByLabel('Filter by event');

		// Collapsed by default: the controls exist in the DOM (inside the closed
		// <details>) but are not visible, and neither query has anything to show.
		await expect(sinceControl).toBeHidden();
		await expect(eventControl).toBeHidden();

		// Expand: clicking anywhere inside the <summary> (the heading lives
		// there) toggles the disclosure open and fires both client-side queries.
		await heading.click();
		await expect(sinceControl).toBeVisible();
		await expect(eventControl).toBeVisible();

		// The section renders exactly one <table> once the breakdown query
		// resolves (client-side — poll rather than assume it's already there).
		const table = card.locator('table');
		await expect(table).toBeVisible({ timeout: 15_000 });
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
		await expect(page.getByRole('menuitemcheckbox', { name: event.name })).toBeVisible({
			timeout: 15_000
		});
		await page.getByRole('menuitemcheckbox', { name: event.name }).click();
		await page.keyboard.press('Escape');
		await expect(page).toHaveURL(new RegExp(`event_ids=${event.id}`));
		// Dropdown trigger label reflects the one selected event.
		await expect(eventControl).toHaveText('1 event');

		// The table now shows exactly the deterministic seeded buckets (the
		// query re-runs against the new event_ids param — poll for the update).
		const newsletterRow = table.locator('tr').filter({ hasText: 'newsletter' });
		const instagramRow = table.locator('tr').filter({ hasText: 'instagram' });
		const embedRow = table.locator('tr').filter({ hasText: 'revel-embed' });
		const directRow = table.locator('tr').filter({ hasText: 'Direct' });
		await expect(newsletterRow.locator('td').last()).toHaveText('2', { timeout: 15_000 });
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
		await expect(newsletterRow.locator('td').last()).toHaveText('2', { timeout: 15_000 });
		await expect(instagramRow.locator('td').last()).toHaveText('1');
		await expect(embedRow.locator('td').last()).toHaveText('1');
		await expect(directRow.locator('td').last()).toHaveText('1');

		// The old home page is back to a plain event picker: the section no
		// longer renders there.
		await gotoHydrated(page, `/org/${ORG_SLUG}/admin/tickets`);
		await waitForClientAuth(page);
		await expect(page.getByRole('heading', { name: 'Tickets', exact: true }).first()).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Sales by source' })).toHaveCount(0);
	});
});
