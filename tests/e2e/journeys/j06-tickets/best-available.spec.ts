import type { Page } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import {
	createVerifiedUser,
	getSeededBestAvailableEvent,
	type SeededBestAvailableEvent
} from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J19.5 (USER_JOURNEYS.md) — best-available seating at checkout: on a
// BEST_AVAILABLE tier the server picks the seats, so the checkout dialog shows
// NO seat map — just the best-available panel with the accessible-seats
// opt-in. Confirming holds the best adjacent block and the claim consumes
// those live holds, so the tickets land with adjacent seats and a second
// identical purchase gets a DIFFERENT block.
//
// Isolation: painted price categories are seed-only (seats'
// default_price_category has no admin-API writer) and the showcase org owners
// are undiscoverable, so the spec runs buyer-side against the SHARED seeded
// "La Traviata — Season Opening" showcase event (Galleria: best_available,
// offline payment, ~570-seat painted pool — plenty of headroom for parallel
// runs). The offline tier claims a reservation (no Stripe). Buyer is a FRESH
// createVerifiedUser: the event caps tickets at 4 per user, which exactly fits
// the 2+2 purchases and makes every run start from a clean per-user quota.

const SEAT_RE = /Row ([A-Z0-9]+), Seat (\d+)/;

interface SeatRef {
	row: string;
	number: number;
}

/**
 * Drive one 2-ticket best-available claim on the seeded offline tier: entry
 * button → tier dialog (the event has THREE offline tiers, so the Reserve
 * button is scoped to the best-available tier's card) → confirmation dialog
 * (asserting the no-map best-available UI) → quantity 2 → reserve → success
 * modal. Idempotent loops throughout — a retried Reserve click releases the
 * stale block and re-holds server-side, so retries stay hold-consistent.
 */
async function claimTwoBestAvailable(
	page: Page,
	seeded: SeededBestAvailableEvent,
	entryButton: string
): Promise<void> {
	const tierDialog = page.getByRole('dialog', { name: 'Select Your Ticket' });
	// All three La Traviata tiers are offline ("Reserve Ticket" buttons), so
	// scope to the card whose heading is the best-available tier's name.
	const tierCard = tierDialog
		.locator('.bg-card')
		.filter({ has: page.getByRole('heading', { name: seeded.tier.name, exact: true }) });
	const confirmDialog = page.getByRole('dialog', { name: 'Reserve Ticket' });
	const bestPanel = confirmDialog.getByText('Best available seats');
	await expect(async () => {
		if (await bestPanel.isVisible()) return;
		if (!(await tierDialog.isVisible())) {
			await page
				.getByRole('button', { name: entryButton, exact: true })
				.filter({ visible: true })
				.first()
				.click();
		}
		await tierCard.getByRole('button', { name: 'Reserve Ticket' }).click();
		await expect(bestPanel).toBeVisible({ timeout: 8_000 });
	}).toPass({ timeout: 60_000 });

	// Best-available UI: auto-assignment panel + accessible-seats opt-in, and
	// NO seat grid (no picker heading, no stage marker) — the server picks.
	await expect(
		confirmDialog.getByText('Your seats will be assigned automatically', { exact: false })
	).toBeVisible();
	await expect(
		confirmDialog.getByRole('checkbox', { name: 'I need wheelchair-accessible seats' })
	).toBeVisible();
	await expect(confirmDialog.getByText('Select Your Seats')).toBeHidden();
	await expect(confirmDialog.getByText('STAGE')).toBeHidden();

	// Pricing convergence: Galleria is a MAPPED single-zone tier, so the zone
	// picker renders (the zone is mandatory — no server default) and the only
	// zone auto-selects client-side once availability loads.
	await expect(confirmDialog.getByText('Seating zone', { exact: true })).toBeVisible();
	const zoneRadio = confirmDialog.getByRole('radio', { name: /Galleria/ });
	await expect(zoneRadio).toBeChecked({ timeout: 8_000 });

	// Quantity 2 — the second guest-name input appears; the first is prefilled
	// with the buyer's profile name but is re-filled when empty (defensive:
	// canSubmit requires every name once quantity > 1).
	await confirmDialog.getByRole('button', { name: 'Increase quantity' }).click();
	await expect(confirmDialog.getByText('Ticket Holders', { exact: true })).toBeVisible();
	const firstGuest = confirmDialog.getByPlaceholder('Your name');
	if ((await firstGuest.inputValue()).trim() === '') {
		await firstGuest.fill('E2E Guest One');
	}
	await confirmDialog.getByPlaceholder('Guest 2 name').fill('E2E Guest Two');

	// Reserve: holds the best-available block, then the claim consumes it. On
	// a retry the dialog releases the stale block first, so no holds leak.
	const success = page.getByRole('dialog', { name: 'Your Ticket', exact: true });
	const reserve = confirmDialog.getByRole('button', { name: 'Reserve Ticket', exact: true });
	await expect(async () => {
		if (await success.isVisible()) return;
		await reserve.click();
		await expect(success).toBeVisible({ timeout: 10_000 });
	}).toPass({ timeout: 40_000 });
	await page.keyboard.press('Escape');
	await expect(success).toBeHidden();
}

/**
 * Read the buyer's seats for the seeded event from the my-tickets UI: search
 * by the event name (defensive scoping), wait for exactly `expected` results,
 * then open each card's "View Ticket" modal — the list cards themselves show
 * no seat info; the modal renders the "Venue • Sector • Row X, Seat N" line
 * (pending offline reservations included).
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

test.describe('J19 best available @p2', () => {
	test('no seat map at checkout → adjacent block → second purchase gets different seats', async ({
		browser
	}) => {
		test.setTimeout(180_000);

		// Shared seeded showcase event + fresh buyer (see header comment).
		const [seeded, buyer] = await Promise.all([
			getSeededBestAvailableEvent(),
			createVerifiedUser('BestAvail')
		]);

		const context = await browser.newContext();
		await authenticateContext(context, buyer);
		const page = await context.newPage();
		try {
			await gotoHydrated(page, seeded.eventPath);
			await waitForClientAuth(page);
			await claimTwoBestAvailable(page, seeded, 'Get Tickets');

			// The two tickets carry an ADJACENT pair (same row, consecutive
			// numbers) from the painted pool — the server-picked block.
			const firstBlock = await ticketSeats(page, seeded.eventName, 2);
			expect(firstBlock[0].row).toBe(firstBlock[1].row);
			expect(Math.abs(firstBlock[0].number - firstBlock[1].number)).toBe(1);

			// Second identical purchase: the first block's holds were consumed
			// into sold tickets, so the server must pick a DIFFERENT block.
			await gotoHydrated(page, seeded.eventPath);
			await waitForClientAuth(page);
			await claimTwoBestAvailable(page, seeded, 'Buy More Tickets');

			const allSeats = await ticketSeats(page, seeded.eventName, 4);
			const firstLabels = new Set(firstBlock.map((s) => `${s.row}-${s.number}`));
			const newSeats = allSeats.filter((s) => !firstLabels.has(`${s.row}-${s.number}`));
			expect(newSeats).toHaveLength(2);
			expect(new Set(allSeats.map((s) => `${s.row}-${s.number}`)).size).toBe(4);
		} finally {
			await context.close();
		}
	});

	// Pricing convergence: "Platea — Best Available" prices TWO zones in one
	// tier (Platea Premium €80 / Platea €45), so the buyer's zone decides both
	// the seat pool and the price. The zone is mandatory: with two zones nothing
	// auto-selects, the confirm stays gated until one is chosen, and the
	// reserved pending ticket must carry the CHOSEN zone's price — display
	// price === charged price, end to end.
	test('multi-zone best available: zone picker gates confirm and the chosen zone decides the price', async ({
		browser
	}) => {
		test.setTimeout(180_000);

		const [seeded, buyer] = await Promise.all([
			getSeededBestAvailableEvent('Platea — Best Available'),
			createVerifiedUser('ZonePick')
		]);

		const context = await browser.newContext();
		await authenticateContext(context, buyer);
		const page = await context.newPage();
		try {
			await gotoHydrated(page, seeded.eventPath);
			await waitForClientAuth(page);

			const tierDialog = page.getByRole('dialog', { name: 'Select Your Ticket' });
			const tierCard = tierDialog
				.locator('.bg-card')
				.filter({ has: page.getByRole('heading', { name: seeded.tier.name, exact: true }) });
			const confirmDialog = page.getByRole('dialog', { name: 'Reserve Ticket' });
			const zonePicker = confirmDialog.getByText('Seating zone', { exact: true });
			await expect(async () => {
				if (await zonePicker.isVisible()) return;
				if (!(await tierDialog.isVisible())) {
					await page
						.getByRole('button', { name: 'Get Tickets', exact: true })
						.filter({ visible: true })
						.first()
						.click();
				}
				await tierCard.getByRole('button', { name: 'Reserve Ticket' }).click();
				await expect(zonePicker).toBeVisible({ timeout: 8_000 });
			}).toPass({ timeout: 60_000 });

			// Both zones render with their prices; with two zones nothing
			// auto-selects and the confirm is gated on the choice.
			const premiumZone = confirmDialog.getByRole('radio', { name: /Platea Premium/ });
			const stallsZone = confirmDialog.getByRole('radio', { name: /^(?!.*Premium).*Platea/ });
			await expect(premiumZone).toBeVisible();
			await expect(stallsZone).toBeVisible();
			await expect(premiumZone).not.toBeChecked();
			await expect(stallsZone).not.toBeChecked();
			await expect(confirmDialog.getByText('€80.00')).toBeVisible();
			await expect(confirmDialog.getByText('€45.00')).toBeVisible();
			const reserve = confirmDialog.getByRole('button', { name: 'Reserve Ticket', exact: true });
			await expect(reserve).toBeDisabled();
			await expect(confirmDialog.getByText('Choose a seating zone to continue')).toBeVisible();

			// Pick the cheaper zone and reserve (idempotent loop — a retried click
			// releases the stale block and re-holds server-side).
			await stallsZone.check();
			await expect(reserve).toBeEnabled();
			const success = page.getByRole('dialog', { name: 'Your Ticket', exact: true });
			await expect(async () => {
				if (await success.isVisible()) return;
				await reserve.click();
				await expect(success).toBeVisible({ timeout: 10_000 });
			}).toPass({ timeout: 40_000 });

			// The pending offline reservation carries the CHOSEN zone's price —
			// €45.00, not the premium €80.00 and not a fallback.
			await expect(success.getByText('Amount due: €45.00')).toBeVisible();
			await expect(success.getByText(SEAT_RE)).toBeVisible();
		} finally {
			await context.close();
		}
	});
});
