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
	getSeededConcertHall,
	listAvailableSeats,
	uniqueName
} from '../../support/factories';
import { PERSONAS } from '../../support/personas';
import { ApiClient } from '../../support/api';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J19→J6 (USER_JOURNEYS.md) — USER_CHOICE seat selection at checkout: the
// confirmation dialog renders the sector's seat map, an already-sold seat is
// blocked, and the chosen seat lands on the ticket.
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

test.describe('J6 seat selection @p2', () => {
	test('seat map at checkout → taken seat blocked → chosen seat on ticket', async ({ browser }) => {
		const hall = await getSeededConcertHall();
		const [event, buyer, otherBuyer] = await Promise.all([
			// The event itself needs the venue: the phase-2 chart/availability
			// endpoints resolve it from event.venue_id, not from the tier.
			createTicketedEvent({ freeTier: false, event: { venue_id: hall.venueId } }),
			createVerifiedUser('SeatBuyer'),
			createVerifiedUser('SeatTaker')
		]);
		await deleteDefaultTier(event.id); // its card also says "Reserve Ticket"
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

		// Open the confirmation dialog (idempotent loop, see free-tier.spec.ts).
		const tierDialog = page.getByRole('dialog', { name: 'Select Your Ticket' });
		const confirmDialog = page.getByRole('dialog', { name: 'Reserve Ticket' });
		await expect(async () => {
			if (await confirmDialog.isVisible()) return;
			if (!(await tierDialog.isVisible())) {
				await page.getByRole('button', { name: 'Get Tickets', exact: true }).click();
			}
			await tierDialog.getByRole('button', { name: 'Reserve Ticket' }).click();
			await expect(confirmDialog).toBeVisible({ timeout: 8_000 });
		}).toPass({ timeout: 60_000 });

		// Seat map: stage marker, the sold seat disabled (sparse availability map
		// renders it with the "sold" accessible name), a free seat clickable.
		await expect(confirmDialog.getByText('Select Your Seats')).toBeVisible();
		await expect(confirmDialog.getByText('STAGE')).toBeVisible({ timeout: 15_000 });
		await expect(confirmDialog.getByRole('button', { name: 'Seat B1, sold' })).toBeDisabled();

		// Choose B3, then reserve. Each tap is now a hold round-trip (the seat is
		// briefly "Seat B3, updating" while the POST is in flight), so the retry
		// loop only clicks when the seat isn't already pressed — a second click
		// would RELEASE the hold. The pressed state plus the 10-minute-hold notice
		// prove the server hold is live before reserving.
		const seatB3 = confirmDialog.getByRole('button', { name: /^Seat B3(,|$)/ });
		const success = page.getByRole('dialog', { name: 'Your Ticket', exact: true });
		await expect(async () => {
			if (await success.isVisible()) return;
			if ((await seatB3.getAttribute('aria-pressed')) !== 'true') {
				await seatB3.click();
			}
			await expect(seatB3).toHaveAttribute('aria-pressed', 'true', { timeout: 5_000 });
			await expect(confirmDialog.getByText('1 / 1 selected')).toBeVisible({ timeout: 5_000 });
			await expect(
				confirmDialog.getByText('Selected seats are held for you for 10 minutes.')
			).toBeVisible();
			await confirmDialog.getByRole('button', { name: 'Reserve Ticket' }).click();
			await expect(success).toBeVisible({ timeout: 8_000 });
		}).toPass({ timeout: 60_000 });

		// The ticket carries the chosen seat ("Venue • Sector • Row B, Seat 3").
		await expect(success.getByText(/Row B, Seat 3/)).toBeVisible();

		await context.close();
	});

	// Per-seat-category pricing (#668, BE #739): a user_choice tier prices row A
	// via a painted category (55.00) while unpainted row B falls back to the
	// tier's base price (20.00). The dialog shows the price legend and range,
	// each seat's accessible name carries its resolved price, the selection
	// total sums server-resolved prices, and the issued (pending offline)
	// ticket shows the per-ticket amount due — price_paid, not tier.price.
	//
	// Isolation: own venue via createCategoryPricedVenue — painting a shared
	// venue would break concurrently-saved category-priced tiers (coverage is
	// validated against every painted category in the sector).
	test('per-seat-category pricing: legend, seat prices, total, amount on ticket', async ({
		browser
	}) => {
		const venue = await createCategoryPricedVenue('revel-events-collective');
		const [event, buyer] = await Promise.all([
			createTicketedEvent({ freeTier: false, event: { venue_id: venue.venueId } }),
			createVerifiedUser('PricedSeatBuyer')
		]);
		await deleteDefaultTier(event.id);
		await createTicketTier(event.id, {
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

		const tierDialog = page.getByRole('dialog', { name: 'Select Your Ticket' });
		const confirmDialog = page.getByRole('dialog', { name: 'Reserve Ticket' });
		await expect(async () => {
			if (await confirmDialog.isVisible()) return;
			if (!(await tierDialog.isVisible())) {
				await page.getByRole('button', { name: 'Get Tickets', exact: true }).click();
			}
			await tierDialog.getByRole('button', { name: 'Reserve Ticket' }).click();
			await expect(confirmDialog).toBeVisible({ timeout: 8_000 });
		}).toPass({ timeout: 60_000 });

		// Price range on the tier card (min base 20.00 – max category 55.00) and
		// the legend pairing each category (and the unpainted fallback) with its
		// resolved price.
		await expect(confirmDialog.getByText('EUR 20.00 - EUR 55.00')).toBeVisible();
		const legend = confirmDialog.getByRole('list', { name: 'Seat prices' });
		await expect(legend).toBeVisible({ timeout: 15_000 });
		await expect(legend.getByText(venue.category.name)).toBeVisible();
		await expect(legend.getByText('€55.00')).toBeVisible();
		await expect(legend.getByText('Standard seats')).toBeVisible();
		await expect(legend.getByText('€20.00')).toBeVisible();

		// Each seat's accessible name carries its own resolved price (dumb
		// server-side lookup: painted → category price, unpainted → base).
		const seatA1 = confirmDialog.getByRole('button', { name: 'Seat A1, €55.00' });
		await expect(seatA1).toBeVisible();
		await expect(confirmDialog.getByRole('button', { name: 'Seat B1, €20.00' })).toBeVisible();

		// Selecting the painted seat shows the running estimate for the held set —
		// and the STICKY FOOTER total, which stays in view however far the seat
		// map pushes the in-flow estimate below the fold.
		const success = page.getByRole('dialog', { name: 'Your Ticket', exact: true });
		await expect(async () => {
			if (await success.isVisible()) return;
			if ((await seatA1.getAttribute('aria-pressed')) !== 'true') {
				await seatA1.click();
			}
			await expect(seatA1).toHaveAttribute('aria-pressed', 'true', { timeout: 5_000 });
			await expect(confirmDialog.getByText('Selected seats: €55.00')).toBeVisible({
				timeout: 5_000
			});
			await expect(
				confirmDialog.locator('p', { hasText: /^Total/ }).filter({ hasText: '€55.00' })
			).toBeVisible();
			await confirmDialog.getByRole('button', { name: 'Reserve Ticket' }).click();
			await expect(success).toBeVisible({ timeout: 8_000 });
		}).toPass({ timeout: 60_000 });

		// The pending offline ticket shows the per-ticket amount due — the
		// category price actually charged, not the tier's base price.
		await expect(success.getByText(/Row A, Seat 1/)).toBeVisible();
		await expect(success.getByText('Amount due: €55.00')).toBeVisible();

		await context.close();
	});

	// Taps DRIVE the quantity counter (no pre-incrementing), and a reload
	// restores the buyer's full held selection as their own — the seed adopts
	// up to the MAX purchasable quantity and grows the counter to match
	// (previously it capped at the reset counter of 1, rendering the buyer's
	// own surviving holds as foreign "held by someone else" seats).
	test('taps grow the counter; reload restores the whole selection as mine', async ({
		browser
	}) => {
		const hall = await getSeededConcertHall();
		const [event, buyer] = await Promise.all([
			createTicketedEvent({ freeTier: false, event: { venue_id: hall.venueId } }),
			createVerifiedUser('TapGrow')
		]);
		await deleteDefaultTier(event.id);
		await createTicketTier(event.id, {
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

		const openDialog = async () => {
			await gotoHydrated(page, event.path);
			await waitForClientAuth(page);
			const tierDialog = page.getByRole('dialog', { name: 'Select Your Ticket' });
			const confirmDialog = page.getByRole('dialog', { name: 'Reserve Ticket' });
			await expect(async () => {
				if (await confirmDialog.isVisible()) return;
				if (!(await tierDialog.isVisible())) {
					await page.getByRole('button', { name: 'Get Tickets', exact: true }).click();
				}
				await tierDialog.getByRole('button', { name: 'Reserve Ticket' }).click();
				await expect(confirmDialog).toBeVisible({ timeout: 8_000 });
			}).toPass({ timeout: 60_000 });
			return confirmDialog;
		};

		let confirmDialog = await openDialog();

		// Tap B2 WITHOUT touching the stepper: 1/1. Tap B3: the counter GROWS
		// to 2 and the seat holds — no manual increment needed. Only click
		// while unpressed (a second tap would release the hold).
		const seatB2 = confirmDialog.getByRole('button', { name: /^Seat B2(,|$)/ });
		const seatB3 = confirmDialog.getByRole('button', { name: /^Seat B3(,|$)/ });
		await expect(async () => {
			if ((await seatB2.getAttribute('aria-pressed')) !== 'true') {
				await seatB2.click();
			}
			await expect(seatB2).toHaveAttribute('aria-pressed', 'true', { timeout: 5_000 });
			await expect(confirmDialog.getByText('1 / 1 selected')).toBeVisible({ timeout: 5_000 });
		}).toPass({ timeout: 60_000 });
		await expect(async () => {
			if ((await seatB3.getAttribute('aria-pressed')) !== 'true') {
				await seatB3.click();
			}
			await expect(seatB3).toHaveAttribute('aria-pressed', 'true', { timeout: 5_000 });
			await expect(confirmDialog.getByText('2 / 2 selected')).toBeVisible({ timeout: 5_000 });
		}).toPass({ timeout: 60_000 });

		// Reload and reopen: BOTH seats come back as the buyer's own selection
		// (pressed, not foreign-held) and the counter is restored to 2.
		confirmDialog = await openDialog();
		await expect(confirmDialog.getByRole('button', { name: /^Seat B2(,|$)/ })).toHaveAttribute(
			'aria-pressed',
			'true',
			{ timeout: 15_000 }
		);
		await expect(confirmDialog.getByRole('button', { name: /^Seat B3(,|$)/ })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await expect(confirmDialog.getByText('2 / 2 selected')).toBeVisible();

		await context.close();
	});

	// Painting a category onto seats is a venue-wide op that always succeeds —
	// a tier whose map doesn't price it then has seats it cannot sell. With the
	// dialog OPEN the tier payload goes stale while the chart refetches (the
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
			createTicketedEvent({ freeTier: false, event: { venue_id: venue.venueId } }),
			createVerifiedUser('RepaintBuyer')
		]);
		await deleteDefaultTier(event.id);
		await createTicketTier(event.id, {
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

		const tierDialog = page.getByRole('dialog', { name: 'Select Your Ticket' });
		const confirmDialog = page.getByRole('dialog', { name: 'Reserve Ticket' });
		await expect(async () => {
			if (await confirmDialog.isVisible()) return;
			if (!(await tierDialog.isVisible())) {
				await page.getByRole('button', { name: 'Get Tickets', exact: true }).click();
			}
			await tierDialog.getByRole('button', { name: 'Reserve Ticket' }).click();
			await expect(confirmDialog).toBeVisible({ timeout: 8_000 });
		}).toPass({ timeout: 60_000 });

		// B1 starts unpainted and sellable at the base price.
		await expect(confirmDialog.getByRole('button', { name: 'Seat B1, €20.00' })).toBeVisible({
			timeout: 15_000
		});

		// NOW, dialog open: paint B1 with a brand-new category the tier has
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
		const seatA1 = confirmDialog.getByRole('button', { name: 'Seat A1, €55.00' });
		await expect(async () => {
			if ((await seatA1.getAttribute('aria-pressed')) !== 'true') {
				await seatA1.click();
			}
			await expect(seatA1).toHaveAttribute('aria-pressed', 'true', { timeout: 5_000 });
		}).toPass({ timeout: 60_000 });

		// The repainted seat greys out in place: disabled, "unavailable" aria,
		// no price quoted — while the tier's stale seat_pricing never listed
		// the new category at all.
		const b1Blocked = confirmDialog.getByRole('button', { name: 'Seat B1, unavailable' });
		await expect(b1Blocked).toBeVisible({ timeout: 15_000 });
		await expect(b1Blocked).toBeDisabled();

		await context.close();
	});

	// Whole-venue context (map scope toggle): the tier's sector stays fully
	// interactive while every other sector renders as a labelled inert ghost —
	// spatial context without pretending foreign seats are sold out. The sticky
	// footer total is visible throughout (flat tier: price × quantity).
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
			createTicketedEvent({ freeTier: false, event: { venue_id: venue.id } }),
			createVerifiedUser('VenueScope')
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

		const context = await browser.newContext();
		await authenticateContext(context, buyer);
		const page = await context.newPage();
		await gotoHydrated(page, event.path);
		await waitForClientAuth(page);

		const tierDialog = page.getByRole('dialog', { name: 'Select Your Ticket' });
		const confirmDialog = page.getByRole('dialog', { name: 'Reserve Ticket' });
		await expect(async () => {
			if (await confirmDialog.isVisible()) return;
			if (!(await tierDialog.isVisible())) {
				await page.getByRole('button', { name: 'Get Tickets', exact: true }).click();
			}
			await tierDialog.getByRole('button', { name: 'Reserve Ticket' }).click();
			await expect(confirmDialog).toBeVisible({ timeout: 8_000 });
		}).toPass({ timeout: 60_000 });

		// Multi-sector chart defaults to the map view; scope starts at the tier's
		// own section, so the other sector is nowhere in sight.
		const sectionBtn = confirmDialog.getByRole('button', { name: 'This section' });
		await expect(sectionBtn).toBeVisible({ timeout: 15_000 });
		await expect(sectionBtn).toHaveAttribute('aria-pressed', 'true');
		await expect(confirmDialog.getByText('Rear Balcony')).toBeHidden();
		// Flat tier: the sticky footer total shows price × quantity immediately.
		await expect(
			confirmDialog.locator('p', { hasText: /^Total/ }).filter({ hasText: '€20.00' })
		).toBeVisible();

		// Whole venue: the other sector appears as ONE labelled inert ghost (no
		// seat buttons of its own), while the tier's seats remain selectable.
		await confirmDialog.getByRole('button', { name: 'Whole venue' }).click();
		await expect(
			confirmDialog.getByRole('img', { name: 'Rear Balcony: sold through a different ticket' })
		).toBeVisible();
		await expect(confirmDialog.getByRole('button', { name: /Seat B1/ })).toBeHidden();
		const seatA1 = confirmDialog.getByRole('button', { name: /^Seat A1/ });
		await expect(async () => {
			if ((await seatA1.getAttribute('aria-pressed')) !== 'true') {
				await seatA1.click();
			}
			await expect(seatA1).toHaveAttribute('aria-pressed', 'true', { timeout: 5_000 });
		}).toPass({ timeout: 60_000 });

		await context.close();
	});
});
