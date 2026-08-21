import type { Page } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import {
	claimTicketViaApi,
	createOrganization,
	createPriceCategory,
	createTicketedEvent,
	createTicketTier,
	createVerifiedUser,
	deleteDefaultTier,
	uniqueName,
	type CreatedEvent
} from '../../support/factories';
import { ApiClient } from '../../support/api';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J19.1 + J19.3 (USER_JOURNEYS.md) — the END-TO-END self-service seating
// pipeline the phase-2 backend work unblocked, driven entirely from factories
// (no seed dependency):
//
//   Spec 1 (best-available): a throwaway org owner creates a venue, a seated
//   sector with a bulk row of seats, a price category, PAINTS the seats with it
//   through the new /seats/paint endpoint, then attaches a FREE best-available
//   tier to that category. A fresh buyer claims 2 tickets through the UI and
//   gets an ADJACENT block — proving painting → pool → best-available
//   assignment without touching the seed-painted showcase events.
//
//   Spec 2 (standing capacity): a STANDING sector with a hard capacity of 2
//   backing a GA (seat_assignment_mode 'none') tier. Two API claims fill it,
//   and the next purchase through the UI hits the backend's 429 ("This sector
//   is full.") surfaced in the checkout sheet's inline error alert.
//
// #853 rewrite (wave 2, task 11): ONLY the purchase legs move to the cart
// flow — every arrange step above (org/venue/sector/category/paint/filler
// claims) is untouched. Both tiers here are `quickBuyEligible` (best_available
// and 'none' respectively) — neither ever had a seat picker, so both now
// drive the tier card's inline quick-buy stepper + the sticky `CartSummaryBar`
// + the checkout sheet (`getByRole('dialog', { name: 'Checkout' })`) instead
// of the deleted `TicketTierModal`/`TicketConfirmationDialog` pair. Neither
// event sets `require_ticket_names: false`, so the sheet opens even at
// quantity 1 (`EventCart.needsSheet`) — same wave-1 convention
// best-available.spec.ts's `claimBestAvailable` helper uses.
//
// Isolation: every run arranges its own org/venue/event, so parallel workers
// and reruns never collide.

const SEAT_RE = /Row ([A-Z0-9]+), Seat (\d+)/;

interface SeatRef {
	row: string;
	number: number;
}

function tierCardLocator(page: Page, tierName: string) {
	// `div.bg-card`, NOT bare `.bg-card` — TicketTierList's wrapping <section>
	// carries the class too, so a bare class filter matches both the section
	// and the one PricingCard whose heading it contains. The tag discriminates:
	// only PricingCard's root is a <div>.
	return page
		.locator('div.bg-card')
		.filter({ has: page.getByRole('heading', { name: tierName, exact: true }) });
}

interface CreatedSeatingVenue {
	org: Awaited<ReturnType<typeof createOrganization>>;
	api: ApiClient;
	venueId: string;
}

/**
 * Throwaway public org + venue owned by a fresh verified user — the shared
 * arrange for both specs. Public visibility so a fresh unrelated buyer can
 * reach the org's public event page and purchase.
 */
async function createSeatingVenue(): Promise<CreatedSeatingVenue> {
	const org = await createOrganization({ publicVisibility: true });
	const api = await ApiClient.login(org.owner.email, org.owner.password);
	const venue = await api.post<{ id: string }>(`/api/organization-admin/${org.slug}/venues`, {
		name: uniqueName('Venue'),
		capacity: 50
	});
	return { org, api, venueId: venue.id };
}

/**
 * Read the buyer's seats for `eventName` from the my-tickets UI: the list
 * cards show no seat info, so each card's "View Ticket" modal is opened and its
 * "Venue • Sector • Row X, Seat N" line parsed (pending reservations included).
 */
async function ticketSeats(page: Page, eventName: string, expected: number): Promise<SeatRef[]> {
	const search = page.getByPlaceholder('Search by event name or ticket tier...');
	await expect(async () => {
		await gotoHydrated(page, '/dashboard/tickets');
		await search.fill(eventName);
		await expect(page.getByText(`Showing ${expected} of ${expected}`)).toBeVisible({
			timeout: 8_000
		});
	}).toPass({ timeout: 45_000 });

	const seats: SeatRef[] = [];
	const modal = page.getByRole('dialog', { name: 'Your Ticket', exact: true });
	for (let i = 0; i < expected; i++) {
		await page.getByRole('button', { name: 'View ticket and QR code' }).nth(i).click();
		const seatLine = modal.getByText(SEAT_RE);
		await expect(seatLine).toBeVisible({ timeout: 8_000 });
		const text = await seatLine.textContent();
		const match = text?.match(SEAT_RE);
		if (!match) throw new Error(`Unparseable seat line: ${text}`);
		seats.push({ row: match[1], number: Number(match[2]) });
		await page.keyboard.press('Escape');
		await expect(modal).toBeHidden();
	}
	return seats;
}

test.describe('J19 self-service seating @p2', () => {
	test('paint → best-available pool → adjacent block on the tickets', async ({ browser }) => {
		test.setTimeout(180_000);

		// Arrange (API): throwaway org + venue; a seated sector with a bulk row
		// of 8 seats (A1..A8); a price category; PAINT the seats with it via the
		// new /seats/paint endpoint (raw PUT — VenueSeatPaintSchema); a FREE
		// best-available tier on that category. Painting is what makes the pool
		// non-empty, so the buyer's claim actually resolves adjacent seats.
		const [{ org, api, venueId }, buyer] = await Promise.all([
			createSeatingVenue(),
			createVerifiedUser('BAPaint')
		]);

		const category = await createPriceCategory(org.slug, venueId, { name: 'Galleria' }, org.owner);

		const sector = await api.post<{ id: string; seats: Array<{ id: string; label: string }> }>(
			`/api/organization-admin/${org.slug}/venues/${venueId}/sectors`,
			{
				name: 'Stalls',
				kind: 'seated',
				// Seat writes still use `row` (becomes `row_label` in the Phase-2 rename).
				seats: Array.from({ length: 8 }, (_, i) => ({
					label: `A${i + 1}`,
					row: 'A',
					number: i + 1
				}))
			}
		);
		const seatIds = sector.seats.map((s) => s.id);
		expect(seatIds).toHaveLength(8);

		// PAINT — raw PUT with the generated VenueSeatPaintSchema shape
		// ({ seat_ids, price_category_id }). This is the phase-2 endpoint that
		// finally lets a category own a seat pool without a re-seed.
		const painted = await api.put<{ painted: number }>(
			`/api/organization-admin/${org.slug}/venues/${venueId}/seats/paint`,
			{ seat_ids: seatIds, price_category_id: category.id }
		);
		expect(painted.painted).toBe(8);

		const event = await createTicketedEvent({
			owner: org.owner,
			orgSlug: org.slug,
			freeTier: false,
			event: { venue_id: venueId }
		});
		await deleteDefaultTier(event.id, org.owner); // auto "General Admission" trips strict mode
		// Pricing convergence: the tier names its sector, and its category_prices
		// keys DEFINE its sellable zones — painting + the map is what scopes the
		// pool to the category (the FK is gone).
		const tier = await createTicketTier(
			event.id,
			{
				name: 'Galleria',
				payment_method: 'free',
				price: '0.00',
				seat_assignment_mode: 'best_available',
				venue_id: venueId,
				sector_id: sector.id,
				category_prices: { [category.id]: '0.00' }
			},
			org.owner
		);

		const context = await browser.newContext();
		await authenticateContext(context, buyer);
		const page = await context.newPage();
		try {
			await gotoHydrated(page, event.path);
			await waitForClientAuth(page);
			await claimTwoBestAvailableFree(page, event, tier.name);

			// The two tickets carry an ADJACENT pair (same row, consecutive
			// numbers) drawn from the freshly-painted pool — the server-picked
			// best block, proving painting → pool → assignment end to end.
			const block = await ticketSeats(page, event.name, 2);
			expect(block[0].row).toBe(block[1].row);
			expect(Math.abs(block[0].number - block[1].number)).toBe(1);
		} finally {
			await context.close();
		}
	});

	test('standing sector capacity → UI purchase surfaces the 429 "sector is full"', async ({
		browser
	}) => {
		test.setTimeout(180_000);

		// Arrange (API): throwaway org + venue; a STANDING sector with a hard
		// capacity of 2 (no seats); a FREE GA tier (seat_assignment_mode 'none')
		// bound to it; two fresh fillers. The GA tier's own inventory
		// (total_quantity) stays high — the ONLY binding limit is the sector
		// capacity, which the backend enforces at checkout with a 429.
		const [{ org, api, venueId }, buyer, filler1, filler2] = await Promise.all([
			createSeatingVenue(),
			createVerifiedUser('Standing'),
			createVerifiedUser('Filler1'),
			createVerifiedUser('Filler2')
		]);

		const sector = await api.post<{ id: string }>(
			`/api/organization-admin/${org.slug}/venues/${venueId}/sectors`,
			{ name: 'Pit', kind: 'standing', capacity: 2 }
		);

		const event = await createTicketedEvent({
			owner: org.owner,
			orgSlug: org.slug,
			freeTier: false,
			event: { venue_id: venueId }
		});
		await deleteDefaultTier(event.id, org.owner);
		const tier = await createTicketTier(
			event.id,
			{
				name: 'Standing',
				payment_method: 'free',
				price: '0.00',
				seat_assignment_mode: 'none',
				total_quantity: 100,
				venue_id: venueId,
				sector_id: sector.id
			},
			org.owner
		);

		// Fill the 2-slot capacity via API claims (no seat_ids on a GA tier).
		await claimTicketViaApi(filler1, event.id, tier.id);
		await claimTicketViaApi(filler2, event.id, tier.id);

		const context = await browser.newContext();
		await authenticateContext(context, buyer);
		const page = await context.newPage();
		try {
			await gotoHydrated(page, event.path);
			await waitForClientAuth(page);

			// Bump the tier's inline quick-buy stepper to 1 and open the sheet
			// (idempotent loop). The tier is NOT sold out at the inventory level,
			// so the UI lets the buyer through — the backend's hard
			// sector-capacity check answers 429, whose detail ("This sector is
			// full.") lands in the checkout sheet's inline error alert.
			const tierCard = tierCardLocator(page, tier.name);
			const stepper = tierCard.getByRole('group', { name: `Quantity for ${tier.name}` });
			await expect(stepper).toBeVisible({ timeout: 15_000 });
			await stepper.getByRole('button', { name: `Add one ${tier.name}` }).click();
			await expect(stepper.locator('span[aria-live="polite"]')).toHaveText('1');

			const summaryBar = page.getByTestId('cart-summary-bar');
			const sheet = page.getByRole('dialog', { name: 'Checkout' });
			await expect(async () => {
				if (await sheet.isVisible()) return;
				await summaryBar.getByRole('button', { name: 'Buy', exact: true }).click();
				await expect(sheet).toBeVisible({ timeout: 8_000 });
			}).toPass({ timeout: 30_000 });
			await sheet.getByLabel('Name for ticket 1').fill('E2E Standing Buyer');

			await sheet.getByRole('button', { name: 'Claim', exact: true }).click();
			await expect(sheet.getByText('This sector is full.')).toBeVisible({
				timeout: 15_000
			});
		} finally {
			await context.close();
		}
	});
});

/**
 * Drive one 2-ticket best-available claim on a FREE tier: bump the tier
 * card's inline stepper to 2, open the sheet via the cart summary bar, fill
 * both guest names, then Claim. Idempotent loop on the final click — a
 * retried claim releases any stale block and re-holds server-side, so
 * retries stay hold-consistent. Mirrors best-available.spec.ts's
 * `claimBestAvailable` (wave 1).
 */
async function claimTwoBestAvailableFree(
	page: Page,
	event: CreatedEvent,
	tierName: string
): Promise<void> {
	const tierCard = tierCardLocator(page, tierName);
	const stepper = tierCard.getByRole('group', { name: `Quantity for ${tierName}` });
	await expect(stepper).toBeVisible({ timeout: 15_000 });

	const add = stepper.getByRole('button', { name: `Add one ${tierName}` });
	await add.click();
	await add.click();
	await expect(stepper.locator('span[aria-live="polite"]')).toHaveText('2');

	const summaryBar = page.getByTestId('cart-summary-bar');
	const sheet = page.getByRole('dialog', { name: 'Checkout' });
	await expect(async () => {
		if (await sheet.isVisible()) return;
		await summaryBar.getByRole('button', { name: 'Buy', exact: true }).click();
		await expect(sheet).toBeVisible({ timeout: 8_000 });
	}).toPass({ timeout: 30_000 });

	// No seat map/list ever renders for a best-available group — the server
	// picks the seats; the accessible opt-in stays available.
	await expect(sheet.getByText('Select Your Seats')).toBeHidden();
	await expect(sheet.getByText('STAGE')).toBeHidden();
	await expect(
		sheet.getByRole('checkbox', { name: 'I need wheelchair-accessible seats' })
	).toBeVisible();

	// Mapped tier (pricing convergence): the mandatory zone picker renders and
	// the single zone auto-selects once availability loads — the claim button
	// stays gated until then, so wait for the check before claiming.
	await expect(sheet.getByText('Seating zone', { exact: true })).toBeVisible();
	await expect(sheet.getByRole('radio', { name: /Galleria/ })).toBeChecked({
		timeout: 8_000
	});

	await sheet.getByLabel('Name for ticket 1').fill('E2E Guest One');
	await sheet.getByLabel('Name for ticket 2').fill('E2E Guest Two');

	// Claim: holds the best-available block, then the claim consumes it. On a
	// retry the confirm flow releases the stale block first, so no holds leak.
	const success = page.getByRole('dialog', { name: 'Your Ticket', exact: true });
	const claim = sheet.getByRole('button', { name: 'Claim', exact: true });
	await expect(async () => {
		if (await success.isVisible()) return;
		if (await claim.isVisible()) await claim.click();
		await expect(success).toBeVisible({ timeout: 10_000 });
	}).toPass({ timeout: 40_000 });
	await page.keyboard.press('Escape');
	await expect(success).toBeHidden();
}
