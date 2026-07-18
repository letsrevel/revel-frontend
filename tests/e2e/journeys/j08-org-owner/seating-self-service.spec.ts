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
//   is full.") surfaced in the confirmation dialog's error alert.
//
// Isolation: every run arranges its own org/venue/event, so parallel workers
// and reruns never collide.

const SEAT_RE = /Row ([A-Z0-9]+), Seat (\d+)/;

interface SeatRef {
	row: string;
	number: number;
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
		const tier = await createTicketTier(
			event.id,
			{
				name: 'Galleria',
				payment_method: 'free',
				price: '0.00',
				seat_assignment_mode: 'best_available',
				price_category_id: category.id
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

			// Reach the confirmation dialog (idempotent loop) and attempt the
			// claim. The tier is NOT sold out at the inventory level, so the UI
			// lets the buyer through — the backend's hard sector-capacity check
			// answers 429, whose detail ("This sector is full.") lands in the
			// dialog's destructive error alert.
			const tierDialog = page.getByRole('dialog', { name: 'Select Your Ticket' });
			const confirmDialog = page.getByRole('dialog', { name: 'Claim Free Ticket' });
			await expect(async () => {
				if (await confirmDialog.isVisible()) return;
				if (!(await tierDialog.isVisible())) {
					await page.getByRole('button', { name: 'Get Tickets', exact: true }).click();
				}
				await tierDialog.getByRole('button', { name: 'Claim Free Ticket' }).click();
				await expect(confirmDialog).toBeVisible({ timeout: 8_000 });
			}).toPass({ timeout: 60_000 });

			await confirmDialog.getByRole('button', { name: 'Claim Ticket', exact: true }).click();
			await expect(confirmDialog.getByText('This sector is full.')).toBeVisible({
				timeout: 15_000
			});
		} finally {
			await context.close();
		}
	});
});

/**
 * Drive one 2-ticket best-available claim on a FREE tier: entry button → tier
 * dialog → confirmation dialog (asserting the no-map best-available UI) →
 * quantity 2 (both guest names) → claim → success modal. Idempotent loops
 * throughout — a retried claim releases any stale block and re-holds
 * server-side, so retries stay hold-consistent.
 */
async function claimTwoBestAvailableFree(
	page: Page,
	event: CreatedEvent,
	tierName: string
): Promise<void> {
	const tierDialog = page.getByRole('dialog', { name: 'Select Your Ticket' });
	const tierCard = tierDialog
		.locator('.bg-card')
		.filter({ has: page.getByRole('heading', { name: tierName, exact: true }) });
	const confirmDialog = page.getByRole('dialog', { name: 'Claim Free Ticket' });
	const bestPanel = confirmDialog.getByText('Best available seats');
	await expect(async () => {
		if (await bestPanel.isVisible()) return;
		if (!(await tierDialog.isVisible())) {
			await page.getByRole('button', { name: 'Get Tickets', exact: true }).click();
		}
		await tierCard.getByRole('button', { name: 'Claim Free Ticket' }).click();
		await expect(bestPanel).toBeVisible({ timeout: 8_000 });
	}).toPass({ timeout: 60_000 });

	// Best-available UI: auto-assignment panel + accessible-seats opt-in, NO
	// seat grid (the server picks).
	await expect(
		confirmDialog.getByText('Your seats will be assigned automatically', { exact: false })
	).toBeVisible();
	await expect(
		confirmDialog.getByRole('checkbox', { name: 'I need wheelchair-accessible seats' })
	).toBeVisible();
	await expect(confirmDialog.getByText('Select Your Seats')).toBeHidden();
	await expect(confirmDialog.getByText('STAGE')).toBeHidden();

	// Quantity 2 — the second guest-name input appears; the first is prefilled
	// with the buyer's profile name but re-filled when empty (canSubmit requires
	// every name once quantity > 1).
	await confirmDialog.getByRole('button', { name: 'Increase quantity' }).click();
	await expect(confirmDialog.getByText('Ticket Holders', { exact: true })).toBeVisible();
	const firstGuest = confirmDialog.getByPlaceholder('Your name');
	if ((await firstGuest.inputValue()).trim() === '') {
		await firstGuest.fill('E2E Guest One');
	}
	await confirmDialog.getByPlaceholder('Guest 2 name').fill('E2E Guest Two');

	// Claim: holds the best-available block, then the claim consumes it. On a
	// retry the dialog releases the stale block first, so no holds leak.
	const success = page.getByRole('dialog', { name: 'Your Ticket', exact: true });
	const claim = confirmDialog.getByRole('button', { name: 'Claim Ticket', exact: true });
	await expect(async () => {
		if (await success.isVisible()) return;
		await claim.click();
		await expect(success).toBeVisible({ timeout: 10_000 });
	}).toPass({ timeout: 40_000 });
	await page.keyboard.press('Escape');
	await expect(success).toBeHidden();
}
