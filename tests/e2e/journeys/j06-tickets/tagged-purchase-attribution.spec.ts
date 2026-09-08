import { test, expect } from '../../support/fixtures';
import { createTicketedEvent, createVerifiedUser } from '../../support/factories';
import { pageAs } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// Purchase attribution (#880) — tagged journey: a visitor lands on the org's
// public profile with ?utm_source=instagram&utm_campaign=e2e-attrib, the tags
// carry across the client-side EventCard navigation onto the event page (the
// public-surface "UTM carry"), and claiming the free ticket there captures
// them onto the ticket via readAttributionFromCurrentUrl() at checkout time.
// The organizer's Sales-by-source breakdown and ticket list then show the new
// `instagram · e2e-attrib` bucket.
//
// Own event, on the SAME org as the admin-breakdown spec (attribution-
// breakdown.spec.ts): the Eligibility Test Organization's public events grid
// is a 6-per-page, sort-order-dependent list, so a freshly-created event isn't
// reliably on page 1 (the seeded fixtures + any other test's own leftover
// "E2E Event …" fixtures can outrank it). Rather than depend on sort order,
// this "clicks through" via the org profile's "Browse All" link (which itself
// carries the utm tags — an extra carry hop, still pinning the feature) onto
// the full events listing, then narrows with that page's own search box to
// this test's uniquely-named event before clicking it — deterministic
// regardless of how many other events exist on the org.

const ORG_SLUG = 'eligibility-test-org';

/** Both carried tags are present as their OWN query params (not a substring
 * match, which would also match e.g. utm_source=instagram-something). */
function assertUtmParams(url: string): void {
	const params = new URL(url).searchParams;
	expect(params.get('utm_source')).toBe('instagram');
	expect(params.get('utm_campaign')).toBe('e2e-attrib');
}

test.describe('J6 tagged purchase attribution @p1', () => {
	test('utm tags carry from org profile to event page and land on the ticket', async ({
		browser,
		asTestAdmin
	}) => {
		test.setTimeout(120_000);

		const [event, buyer] = await Promise.all([
			createTicketedEvent({ owner: 'testAdmin', orgSlug: ORG_SLUG }),
			createVerifiedUser('AttribBuyer')
		]);

		const page = await pageAs(browser, buyer);
		await gotoHydrated(page, `/org/${ORG_SLUG}?utm_source=instagram&utm_campaign=e2e-attrib`);
		await waitForClientAuth(page);

		// "Browse All" carries the tags onto the full events listing (first carry
		// hop) — then search narrows straight to this test's event regardless of
		// how many other events exist on the org. Path-check (not substring) so
		// this can't false-pass while still sitting on the listing page, which
		// ALSO carries the same utm_* query string.
		await page.getByRole('link', { name: 'Browse All' }).click();
		await expect(page).toHaveURL(/\/events\?/);
		assertUtmParams(page.url());

		// The desktop filter sidebar (with the search box) is `hidden lg:block`;
		// below that breakpoint (mobile-chrome project) the same search box only
		// exists inside the floating-button-triggered filter sheet.
		const openFiltersButton = page.getByRole('button', { name: 'Open filters' });
		if (await openFiltersButton.isVisible()) {
			await openFiltersButton.click();
			const sheet = page.getByRole('dialog', { name: 'Filters' });
			await sheet.getByPlaceholder('Search events...').fill(event.name);
			await sheet.getByRole('button', { name: /^Show 1 event/ }).click({ timeout: 15_000 });
		} else {
			await page.getByPlaceholder('Search events...').fill(event.name);
		}

		const eventLink = page.getByRole('link', { name: event.name });
		await expect(eventLink.first()).toBeVisible({ timeout: 15_000 });

		// Idempotent click-retry: a click landing mid-rerender is occasionally
		// dropped (see j06-tickets/free-tier.spec.ts for the same pattern).
		await expect(async () => {
			await eventLink.first().click({ timeout: 3_000 });
			await expect(page).toHaveURL(new RegExp(`/events/${ORG_SLUG}/${event.slug}(\\?|$)`), {
				timeout: 3_000
			});
		}).toPass({ timeout: 30_000 });

		// The client-side navigation carried both tags onto the event page (second
		// carry hop) — this pins the UTM-carry feature independent of the purchase
		// below.
		assertUtmParams(page.url());

		// Claim the free ticket (same UI flow as j06-tickets/free-tier.spec.ts):
		// stepper -> Buy -> checkout sheet (names required) -> Claim.
		await expect(page.getByRole('heading', { name: 'Free Entry' }).first()).toBeVisible();
		const stepper = page.getByRole('group', { name: 'Quantity for Free Entry' });
		await expect(stepper).toBeVisible({ timeout: 15_000 });
		const quantity = stepper.locator('span[aria-live="polite"]');
		// Idempotent retry: the event page still settles post-navigation here (see
		// the card-click retry above), so the stepper button can be mid-rerender
		// (and briefly detached) right as this click lands.
		await expect(async () => {
			if ((await quantity.textContent()) === '1') return;
			await stepper.getByRole('button', { name: 'Add one Free Entry' }).click({ timeout: 5_000 });
			await expect(quantity).toHaveText('1', { timeout: 5_000 });
		}).toPass({ timeout: 30_000 });

		const summaryBar = page.getByTestId('cart-summary-bar');
		const sheet = page.getByRole('dialog', { name: 'Checkout' });
		await expect(async () => {
			if (await sheet.isVisible()) return;
			await summaryBar.getByRole('button', { name: 'Buy', exact: true }).click();
			await expect(sheet).toBeVisible({ timeout: 8_000 });
		}).toPass({ timeout: 30_000 });
		await sheet.getByLabel('Name for ticket 1').fill('E2E Attribution Buyer');

		const success = page.getByRole('dialog', { name: 'Your Ticket' });
		await expect(async () => {
			if (await success.isVisible()) return;
			await sheet.getByRole('button', { name: 'Claim', exact: true }).click();
			await expect(success).toBeVisible({ timeout: 8_000 });
		}).toPass({ timeout: 60_000 });

		await page.context().close();

		// The organizer's breakdown/list gains the new instagram · e2e-attrib row.
		const admin = asTestAdmin;
		await gotoHydrated(admin, `/org/${ORG_SLUG}/admin/events/${event.id}/tickets`);
		await waitForClientAuth(admin);

		// See attribution-breakdown.spec.ts for why this needs two ancestor hops:
		// the heading's immediate parent is only the flex title row, a sibling of
		// the table wrapper.
		const card = admin
			.getByRole('heading', { name: 'Sales by source' })
			.locator('..')
			.locator('..');
		const instagramRow = card.locator('tr').filter({ hasText: 'instagram' });
		await expect(instagramRow).toContainText('e2e-attrib');
		await expect(instagramRow.locator('td').last()).toHaveText('1');

		await instagramRow.getByRole('link').click();
		await expect(admin).toHaveURL(/utm_source=instagram/);
		await expect(admin).toHaveURL(/utm_campaign=e2e-attrib/);
		await expect(admin.getByText(buyer.email).filter({ visible: true }).first()).toBeVisible();
	});
});
