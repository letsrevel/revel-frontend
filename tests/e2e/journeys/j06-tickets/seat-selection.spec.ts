import { test, expect } from '../../support/fixtures';
import {
	claimTicketViaApi,
	createTicketedEvent,
	createTicketTier,
	createVerifiedUser,
	deleteDefaultTier,
	getSeededConcertHall,
	listAvailableSeats
} from '../../support/factories';
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
});
