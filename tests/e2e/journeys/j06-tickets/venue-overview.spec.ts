import { test, expect } from '../../support/fixtures';
import {
	createTicketedEvent,
	createTicketTier,
	createVerifiedUser,
	deleteDefaultTier,
	getSeededBestAvailableEvent,
	uniqueName
} from '../../support/factories';
import { PERSONAS } from '../../support/personas';
import { ApiClient } from '../../support/api';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import type { Page } from '@playwright/test';

// #679 — map-first tier selection: the public event page grows a "View
// seating map" entry point that opens a whole-venue overview where every
// sector shows which tier(s) sell it at what price. A 1:1 sector routes
// STRAIGHT into that tier (no chooser); a 1:N sector (Platea — sold by a flat
// user_choice tier AND a category-priced best-available tier) opens a small
// chooser first. A sector sold by EXACTLY ONE user_choice tier (Palco 1)
// renders its seats DIRECTLY selectable in the overview (seating phase 2):
// taps are real server holds, and Continue hands them straight to the cart.
// Sectors sold by no purchasable tier (Palco 2–4) render as inert
// not-for-sale ghosts.
//
// #853 rewrite (wave 2, task 11): the legacy `TicketConfirmationDialog` (title
// "Reserve Ticket") and `TicketTierModal` (title "Select Your Ticket") this
// file used to route into are both deleted — the overview now hands off into
// the cart-flow surfaces instead: `handleSelectTier` in +page.svelte either
// (a) adopts already-held `user_choice` seats straight into a cart group via
// `cart.setSeatIds` (no picker — the "Continue" hand-off path), (b) opens
// `SeatPickerDialog` (testid `seat-picker-dialog`, "Pick seats — {tier}") for
// an UNHELD `user_choice` tier picked from the 1:N chooser, or (c) bumps the
// tier's inline quick-buy stepper to 1 and scrolls to it, for `best_available`
// / GA tiers (both are `quickBuyEligible` now — no dialog opens for them at
// all). See best-available.spec.ts / seat-selection.spec.ts (wave 1) for the
// full picker/stepper contract this file hands off into.
//
// Isolation: the first and third tests run read-only against the SHARED
// seeded "La Traviata — Season Opening" showcase event (see
// best-available.spec.ts) — dialogs are opened and closed but nothing is
// ever held or reserved, so parallel specs are unaffected. The seat-holding
// and cross-sector-switch tests arrange their OWN throwaway venues + events
// instead. The seeded venue has NO stage metadata, so the overview shows the
// fallback top-center STAGE pill (expected, not a bug).

function tierCardLocator(page: Page, tierName: string) {
	// `div.bg-card`, NOT bare `.bg-card` — TicketTierList's wrapping <section>
	// carries the class too, so a bare class filter matches both the section
	// and the one PricingCard whose heading it contains. The tag discriminates:
	// only PricingCard's root is a <div>.
	return page
		.locator('div.bg-card')
		.filter({ has: page.getByRole('heading', { name: tierName, exact: true }) });
}

test.describe('J6 map-first venue overview @p2', () => {
	test('seating map entry → sector overview → 1:1 direct route → 1:N chooser', async ({
		browser
	}) => {
		test.setTimeout(180_000);

		const [seeded, buyer] = await Promise.all([
			getSeededBestAvailableEvent(),
			createVerifiedUser('MapFirst')
		]);

		const context = await browser.newContext();
		await authenticateContext(context, buyer);
		const page = await context.newPage();
		try {
			await gotoHydrated(page, seeded.eventPath);
			await waitForClientAuth(page);

			const overview = page.getByRole('dialog', { name: 'Seating map' });
			const openMap = page.getByRole('button', { name: 'View seating map', exact: true });
			// Sector targets carry the selling tier(s) + price(s) in their names.
			const galleriaSector = overview.getByRole('button', {
				name: 'Galleria: Galleria, EUR 25.00'
			});
			const plateaSector = overview.getByRole('button', {
				name: 'Platea: Platea, EUR 45.00; Platea — Best Available, EUR 45.00 - EUR 80.00'
			});

			// Open the overview from the Ticket Options entry point.
			await expect(async () => {
				if (await overview.isVisible()) return;
				await openMap.click();
				await expect(overview).toBeVisible({ timeout: 8_000 });
			}).toPass({ timeout: 60_000 });

			// Every sector renders: target sectors as focusable buttons, the
			// single-user_choice Palco 1 as DIRECTLY selectable seats (no
			// whole-sector target), the unsold Palchi as inert ghosts, plus the
			// fallback STAGE pill.
			await expect(galleriaSector).toBeVisible({ timeout: 15_000 });
			await expect(plateaSector).toBeVisible();
			await expect(overview.getByRole('button', { name: /^Palco 1:/ })).toBeHidden();
			await expect(overview.getByRole('button', { name: /^Seat 1-1/ })).toBeVisible();
			await expect(
				overview.getByRole('img', { name: 'Palco 2: no tickets on sale' })
			).toBeVisible();
			await expect(overview.getByRole('button', { name: /^Palco 2/ })).toBeHidden();
			await expect(overview.getByText('STAGE')).toBeVisible();

			// Galleria is sold by ONE best_available tier → routes DIRECTLY into
			// the cart: no dialog opens, the overview closes, the tier's own
			// inline quick-buy stepper on the page bumps to 1.
			const galleriaCard = tierCardLocator(page, 'Galleria');
			const galleriaStepper = galleriaCard.getByRole('group', { name: 'Quantity for Galleria' });
			await expect(async () => {
				if (
					await galleriaStepper
						.locator('span[aria-live="polite"]')
						.filter({ hasText: '1' })
						.isVisible()
				) {
					return;
				}
				if (!(await overview.isVisible())) {
					await openMap.click();
					await expect(overview).toBeVisible({ timeout: 8_000 });
				}
				await galleriaSector.click();
				await expect(overview).toBeHidden({ timeout: 8_000 });
				await expect(galleriaStepper.locator('span[aria-live="polite"]')).toHaveText('1', {
					timeout: 8_000
				});
			}).toPass({ timeout: 60_000 });

			// Reset the stepper back to 0 so it doesn't linger in the cart while
			// the Platea leg below runs (this spec never buys anything).
			await galleriaStepper.getByRole('button', { name: 'Remove one Galleria' }).click();
			await expect(galleriaStepper.locator('span[aria-live="polite"]')).toHaveText('0');

			// Platea is sold by TWO tiers → the chooser lists BOTH with their
			// honest prices and a seat-assignment mode hint.
			const chooser = page.getByRole('dialog', { name: 'Choose a ticket for Platea' });
			await expect(async () => {
				if (await chooser.isVisible()) return;
				if (!(await overview.isVisible())) {
					await openMap.click();
					await expect(overview).toBeVisible({ timeout: 8_000 });
				}
				await plateaSector.click();
				await expect(chooser).toBeVisible({ timeout: 8_000 });
			}).toPass({ timeout: 60_000 });

			const flatOption = chooser.getByRole('button', { name: /^Platea EUR 45\.00/ });
			const bestOption = chooser.getByRole('button', {
				name: /^Platea — Best Available EUR 45\.00 - EUR 80\.00/
			});
			await expect(flatOption).toBeVisible();
			await expect(flatOption).toContainText('Choose your own seats');
			await expect(bestOption).toBeVisible();
			await expect(bestOption).toContainText('Best available seats assigned');

			// Picking the flat (user_choice) option routes into the SEAT PICKER —
			// it has no held seats yet, so there is nothing to adopt directly.
			const picker = page.getByTestId('seat-picker-dialog');
			await expect(async () => {
				if (await picker.isVisible()) return;
				if (await flatOption.isVisible()) await flatOption.click();
				await expect(picker).toBeVisible({ timeout: 8_000 });
			}).toPass({ timeout: 60_000 });
			await expect(picker.getByRole('heading', { name: 'Pick seats — Platea' })).toBeVisible();
			await page.keyboard.press('Escape');
			await expect(picker).toBeHidden();

			// Picking the best-available option instead routes like Galleria: the
			// mapped tier bumps its own quick-buy stepper to 1, no dialog opens.
			const bestStepper = tierCardLocator(page, 'Platea — Best Available').getByRole('group', {
				name: 'Quantity for Platea — Best Available'
			});
			await expect(async () => {
				if (
					await bestStepper.locator('span[aria-live="polite"]').filter({ hasText: '1' }).isVisible()
				) {
					return;
				}
				if (!(await chooser.isVisible())) {
					if (!(await overview.isVisible())) {
						await openMap.click();
						await expect(overview).toBeVisible({ timeout: 8_000 });
					}
					await plateaSector.click();
					await expect(chooser).toBeVisible({ timeout: 8_000 });
				}
				await bestOption.click();
				await expect(overview).toBeHidden({ timeout: 8_000 });
				await expect(bestStepper.locator('span[aria-live="polite"]')).toHaveText('1', {
					timeout: 8_000
				});
			}).toPass({ timeout: 60_000 });
			await bestStepper.getByRole('button', { name: 'Remove one Platea — Best Available' }).click();
			await expect(bestStepper.locator('span[aria-live="polite"]')).toHaveText('0');
		} finally {
			await context.close();
		}
	});

	// Seat-level selection in the overview (seating phase 2): a sector sold by
	// exactly one user_choice tier renders live seats; two taps grow the
	// selection WITHOUT any stepper, the footer shows count + estimated total,
	// and Continue hands the SAME server holds straight into the cart
	// (`cart.setSeatIds` — no picker dialog opens for an already-held pick):
	// the tier card grows a "N seats · edit" badge and the sticky
	// `CartSummaryBar` totals it, and Buy completes the purchase directly.
	//
	// Isolation: own venue + event, `require_ticket_names: false` (wave-1
	// convention — keeps this test's assertions on the direct-buy path rather
	// than also exercising the checkout sheet, which is best-available.spec.ts
	// and cart-checkout-sheet.spec.ts's territory). The taps place REAL server
	// holds, so the shared seeded showcase must not be touched.
	test('overview seat taps → footer count/total → Continue adopts into the cart → Buy → tickets', async ({
		browser
	}) => {
		test.setTimeout(180_000);

		const owner = await ApiClient.login(PERSONAS.owner.email, PERSONAS.owner.password);
		const venue = await owner.post<{ id: string }>(
			'/api/organization-admin/revel-events-collective/venues',
			{ name: uniqueName('Overview Venue') }
		);
		const pickable = await owner.post<{ id: string }>(
			`/api/organization-admin/revel-events-collective/venues/${venue.id}/sectors`,
			{
				name: 'Picker Stalls',
				kind: 'seated',
				// Seat writes still use `row` (becomes `row_label` in the Phase-2 rename).
				seats: [
					{ label: 'A1', row: 'A', number: 1 },
					{ label: 'A2', row: 'A', number: 2 },
					{ label: 'A3', row: 'A', number: 3 }
				]
			}
		);
		const assigned = await owner.post<{ id: string }>(
			`/api/organization-admin/revel-events-collective/venues/${venue.id}/sectors`,
			{
				name: 'Assigned Balcony',
				kind: 'seated',
				seats: [
					{ label: 'B1', row: 'B', number: 1 },
					{ label: 'B2', row: 'B', number: 2 }
				]
			}
		);
		const [event, buyer] = await Promise.all([
			createTicketedEvent({
				freeTier: false,
				event: { venue_id: venue.id, require_ticket_names: false }
			}),
			createVerifiedUser('OverviewSeats')
		]);
		await deleteDefaultTier(event.id);
		const tier = await createTicketTier(event.id, {
			name: 'Pick Seats',
			payment_method: 'offline',
			price: '20.00',
			seat_assignment_mode: 'user_choice',
			venue_id: venue.id,
			sector_id: pickable.id,
			max_tickets_per_user: 4
		});
		await createTicketTier(event.id, {
			name: 'Rear Best',
			payment_method: 'offline',
			price: '30.00',
			seat_assignment_mode: 'best_available',
			venue_id: venue.id,
			sector_id: assigned.id
		});

		const context = await browser.newContext();
		await authenticateContext(context, buyer);
		const page = await context.newPage();
		try {
			await gotoHydrated(page, event.path);
			await waitForClientAuth(page);

			const overview = page.getByRole('dialog', { name: 'Seating map' });
			const openMap = page.getByRole('button', { name: 'View seating map', exact: true });
			await expect(async () => {
				if (await overview.isVisible()) return;
				await openMap.click();
				await expect(overview).toBeVisible({ timeout: 8_000 });
			}).toPass({ timeout: 60_000 });

			// The best-available sector stays a whole-sector target; the
			// user_choice sector renders its live seats instead of a target.
			await expect(
				overview.getByRole('button', { name: 'Assigned Balcony: Rear Best, EUR 30.00' })
			).toBeVisible({ timeout: 15_000 });
			await expect(overview.getByRole('button', { name: /^Picker Stalls:/ })).toBeHidden();

			// Tap A1 then A2 — real holds, no stepper anywhere: the footer count
			// and the estimated total (flat 20.00 × seats) grow tap by tap. Only
			// click while unpressed (a second tap would RELEASE the hold).
			const seatA1 = overview.getByRole('button', { name: /^Seat A1(,|$)/ });
			const seatA2 = overview.getByRole('button', { name: /^Seat A2(,|$)/ });
			await expect(async () => {
				if ((await seatA1.getAttribute('aria-pressed')) !== 'true') {
					await seatA1.click();
				}
				await expect(seatA1).toHaveAttribute('aria-pressed', 'true', { timeout: 5_000 });
				await expect(overview.getByText('1 seat selected')).toBeVisible({ timeout: 5_000 });
				await expect(overview.getByText('€20.00')).toBeVisible();
			}).toPass({ timeout: 60_000 });
			await expect(async () => {
				if ((await seatA2.getAttribute('aria-pressed')) !== 'true') {
					await seatA2.click();
				}
				await expect(seatA2).toHaveAttribute('aria-pressed', 'true', { timeout: 5_000 });
				await expect(overview.getByText('2 seats selected')).toBeVisible({ timeout: 5_000 });
				await expect(overview.getByText('€40.00')).toBeVisible();
			}).toPass({ timeout: 60_000 });

			// Continue hands the holds STRAIGHT to the cart (cart.setSeatIds) —
			// no picker opens for an already-held pick. The tier card grows the
			// "N seats · edit" badge and the summary bar totals it.
			const tierCard = tierCardLocator(page, tier.name);
			const summaryBar = page.getByTestId('cart-summary-bar');
			await expect(async () => {
				if (await tierCard.getByText('2 seats · edit').isVisible()) return;
				if (await overview.isVisible()) {
					await overview.getByRole('button', { name: 'Continue', exact: true }).click();
				}
				await expect(overview).toBeHidden({ timeout: 8_000 });
				await expect(tierCard.getByText('2 seats · edit')).toBeVisible({ timeout: 8_000 });
			}).toPass({ timeout: 30_000 });
			await expect(summaryBar).toContainText('2 tickets');
			await expect(summaryBar).toContainText('EUR 40.00');

			// Buy completes the purchase directly (no sheet — names aren't
			// required and this is the only group).
			await summaryBar.getByRole('button', { name: 'Buy', exact: true }).click();
			await expect(page.getByText(/reserved/i)).toBeVisible({ timeout: 10_000 });

			// Two tickets (carousel), each carrying one of the tapped Row A seats
			// — the adopted holds became the tickets' seats.
			const success = page.getByRole('dialog', { name: 'Your Ticket', exact: true });
			await expect(success).toBeVisible({ timeout: 8_000 });
			await expect(success.getByText('Ticket 1 of 2')).toBeVisible();
			await expect(success.getByText(/Row A, Seat [12]/)).toBeVisible();
			await success.getByRole('button', { name: 'Next ticket' }).click();
			await expect(success.getByText('Ticket 2 of 2')).toBeVisible();
			await expect(success.getByText(/Row A, Seat [12]/)).toBeVisible();
		} finally {
			await context.close();
		}
	});

	// #853 rewrite: the old `TicketTierModal` ("Select Your Ticket") this test
	// used to open the overview FROM is deleted outright — there is no tier
	// modal left to grow a "View seating map" button inside. The remembered
	// map-first preference (`writeTierMapPref`/`readTierMapPref`,
	// sessionStorage) survives the rewrite, but its trigger moved: it's read
	// once in +page.svelte's `onMount` (`if (hasSeatingMap && !userTicket &&
	// readTierMapPref()) showVenueOverview = true`) — a PAGE-LOAD auto-open,
	// not a modal-reopen auto-open. So the intent (choosing map-first once
	// keeps landing on it) is still provable, just via a page reload instead
	// of a second modal open.
	test('map-first preference: opening the overview once auto-opens it again on the next page load', async ({
		browser
	}) => {
		test.setTimeout(120_000);

		const [seeded, buyer] = await Promise.all([
			getSeededBestAvailableEvent(),
			createVerifiedUser('MapPref')
		]);

		const context = await browser.newContext();
		await authenticateContext(context, buyer);
		const page = await context.newPage();
		try {
			await gotoHydrated(page, seeded.eventPath);
			await waitForClientAuth(page);

			const overview = page.getByRole('dialog', { name: 'Seating map' });
			const openMap = page.getByRole('button', { name: 'View seating map', exact: true });

			// Using the map button once writes the session preference.
			await expect(async () => {
				if (await overview.isVisible()) return;
				await openMap.click();
				await expect(overview).toBeVisible({ timeout: 8_000 });
			}).toPass({ timeout: 60_000 });
			await page.keyboard.press('Escape');
			await expect(overview).toBeHidden();

			// A fresh page load (same session) auto-opens the overview WITHOUT
			// touching the map button — the remembered pref, read once on mount.
			await gotoHydrated(page, seeded.eventPath);
			await waitForClientAuth(page);
			await expect(overview).toBeVisible({ timeout: 15_000 });
		} finally {
			await context.close();
		}
	});

	// Cross-sector switching, seat-level (seating phase 2): the overview
	// confines a buyer's live selection to ONE sector at a time — tapping a
	// seat in a DIFFERENT seat-selectable sector releases the previous
	// sector's holds (never silently: a polite live-region announcement names
	// the released sector) and starts a fresh selection there.
	//
	// #853 rewrite: this replaces the old "whole-venue map inside the
	// purchase dialog, clicking another SOLD sector prompts a confirm-to-switch
	// dialog" flow. That specific mechanism is gone for authenticated buyers —
	// `SeatPickerDialog` (the cart-flow picker) never wires `allTiers`/
	// `onSwitchTier` into `SeatPickerPanel` (confirmed by reading the source:
	// only the unauthenticated `GuestTicketSeatSection` still does), so the
	// picker's own "whole venue" scope renders every OTHER sector as an inert
	// ghost, not a switch target (see seat-selection.spec.ts's whole-venue
	// test). The surviving, buyer-reachable cross-sector-switch mechanic lives
	// in `VenueOverviewMap.handleToggle` instead: tapping a seat in a second
	// seat-selectable sector auto-releases the first sector's holds and
	// re-announces — same underlying property (switching sections never lets
	// held seats silently leak or double-charge), different UI (auto-release +
	// announcement instead of a confirm prompt).
	//
	// Isolation: own venue with TWO single-tier user_choice sectors (both
	// therefore seat-selectable in the overview) — the seeded showcase only
	// has one such sector (Palco 1), so this needs its own arrangement.
	test('overview cross-sector switch: a tap in another sector releases the first and re-announces', async ({
		browser
	}) => {
		test.setTimeout(120_000);

		const owner = await ApiClient.login(PERSONAS.owner.email, PERSONAS.owner.password);
		const venue = await owner.post<{ id: string }>(
			'/api/organization-admin/revel-events-collective/venues',
			{ name: uniqueName('Switch Venue') }
		);
		const front = await owner.post<{ id: string }>(
			`/api/organization-admin/revel-events-collective/venues/${venue.id}/sectors`,
			{
				name: 'Front Sector',
				kind: 'seated',
				seats: [
					{ label: 'A1', row: 'A', number: 1 },
					{ label: 'A2', row: 'A', number: 2 }
				]
			}
		);
		const rear = await owner.post<{ id: string }>(
			`/api/organization-admin/revel-events-collective/venues/${venue.id}/sectors`,
			{
				name: 'Rear Sector',
				kind: 'seated',
				seats: [
					{ label: 'C1', row: 'C', number: 1 },
					{ label: 'C2', row: 'C', number: 2 }
				]
			}
		);
		const [event, buyer] = await Promise.all([
			createTicketedEvent({
				freeTier: false,
				event: { venue_id: venue.id, require_ticket_names: false }
			}),
			createVerifiedUser('SectorSwitch')
		]);
		await deleteDefaultTier(event.id);
		await createTicketTier(event.id, {
			name: 'Front Seats',
			payment_method: 'offline',
			price: '20.00',
			seat_assignment_mode: 'user_choice',
			venue_id: venue.id,
			sector_id: front.id
		});
		await createTicketTier(event.id, {
			name: 'Rear Seats',
			payment_method: 'offline',
			price: '25.00',
			seat_assignment_mode: 'user_choice',
			venue_id: venue.id,
			sector_id: rear.id
		});

		const context = await browser.newContext();
		await authenticateContext(context, buyer);
		const page = await context.newPage();
		try {
			await gotoHydrated(page, event.path);
			await waitForClientAuth(page);

			const overview = page.getByRole('dialog', { name: 'Seating map' });
			const openMap = page.getByRole('button', { name: 'View seating map', exact: true });
			await expect(async () => {
				if (await overview.isVisible()) return;
				await openMap.click();
				await expect(overview).toBeVisible({ timeout: 8_000 });
			}).toPass({ timeout: 60_000 });

			// Both sectors are sold by exactly one user_choice tier each — both
			// render live seats directly, no whole-sector targets.
			const seatA1 = overview.getByRole('button', { name: /^Seat A1(,|$)/ });
			const seatC1 = overview.getByRole('button', { name: /^Seat C1(,|$)/ });
			await expect(seatA1).toBeVisible({ timeout: 15_000 });
			await expect(seatC1).toBeVisible();

			// Hold A1 in the Front sector.
			await expect(async () => {
				if ((await seatA1.getAttribute('aria-pressed')) !== 'true') {
					await seatA1.click();
				}
				await expect(seatA1).toHaveAttribute('aria-pressed', 'true', { timeout: 5_000 });
				await expect(overview.getByText('1 seat selected')).toBeVisible({ timeout: 5_000 });
				await expect(overview.getByText(/Front Seats/)).toBeVisible();
			}).toPass({ timeout: 30_000 });

			// Tapping C1 in the Rear sector releases A1 (announced by name) and
			// holds C1 instead — one click does both.
			await expect(async () => {
				if ((await seatC1.getAttribute('aria-pressed')) !== 'true') {
					await seatC1.click();
				}
				await expect(seatC1).toHaveAttribute('aria-pressed', 'true', { timeout: 5_000 });
				await expect(
					overview.getByText('Your selected seats in Front Sector were released.')
				).toBeVisible({ timeout: 5_000 });
			}).toPass({ timeout: 30_000 });
			await expect(seatA1).not.toHaveAttribute('aria-pressed', 'true');
			await expect(overview.getByText('1 seat selected')).toBeVisible();
			await expect(overview.getByText(/Rear Seats/)).toBeVisible();
		} finally {
			await context.close();
		}
	});
});
