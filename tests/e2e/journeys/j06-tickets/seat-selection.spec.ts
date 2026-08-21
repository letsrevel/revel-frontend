import { test, expect } from '../../support/fixtures';
import {
	claimTicketViaApi,
	createCategoryPricedVenue,
	createPriceCategory,
	createTicketedEvent,
	createTicketTier,
	createVerifiedUser,
	deleteDefaultTier,
	getSeatingChart,
	createPlainConcertHall,
	listAvailableSeats,
	uniqueName
} from '../../support/factories';
import { PERSONAS } from '../../support/personas';
import { ApiClient } from '../../support/api';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import type { Page } from '@playwright/test';

// J19→J6 (USER_JOURNEYS.md) — USER_CHOICE seat selection: the seat picker
// dialog (#853 PR 3 cart flow) renders the sector's seat map, an already-sold
// seat is blocked, and the chosen seat lands on the ticket.
//
// #853 rewrite (wave 1, task 10): the legacy TicketConfirmationDialog is
// deleted. `user_choice` tiers now render a "Pick seats…" button directly on
// the tier card (no wrapping tier-select dialog) that opens
// `SeatPickerDialog` (testid `seat-picker-dialog`, accessible name
// "Pick seats — {tierName}") over the SAME seat map/list UI
// (`SeatPickerPanel`, extracted verbatim from the old dialog). "Done" syncs
// the picked seats into the cart (tier card then shows an "N seats · edit"
// badge); the sticky `CartSummaryBar`'s "Buy" completes the purchase. Events
// arrange `require_ticket_names: false` so a single-tier cart skips the
// checkout sheet and buys directly — the sheet's own seated-group behavior is
// best-available.spec.ts's territory.
//
// Seating phase 1 (#657): selection IS a server-side TTL hold — every tap is
// a POST /seating/holds round-trip (the seat renders busy while in flight,
// then pressed), a second tap releases the hold, and the map surfaces the
// sparse availability statuses ("Seat B1, sold" for the taken seat). The
// "held for you for 10 minutes" notice appears once a seat is held.
//
// Isolation: own event on Org Alpha with an OFFLINE user-choice tier attached
// to the seeded "Revel Concert Hall" 10×10 grid — seat availability is per
// event, so the seeded classical-music-evening's seats are untouched, and
// offline avoids Stripe entirely (seat resolution is payment-method agnostic,
// see batch_ticket_service._resolve_seats_user_choice). Row A is seeded
// accessible (aria "…, accessible"), so the spec works in row B where seat
// names are bare.

function tierCardLocator(page: Page, tierName: string) {
	// `div.bg-card`, NOT bare `.bg-card` — TicketTierList's wrapping <section>
	// carries the class too (it's a card-styled surface holding every tier
	// card), so a bare class filter matches BOTH the section and the one
	// PricingCard whose heading it contains. The tag discriminates: only
	// PricingCard's root is a <div>.
	return page
		.locator('div.bg-card')
		.filter({ has: page.getByRole('heading', { name: tierName, exact: true }) });
}

/** Opens the seat picker for a `user_choice` tier via its tier-card CTA. */
async function openPicker(page: Page, tierName: string) {
	await tierCardLocator(page, tierName)
		.getByRole('button', { name: 'Pick seats…', exact: true })
		.click();
	const picker = page.getByTestId('seat-picker-dialog');
	await expect(picker).toBeVisible({ timeout: 8_000 });
	return picker;
}

test.describe('J6 seat selection @p2', () => {
	test('seat map at purchase → taken seat blocked → chosen seat on ticket', async ({ browser }) => {
		const hall = await createPlainConcertHall();
		const [event, buyer, otherBuyer] = await Promise.all([
			// The event itself needs the venue: the phase-2 chart/availability
			// endpoints resolve it from event.venue_id, not from the tier.
			createTicketedEvent({
				freeTier: false,
				event: { venue_id: hall.venueId, require_ticket_names: false }
			}),
			createVerifiedUser('SeatBuyer'),
			createVerifiedUser('SeatTaker')
		]);
		await deleteDefaultTier(event.id);
		const tier = await createTicketTier(event.id, {
			name: 'Choose Your Seat',
			payment_method: 'offline',
			price: '25.00',
			seat_assignment_mode: 'user_choice',
			venue_id: hall.venueId,
			sector_id: hall.sectorId
		});

		// Another attendee takes B1 via the API so the map shows it as sold.
		const seats = await listAvailableSeats(buyer, event.id);
		const seatB1 = seats.find((s) => s.label === 'B1');
		if (!seatB1) throw new Error('Seeded seat B1 missing from Revel Concert Hall');
		await claimTicketViaApi(otherBuyer, event.id, tier.id, { seatId: seatB1.id });

		const context = await browser.newContext();
		await authenticateContext(context, buyer);
		const page = await context.newPage();
		await gotoHydrated(page, event.path);
		await waitForClientAuth(page);

		const picker = await openPicker(page, tier.name);

		// Seat map: stage marker, the sold seat disabled (sparse availability map
		// renders it with the "sold" accessible name), a free seat clickable.
		await expect(picker.getByText('Select Your Seats')).toBeVisible();
		await expect(picker.getByText('STAGE')).toBeVisible({ timeout: 15_000 });
		await expect(picker.getByRole('button', { name: 'Seat B1, sold' })).toBeDisabled();

		// Choose B3. Each tap is now a hold round-trip (the seat is briefly
		// "Seat B3, updating" while the POST is in flight), so the retry loop
		// only clicks when the seat isn't already pressed — a second click would
		// RELEASE the hold. The pressed state plus the 10-minute-hold notice
		// prove the server hold is live before Done.
		const seatB3 = picker.getByRole('button', { name: /^Seat B3(,|$)/ });
		await expect(async () => {
			if ((await seatB3.getAttribute('aria-pressed')) !== 'true') {
				await seatB3.click();
			}
			await expect(seatB3).toHaveAttribute('aria-pressed', 'true', { timeout: 5_000 });
			await expect(picker.getByText('1 / 1 selected')).toBeVisible({ timeout: 5_000 });
		}).toPass({ timeout: 60_000 });
		await expect(picker.getByText('Selected seats are held for you for 10 minutes.')).toBeVisible();

		await picker.getByRole('button', { name: 'Done', exact: true }).click();
		await expect(picker).toBeHidden();

		// Tier card shows the held-seats badge, then Buy completes the purchase
		// directly (no sheet — names aren't required and this is the only group).
		await expect(tierCardLocator(page, tier.name).getByText('1 seat · edit')).toBeVisible();
		const summaryBar = page.getByTestId('cart-summary-bar');
		await summaryBar.getByRole('button', { name: 'Buy', exact: true }).click();
		await expect(page.getByText(/reserved/i)).toBeVisible({ timeout: 10_000 });

		// The ticket carries the chosen seat ("Venue • Sector • Row B, Seat 3").
		const success = page.getByRole('dialog', { name: 'Your Ticket', exact: true });
		await expect(success).toBeVisible({ timeout: 8_000 });
		await expect(success.getByText(/Row B, Seat 3/)).toBeVisible();

		await context.close();
	});

	// Per-seat-category pricing (#668, BE #739): a user_choice tier prices row A
	// via a painted category (55.00) while unpainted row B falls back to the
	// tier's base price (20.00). The tier card shows the price range, the
	// picker's legend pairs each category with its resolved price, each seat's
	// accessible name carries its resolved price, the selection total sums
	// server-resolved prices, and the issued (pending offline) ticket shows the
	// per-ticket amount due — price_paid, not tier.price.
	//
	// Isolation: own venue via createCategoryPricedVenue — painting a shared
	// venue would break concurrently-saved category-priced tiers (coverage is
	// validated against every painted category in the sector).
	test('per-seat-category pricing: legend, seat prices, total, amount on ticket', async ({
		browser
	}) => {
		const venue = await createCategoryPricedVenue('revel-events-collective');
		const [event, buyer] = await Promise.all([
			createTicketedEvent({
				freeTier: false,
				event: { venue_id: venue.venueId, require_ticket_names: false }
			}),
			createVerifiedUser('PricedSeatBuyer')
		]);
		await deleteDefaultTier(event.id);
		const tier = await createTicketTier(event.id, {
			name: 'Priced Seats',
			payment_method: 'offline',
			price: '20.00',
			seat_assignment_mode: 'user_choice',
			venue_id: venue.venueId,
			sector_id: venue.sectorId,
			category_prices: { [venue.category.id]: '55.00' }
		});

		const context = await browser.newContext();
		await authenticateContext(context, buyer);
		const page = await context.newPage();
		await gotoHydrated(page, event.path);
		await waitForClientAuth(page);

		// Price range on the tier card (min base 20.00 – max category 55.00),
		// visible before the picker ever opens.
		await expect(tierCardLocator(page, tier.name).getByText('EUR 20.00 - EUR 55.00')).toBeVisible();

		const picker = await openPicker(page, tier.name);

		// The legend pairs each category (and the unpainted fallback) with its
		// resolved price.
		const legend = picker.getByRole('list', { name: 'Seat prices' });
		await expect(legend).toBeVisible({ timeout: 15_000 });
		await expect(legend.getByText(venue.category.name)).toBeVisible();
		await expect(legend.getByText('€55.00')).toBeVisible();
		await expect(legend.getByText('Standard seats')).toBeVisible();
		await expect(legend.getByText('€20.00')).toBeVisible();

		// Each seat's accessible name carries its own resolved price (dumb
		// server-side lookup: painted → category price, unpainted → base).
		const seatA1 = picker.getByRole('button', { name: 'Seat A1, €55.00' });
		await expect(seatA1).toBeVisible();
		await expect(picker.getByRole('button', { name: 'Seat B1, €20.00' })).toBeVisible();

		// Selecting the painted seat shows the running estimate for the held set
		// — and the sticky footer total, which stays in view however far the
		// seat map pushes the in-flow estimate below the fold.
		await expect(async () => {
			if ((await seatA1.getAttribute('aria-pressed')) !== 'true') {
				await seatA1.click();
			}
			await expect(seatA1).toHaveAttribute('aria-pressed', 'true', { timeout: 5_000 });
			await expect(picker.getByText('Selected seats: €55.00')).toBeVisible({ timeout: 5_000 });
			await expect(
				picker.locator('p', { hasText: /^Total/ }).filter({ hasText: '€55.00' })
			).toBeVisible();
		}).toPass({ timeout: 60_000 });

		await picker.getByRole('button', { name: 'Done', exact: true }).click();
		await expect(picker).toBeHidden();

		const summaryBar = page.getByTestId('cart-summary-bar');
		await summaryBar.getByRole('button', { name: 'Buy', exact: true }).click();
		await expect(page.getByText(/reserved/i)).toBeVisible({ timeout: 10_000 });

		// The pending offline ticket shows the per-ticket amount due — the
		// category price actually charged, not the tier's base price.
		const success = page.getByRole('dialog', { name: 'Your Ticket', exact: true });
		await expect(success).toBeVisible({ timeout: 8_000 });
		await expect(success.getByText(/Row A, Seat 1/)).toBeVisible();
		await expect(success.getByText('Amount due: €55.00')).toBeVisible();

		await context.close();
	});

	// Taps DRIVE the count (no pre-set quantity — `user_choice` has no
	// independent stepper, the tap-driven transient controller IS the
	// counter), and reopening the picker after a full page reload restores the
	// buyer's held selection as their own: the transient controller seeds from
	// the server's `my_holds` on mount (same mechanism `adoptServerHolds` uses
	// elsewhere), so both seats come back pressed without ever touching the
	// cart (which is in-memory only and does NOT survive a reload — the picker
	// reopening, not the tier-card badge, is what proves the server-side hold
	// survived).
	test('taps grow the count; reopening the picker after reload restores the whole selection as mine', async ({
		browser
	}) => {
		const hall = await createPlainConcertHall();
		const [event, buyer] = await Promise.all([
			createTicketedEvent({
				freeTier: false,
				event: { venue_id: hall.venueId, require_ticket_names: false }
			}),
			createVerifiedUser('TapGrow')
		]);
		await deleteDefaultTier(event.id);
		const tier = await createTicketTier(event.id, {
			name: 'Tap Grow Seats',
			payment_method: 'offline',
			price: '15.00',
			seat_assignment_mode: 'user_choice',
			venue_id: hall.venueId,
			sector_id: hall.sectorId,
			max_tickets_per_user: 4
		});

		const context = await browser.newContext();
		await authenticateContext(context, buyer);
		const page = await context.newPage();
		await gotoHydrated(page, event.path);
		await waitForClientAuth(page);

		let picker = await openPicker(page, tier.name);

		// Tap B2: 1/1. Tap B3: the count GROWS to 2 — no manual increment
		// needed. Only click while unpressed (a second tap would release the
		// hold).
		const seatB2 = picker.getByRole('button', { name: /^Seat B2(,|$)/ });
		const seatB3 = picker.getByRole('button', { name: /^Seat B3(,|$)/ });
		await expect(async () => {
			if ((await seatB2.getAttribute('aria-pressed')) !== 'true') {
				await seatB2.click();
			}
			await expect(seatB2).toHaveAttribute('aria-pressed', 'true', { timeout: 5_000 });
			await expect(picker.getByText('1 / 1 selected')).toBeVisible({ timeout: 5_000 });
		}).toPass({ timeout: 60_000 });
		await expect(async () => {
			if ((await seatB3.getAttribute('aria-pressed')) !== 'true') {
				await seatB3.click();
			}
			await expect(seatB3).toHaveAttribute('aria-pressed', 'true', { timeout: 5_000 });
			await expect(picker.getByText('2 / 2 selected')).toBeVisible({ timeout: 5_000 });
		}).toPass({ timeout: 60_000 });

		// Reload WITHOUT clicking Done (the cart never learned about these
		// picks — only the server-side hold is real) and reopen: BOTH seats
		// come back as the buyer's own selection (pressed, not foreign-held).
		await gotoHydrated(page, event.path);
		await waitForClientAuth(page);
		picker = await openPicker(page, tier.name);
		await expect(picker.getByRole('button', { name: /^Seat B2(,|$)/ })).toHaveAttribute(
			'aria-pressed',
			'true',
			{ timeout: 15_000 }
		);
		await expect(picker.getByRole('button', { name: /^Seat B3(,|$)/ })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await expect(picker.getByText('2 / 2 selected')).toBeVisible();

		await context.close();
	});

	// Painting a category onto seats is a venue-wide op that always succeeds —
	// a tier whose map doesn't price it then has seats it cannot sell. With the
	// picker OPEN the tier payload goes stale while the chart refetches (the
	// availability response echoes chart_updated_at, and any hold round-trip
	// refetches availability), so the repainted seat's category id is absent
	// from seat_pricing entirely. The allow-list rule must grey it out like a
	// sold seat — the checkout 400 is only the backstop, and reaching it is the
	// worst possible place to fail.
	test('mid-dialog repaint with a category the tier does not sell greys the seat out', async ({
		browser
	}) => {
		const venue = await createCategoryPricedVenue('revel-events-collective');
		const [event, buyer] = await Promise.all([
			createTicketedEvent({
				freeTier: false,
				event: { venue_id: venue.venueId, require_ticket_names: false }
			}),
			createVerifiedUser('RepaintBuyer')
		]);
		await deleteDefaultTier(event.id);
		const tier = await createTicketTier(event.id, {
			name: 'Priced Seats',
			payment_method: 'offline',
			price: '20.00',
			seat_assignment_mode: 'user_choice',
			venue_id: venue.venueId,
			sector_id: venue.sectorId,
			category_prices: { [venue.category.id]: '55.00' }
		});

		const context = await browser.newContext();
		await authenticateContext(context, buyer);
		const page = await context.newPage();
		await gotoHydrated(page, event.path);
		await waitForClientAuth(page);

		const picker = await openPicker(page, tier.name);

		// B1 starts unpainted and sellable at the base price.
		await expect(picker.getByRole('button', { name: 'Seat B1, €20.00' })).toBeVisible({
			timeout: 15_000
		});

		// NOW, picker open: paint B1 with a brand-new category the tier has
		// never heard of (venue-wide op — never blocked by this tier's config).
		const late = await createPriceCategory(
			'revel-events-collective',
			venue.venueId,
			{ name: 'Late Paint' },
			'owner'
		);
		const chart = await getSeatingChart(event.id);
		const b1 = chart.sectors
			.find((sector) => sector.id === venue.sectorId)
			?.seats?.find((seat) => seat.label === 'B1');
		if (!b1) throw new Error('Seat B1 missing from the category-priced venue');
		const owner = await ApiClient.login(PERSONAS.owner.email, PERSONAS.owner.password);
		await owner.put(
			`/api/organization-admin/revel-events-collective/venues/${venue.venueId}/seats/paint`,
			{ seat_ids: [b1.id], price_category_id: late.id }
		);

		// Trigger the refetch chain WITHOUT refreshing the tier payload: a hold
		// round-trip refetches availability, whose chart_updated_at echo has
		// moved, which invalidates and refetches the chart. Only click while
		// unpressed — a second tap would release the hold.
		const seatA1 = picker.getByRole('button', { name: 'Seat A1, €55.00' });
		await expect(async () => {
			if ((await seatA1.getAttribute('aria-pressed')) !== 'true') {
				await seatA1.click();
			}
			await expect(seatA1).toHaveAttribute('aria-pressed', 'true', { timeout: 5_000 });
		}).toPass({ timeout: 60_000 });

		// The repainted seat greys out in place: disabled, "unavailable" aria,
		// no price quoted — while the tier's stale seat_pricing never listed
		// the new category at all.
		const b1Blocked = picker.getByRole('button', { name: 'Seat B1, unavailable' });
		await expect(b1Blocked).toBeVisible({ timeout: 15_000 });
		await expect(b1Blocked).toBeDisabled();

		await context.close();
	});

	// Whole-venue context (map scope toggle): the tier's sector stays fully
	// interactive while every other sector renders as a labelled inert ghost —
	// spatial context without pretending foreign seats are sold out.
	test('whole-venue scope shows other sectors as inert ghosts, own seats stay selectable', async ({
		browser
	}) => {
		const owner = await ApiClient.login(PERSONAS.owner.email, PERSONAS.owner.password);
		const venue = await owner.post<{ id: string }>(
			'/api/organization-admin/revel-events-collective/venues',
			{ name: uniqueName('Venue') }
		);
		const front = await owner.post<{ id: string }>(
			`/api/organization-admin/revel-events-collective/venues/${venue.id}/sectors`,
			{
				name: 'Front Floor',
				kind: 'seated',
				// Seat writes still use `row` (becomes `row_label` in the Phase-2 rename).
				seats: [
					{ label: 'A1', row: 'A', number: 1 },
					{ label: 'A2', row: 'A', number: 2 }
				]
			}
		);
		await owner.post(`/api/organization-admin/revel-events-collective/venues/${venue.id}/sectors`, {
			name: 'Rear Balcony',
			kind: 'seated',
			seats: [
				{ label: 'B1', row: 'B', number: 1 },
				{ label: 'B2', row: 'B', number: 2 }
			]
		});
		const [event, buyer] = await Promise.all([
			createTicketedEvent({
				freeTier: false,
				event: { venue_id: venue.id, require_ticket_names: false }
			}),
			createVerifiedUser('VenueScope')
		]);
		await deleteDefaultTier(event.id);
		const tier = await createTicketTier(event.id, {
			name: 'Front Seats',
			payment_method: 'offline',
			price: '20.00',
			seat_assignment_mode: 'user_choice',
			venue_id: venue.id,
			sector_id: front.id
		});

		const context = await browser.newContext();
		await authenticateContext(context, buyer);
		const page = await context.newPage();
		await gotoHydrated(page, event.path);
		await waitForClientAuth(page);

		const picker = await openPicker(page, tier.name);

		// Multi-sector chart defaults to the map view; scope starts at the tier's
		// own section, so the other sector is nowhere in sight.
		const sectionBtn = picker.getByRole('button', { name: 'This section' });
		await expect(sectionBtn).toBeVisible({ timeout: 15_000 });
		await expect(sectionBtn).toHaveAttribute('aria-pressed', 'true');
		await expect(picker.getByText('Rear Balcony')).toBeHidden();

		// Whole venue: the other sector appears as ONE labelled inert ghost (no
		// seat buttons of its own), while the tier's seats remain selectable.
		await picker.getByRole('button', { name: 'Whole venue' }).click();
		await expect(
			picker.getByRole('img', { name: 'Rear Balcony: sold through a different ticket' })
		).toBeVisible();
		await expect(picker.getByRole('button', { name: /Seat B1/ })).toBeHidden();
		const seatA1 = picker.getByRole('button', { name: /^Seat A1/ });
		await expect(async () => {
			if ((await seatA1.getAttribute('aria-pressed')) !== 'true') {
				await seatA1.click();
			}
			await expect(seatA1).toHaveAttribute('aria-pressed', 'true', { timeout: 5_000 });
		}).toPass({ timeout: 60_000 });

		// Flat tier: the picker's OWN footer total is a per-seat-category
		// estimate only (`estimatedSeatTotal` needs `tier.seat_pricing`, which
		// the backend deliberately omits for an unpainted flat tier — see
		// `resolve_seat_pricing`), so it never renders here. The price ×
		// quantity total for a flat tier is the CART's job: Done syncs the pick
		// into the cart group, and the summary bar's total (which always knows
		// how to price a flat tier, seat_pricing or not) shows it.
		await picker.getByRole('button', { name: 'Done', exact: true }).click();
		await expect(picker).toBeHidden();
		await expect(page.getByTestId('cart-summary-bar')).toContainText('EUR 20.00');

		await context.close();
	});
});
