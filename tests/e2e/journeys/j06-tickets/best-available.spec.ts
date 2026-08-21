import type { Page } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import {
	createVerifiedUser,
	getSeededBestAvailableEvent,
	type SeededBestAvailableEvent
} from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J19.5 (USER_JOURNEYS.md) — best-available seating: on a BEST_AVAILABLE tier
// the server picks the seats, so there is never a seat map/picker for it —
// just the accessible-seats opt-in and (for a mapped tier) a mandatory zone
// choice. Confirming holds the best adjacent block and the claim consumes
// those live holds, so the tickets land with adjacent seats.
//
// #853 rewrite (wave 1, task 10): the legacy per-tier confirmation dialog is
// deleted. `best_available` is `quickBuyEligible` now (same as a plain GA
// tier), so it renders an inline stepper on the tier card — no dialog opens
// at all for it. The zone picker and accessible checkbox that used to live
// inside that dialog now live in the checkout sheet
// (`page.getByRole('dialog', { name: 'Checkout' })`, `CheckoutSheetGroup`),
// which any BA group forces open (`EventCart.needsSheet`) regardless of
// `require_ticket_names`. Best-available block holds now happen at CONFIRM
// time (Task 8's `holdBestAvailableGroups`, fired from the sheet's Reserve),
// not the moment the stepper moves — so the "adjacent block" and "different
// block on retry" properties are proven at Reserve, same server contract as
// before.
//
// Multi-purchase note: the buyer's tier list unmounts once they hold ANY
// ticket for the event (`+page.svelte`'s `!userTicket` gate, pre-dating
// #853), and the old "second purchase" leg relied on a `TicketTierModal`
// entry point that opened independently of that gate — deleted in #853's
// Task 9 with nothing replacing that capability (a real gap, flagged in this
// task's report). Rather than port the "same buyer buys twice" shape, the
// "second purchase gets different seats" property below is proven with a
// SECOND FRESH BUYER instead: the property under test is server-side (the
// allocator must not re-offer an already-consumed block), which doesn't
// depend on both purchases coming from the same identity.
//
// Isolation: painted price categories are seed-only (seats'
// default_price_category has no admin-API writer) and the showcase org owners
// are undiscoverable, so the spec runs buyer-side against the SHARED seeded
// "La Traviata — Season Opening" showcase event (Galleria: best_available,
// offline payment, ~570-seat painted pool — plenty of headroom for parallel
// runs). The offline tier reserves (no Stripe). Buyers are FRESH
// createVerifiedUser accounts: the event caps tickets at 4 per user, and a
// fresh identity per buyer sidesteps the multi-purchase gap above entirely.

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

/**
 * Drive one best-available claim on the seeded offline tier: bump the tier
 * card's stepper to `quantity`, open the sheet via the cart summary bar,
 * fill every guest-name slot (the sheet never prefills a name — see
 * cart-checkout-sheet.spec.ts), then Reserve. Idempotent retry on the final
 * click — a retried Reserve releases the stale block and re-holds
 * server-side, so retries stay hold-consistent.
 */
async function claimBestAvailable(
	page: Page,
	seeded: SeededBestAvailableEvent,
	quantity: number
): Promise<void> {
	const tierCard = tierCardLocator(page, seeded.tier.name);
	const stepper = tierCard.getByRole('group', { name: `Quantity for ${seeded.tier.name}` });
	await expect(stepper).toBeVisible({ timeout: 15_000 });

	// No seat-picker entry point exists for a best_available tier — it's
	// quickBuyEligible now, same shape as a plain GA tier.
	await expect(tierCard.getByRole('button', { name: 'Pick seats…' })).toHaveCount(0);

	const add = stepper.getByRole('button', { name: `Add one ${seeded.tier.name}` });
	for (let i = 0; i < quantity; i++) {
		await add.click();
	}
	await expect(stepper.locator('span[aria-live="polite"]')).toHaveText(String(quantity));

	const summaryBar = page.getByTestId('cart-summary-bar');
	await summaryBar.getByRole('button', { name: 'Buy', exact: true }).click();

	const sheet = page.getByRole('dialog', { name: 'Checkout' });
	await expect(sheet).toBeVisible();

	// No seat map/list ever renders for a best-available group in the sheet —
	// the server picks the seats.
	await expect(sheet.getByText('Select Your Seats')).toBeHidden();
	await expect(sheet.getByText('STAGE')).toBeHidden();
	await expect(
		sheet.getByRole('checkbox', { name: 'I need wheelchair-accessible seats' })
	).toBeVisible();

	// Pricing convergence: Galleria is a MAPPED single-zone tier, so the zone
	// picker renders (the zone is mandatory — no server default) and the only
	// zone auto-selects client-side once availability loads.
	await expect(sheet.getByText('Seating zone', { exact: true })).toBeVisible();
	const zoneRadio = sheet.getByRole('radio', { name: /Galleria/ });
	await expect(zoneRadio).toBeChecked({ timeout: 8_000 });

	for (let i = 1; i <= quantity; i++) {
		await sheet.getByLabel(`Name for ticket ${i}`).fill(`E2E Guest ${i}`);
	}

	// Reserve: holds the best-available block at confirm time, then the claim
	// consumes it. On a retry the confirm flow releases the stale block first,
	// so no holds leak.
	const success = page.getByRole('dialog', { name: 'Your Ticket', exact: true });
	const reserve = sheet.getByRole('button', { name: 'Reserve', exact: true });
	// The batch checkout has been measured at ~11s against this 1400-seat venue
	// under parallel load, and the success modal opens 500ms after it resolves —
	// so the wait must span the in-flight request, not race it. Once the request
	// lands the sheet closes, taking Reserve with it, so a blind re-click would
	// hang on a button that no longer exists and burn the whole budget.
	await expect(async () => {
		if (await success.isVisible()) return;
		if (await reserve.isVisible()) await reserve.click({ timeout: 5_000 });
		await expect(success).toBeVisible({ timeout: 25_000 });
	}).toPass({ timeout: 60_000 });
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
	test('no seat map at checkout, adjacent block; a second buyer gets a different block', async ({
		browser
	}) => {
		test.setTimeout(180_000);

		const seeded = await getSeededBestAvailableEvent();

		const buyer1 = await createVerifiedUser('BestAvail1');
		const context1 = await browser.newContext();
		const buyer2 = await createVerifiedUser('BestAvail2');
		const context2 = await browser.newContext();
		try {
			await authenticateContext(context1, buyer1);
			const page1 = await context1.newPage();
			await gotoHydrated(page1, seeded.eventPath);
			await waitForClientAuth(page1);
			await claimBestAvailable(page1, seeded, 2);

			// Two tickets carry an ADJACENT pair (same row, consecutive numbers)
			// from the painted pool — the server-picked block.
			const firstBlock = await ticketSeats(page1, seeded.eventName, 2);
			expect(firstBlock[0].row).toBe(firstBlock[1].row);
			expect(Math.abs(firstBlock[0].number - firstBlock[1].number)).toBe(1);

			// A second, independent buyer claims the same tier: the first
			// block's holds were consumed into sold tickets, so the server must
			// pick a DIFFERENT block for the new buyer.
			await authenticateContext(context2, buyer2);
			const page2 = await context2.newPage();
			await gotoHydrated(page2, seeded.eventPath);
			await waitForClientAuth(page2);
			await claimBestAvailable(page2, seeded, 2);

			const secondBlock = await ticketSeats(page2, seeded.eventName, 2);
			expect(secondBlock[0].row).toBe(secondBlock[1].row);
			expect(Math.abs(secondBlock[0].number - secondBlock[1].number)).toBe(1);

			const firstLabels = new Set(firstBlock.map((s) => `${s.row}-${s.number}`));
			const secondLabels = new Set(secondBlock.map((s) => `${s.row}-${s.number}`));
			for (const label of secondLabels) {
				expect(firstLabels.has(label)).toBe(false);
			}
		} finally {
			await context1.close();
			await context2.close();
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
		const page = await context.newPage();
		try {
			await authenticateContext(context, buyer);
			await gotoHydrated(page, seeded.eventPath);
			await waitForClientAuth(page);

			const tierCard = tierCardLocator(page, seeded.tier.name);
			const stepper = tierCard.getByRole('group', { name: `Quantity for ${seeded.tier.name}` });
			await expect(stepper).toBeVisible({ timeout: 15_000 });
			// Quantity stays at the default 1 — the zone gate is the point.
			await stepper.getByRole('button', { name: `Add one ${seeded.tier.name}` }).click();
			await expect(stepper.locator('span[aria-live="polite"]')).toHaveText('1');

			const summaryBar = page.getByTestId('cart-summary-bar');
			await summaryBar.getByRole('button', { name: 'Buy', exact: true }).click();

			const sheet = page.getByRole('dialog', { name: 'Checkout' });
			await expect(sheet).toBeVisible();

			// Names are required on this seeded event too — fill it FIRST so the
			// zone becomes the actual (only) blocking reason below (the sheet
			// checks names before zone within a group).
			await sheet.getByLabel('Name for ticket 1').fill('E2E Zone Buyer');

			const zonePicker = sheet.getByText('Seating zone', { exact: true });
			await expect(zonePicker).toBeVisible({ timeout: 8_000 });

			// Both zones render with their prices; with two zones nothing
			// auto-selects and the confirm is gated on the choice.
			const premiumZone = sheet.getByRole('radio', { name: /Platea Premium/ });
			const stallsZone = sheet.getByRole('radio', { name: /^(?!.*Premium).*Platea/ });
			await expect(premiumZone).toBeVisible();
			await expect(stallsZone).toBeVisible();
			await expect(premiumZone).not.toBeChecked();
			await expect(stallsZone).not.toBeChecked();
			await expect(sheet.getByText('€80.00')).toBeVisible();
			await expect(sheet.getByText('€45.00')).toBeVisible();
			const reserve = sheet.getByRole('button', { name: 'Reserve', exact: true });
			await expect(reserve).toBeDisabled();
			await expect(sheet.getByText('Choose a seating zone to continue')).toBeVisible();

			// Pick the cheaper zone and reserve (idempotent loop — a retried click
			// releases the stale block and re-holds server-side).
			await stallsZone.check();
			await expect(reserve).toBeEnabled();
			const success = page.getByRole('dialog', { name: 'Your Ticket', exact: true });
			// Same slow-checkout race as claimBestAvailable — see the note there.
			await expect(async () => {
				if (await success.isVisible()) return;
				if (await reserve.isVisible()) await reserve.click({ timeout: 5_000 });
				await expect(success).toBeVisible({ timeout: 25_000 });
			}).toPass({ timeout: 60_000 });

			// The pending offline reservation carries the CHOSEN zone's price —
			// €45.00, not the premium €80.00 and not a fallback.
			await expect(success.getByText('Amount due: €45.00')).toBeVisible();
			await expect(success.getByText(SEAT_RE)).toBeVisible();
		} finally {
			await context.close();
		}
	});
});
