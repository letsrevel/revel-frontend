import { test, expect } from '../../support/fixtures';
import { gotoHydrated } from '../../support/navigation';
import { API_URL, ApiClient } from '../../support/api';
import {
	createOrganization,
	createPriceCategory,
	createTicketedEvent,
	createTicketTier,
	deleteDefaultTier,
	getSeatingAvailability,
	getSeatingChart,
	getSeededConcertHall,
	uniqueEmail,
	uniqueName
} from '../../support/factories';
import { extractLink, waitForEmail } from '../../support/mailpit';

// J7.4 + J19.6 (USER_JOURNEYS.md) — guest SEATED checkout on a FREE
// user_choice tier: an anonymous visitor taps a seat in the guest dialog
// (the first hold mints the server-signed revel_guest_hold cookie), submits
// name + email, and gets the email-confirm flow (free/offline tiers never
// hold-at-checkout — the ticket is only created when the emailed token is
// confirmed). Confirming in the SAME browser context matters: the guest
// cookie is the hold identity, so the buyer's own live hold is consumed
// rather than rejected as a foreign 409 conflict.
//
// Isolation: own event on Org Alpha attached to the seeded "Revel Concert
// Hall" 10×10 grid (availability is per event, so other specs' seats are
// untouched). Row A is seeded accessible (aria "…, accessible"), so the spec
// works in row B where seat names are bare. max_tickets_per_user=1 keeps the
// dialog in its single-ticket shape (no quantity stepper / per-ticket name
// inputs) — quantity is exactly 1.
//
// Hold-awareness: every seat tap is a real POST /seating/holds round-trip and
// a second tap RELEASES the hold, so retry loops only click while the seat is
// not yet pressed (same pattern as j06 seat-selection.spec.ts).

test.describe('J7 guest seated checkout @p2', () => {
	test('anonymous seat hold → guest dialog submit → email confirm consumes own hold → ticket has the seat', async ({
		page
	}) => {
		// Email round-trip + several hold round-trips don't fit the default budget.
		test.setTimeout(180_000);

		const hall = await getSeededConcertHall();
		const event = await createTicketedEvent({
			freeTier: false,
			// The chart endpoint reads event.venue_id — attach the hall to the EVENT
			// (the tier's venue_id alone 404s "This event has no venue").
			event: { can_attend_without_login: true, venue_id: hall.venueId }
		});
		await deleteDefaultTier(event.id); // its card shows the same "Get Ticket" CTA
		await createTicketTier(event.id, {
			name: 'Guest Seated Free',
			payment_method: 'free',
			price: '0.00',
			price_type: 'fixed',
			seat_assignment_mode: 'user_choice',
			venue_id: hall.venueId,
			sector_id: hall.sectorId,
			max_tickets_per_user: 1
		});

		// Resolve the target seat's id up front (anonymous chart — it's public).
		const chart = await getSeatingChart(event.id);
		const seatB2 = chart.sectors
			.find((sector) => sector.id === hall.sectorId)
			?.seats?.find((seat) => seat.label === 'B2');
		if (!seatB2) throw new Error('Seeded seat B2 missing from Revel Concert Hall');

		const email = uniqueEmail('GuestSeated');

		try {
			await gotoHydrated(page, event.path);

			// Open the guest dialog (idempotent loop — clicks during hydration are
			// occasionally dropped, see guest-online-checkout.spec.ts).
			const guestDialog = page.getByRole('dialog', { name: 'Get tickets without an account' });
			const tierCta = page.getByRole('button', { name: 'Get Ticket', exact: true }).first();
			await expect(async () => {
				if (await guestDialog.isVisible()) return;
				await tierCta.click();
				await expect(guestDialog).toBeVisible({ timeout: 5_000 });
			}).toPass({ timeout: 60_000 });

			// The seat map renders inside the dialog for a user_choice tier.
			await expect(guestDialog.getByText('Select Your Seat')).toBeVisible({ timeout: 15_000 });
			await expect(guestDialog.getByText('STAGE')).toBeVisible({ timeout: 15_000 });

			// Tap B2 — the tap IS the anonymous server hold (this first hold mints
			// the guest cookie). Only click while not pressed: a second click would
			// release the hold. Pressed state + the held notice prove the hold.
			const seatButton = guestDialog.getByRole('button', { name: 'Seat B2', exact: true });
			await expect(async () => {
				if ((await seatButton.getAttribute('aria-pressed')) !== 'true') {
					await seatButton.click();
				}
				await expect(seatButton).toHaveAttribute('aria-pressed', 'true', { timeout: 5_000 });
				await expect(
					guestDialog.getByText('Selected seats are held for you for 10 minutes.')
				).toBeVisible();
			}).toPass({ timeout: 60_000 });

			// Server-side: the guest-cookie hold reads as 'held' to everyone else
			// (the Node fetch here carries no cookie, so it's a foreign observer).
			await expect(async () => {
				const availability = await getSeatingAvailability(event.id);
				expect(availability.seats[seatB2.id]).toBe('held');
			}).toPass({ timeout: 15_000 });

			// Identify + submit. Free tier → email-confirm flow: the dialog flips to
			// "Check your email!" and NO ticket exists yet. Idempotent loop again —
			// once the success pane is up the form is unmounted, so just return.
			const checkEmail = guestDialog.getByText('Check your email!');
			await expect(async () => {
				if (await checkEmail.isVisible()) return;
				await guestDialog.getByLabel('Email address').fill(email);
				await guestDialog.getByLabel('First name').fill('E2E');
				await guestDialog.getByLabel('Last name').fill('GuestSeated');
				await expect(guestDialog.getByLabel('Email address')).toHaveValue(email, {
					timeout: 2_000
				});
				await guestDialog.getByRole('button', { name: 'Get Ticket', exact: true }).click();
				await expect(checkEmail).toBeVisible({ timeout: 10_000 });
			}).toPass({ timeout: 60_000 });
			await expect(guestDialog.getByText(email)).toBeVisible();

			// The hold survives the submit (purchase is handed off to the email
			// flow, NOT released on dialog success) — it must still be live when
			// the guest confirms.
			const afterSubmit = await getSeatingAvailability(event.id);
			expect(afterSubmit.seats[seatB2.id]).toBe('held');

			// Fetch the confirmation email and its confirm-action link.
			const message = await waitForEmail({ to: email, subject: 'Confirm your ticket for' });
			expect(message.Subject).toContain(event.name);
			const link = extractLink(message, /confirm-action\?token=/);

			// The confirm page POSTs /guest-actions/confirm on mount; capture the
			// BatchCheckoutResponse to assert the created ticket carries the seat
			// (the page itself only says "Ticket Confirmed!", it doesn't show it).
			type ConfirmedSeat = { label?: string; row_label?: string | null };
			let confirmedSeat: ConfirmedSeat | null = null;
			// Getter defeats TS's flow narrowing (the assignment lives in a closure).
			const getConfirmedSeat = (): ConfirmedSeat | null => confirmedSeat;
			page.on('response', (response) => {
				if (!response.url().includes('/api/events/guest-actions/confirm') || !response.ok()) {
					return;
				}
				void response
					.json()
					.then((body: { tickets?: Array<{ seat?: ConfirmedSeat | null }> }) => {
						confirmedSeat = body.tickets?.[0]?.seat ?? confirmedSeat;
					})
					.catch(() => undefined);
			});

			// Confirm in the SAME browser context: the guest cookie rides along, so
			// the buyer's own hold on B2 is consumed instead of 409-ing as foreign.
			// The confirm POST has no retry of its own — drive the UI's Try Again
			// on transient failures (same pattern as guest-rsvp.spec.ts).
			await page.goto(link);
			await expect(async () => {
				const retry = page.getByRole('button', { name: 'Try Again' });
				if (await retry.isVisible()) await retry.click();
				await expect(page.getByRole('heading', { name: 'Ticket Confirmed!' })).toBeVisible({
					timeout: 10_000
				});
			}).toPass({ timeout: 45_000 });
			await expect(page.getByRole('button', { name: 'View Event Details' })).toBeVisible();

			// The ticket carries the picked seat (row/seat from the confirm payload).
			await expect.poll(() => getConfirmedSeat()?.label, { timeout: 10_000 }).toBe('B2');
			expect(getConfirmedSeat()?.row_label).toBe('B');

			// And the seat converted from hold to SOLD for everyone.
			await expect(async () => {
				const availability = await getSeatingAvailability(event.id);
				expect(availability.seats[seatB2.id]).toBe('sold');
			}).toPass({ timeout: 15_000 });
		} finally {
			// Cleanup: release any leftover guest-cookie holds (a successful run has
			// none — the purchase consumed them; a mid-test failure would otherwise
			// pin B2 for up to 10 minutes). Must run IN the page so the guest cookie
			// is the identity; releaseHoldsViaApi would target a logged-in user.
			await page
				.evaluate(
					async ({ apiUrl, eventId }) => {
						await fetch(`${apiUrl}/api/events/${eventId}/seating/holds`, {
							method: 'DELETE',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ seat_ids: null }),
							credentials: 'include'
						});
					},
					{ apiUrl: API_URL, eventId: event.id }
				)
				.catch(() => undefined);
		}
	});
});

// J7 (USER_JOURNEYS.md) — guest BEST_AVAILABLE checkout surface: a FREE
// best-available guest tier never lets the buyer pick seats (the server assigns
// the best adjacent block), but it MUST still expose the wheelchair-accessible
// opt-in — free/offline tiers carry it in the emailed confirmation token and
// assign from the accessible pool. This asserts the accessible checkbox and the
// email-assignment notice render together in the guest dialog.
//
// Isolation: throwaway org + venue + price category; a guest-enabled event on
// that org with a single best_available FREE tier (best_available requires a
// price category — backend TicketTierCreateSchema validator). Nothing seeded is
// touched, and no seats are held (best_available never holds at the email flow).
test.describe('J7 guest best-available accessible @p2', () => {
	test('best_available free guest tier shows the accessible opt-in and email-assignment notice', async ({
		page
	}) => {
		test.setTimeout(120_000);

		const org = await createOrganization();
		const api = await ApiClient.login(org.owner.email, org.owner.password);
		const venue = await api.post<{ id: string }>(`/api/organization-admin/${org.slug}/venues`, {
			name: uniqueName('Venue')
		});
		const category = await createPriceCategory(org.slug, venue.id, { name: 'Galleria' }, org.owner);
		const event = await createTicketedEvent({
			owner: org.owner,
			orgSlug: org.slug,
			freeTier: false,
			event: { can_attend_without_login: true, venue_id: venue.id }
		});
		// The backend auto-creates a "General Admission" tier; drop it so the only
		// "Get Ticket" CTA belongs to our best_available tier (strict-mode safe).
		await deleteDefaultTier(event.id, org.owner);
		await createTicketTier(
			event.id,
			{
				name: 'Guest Best Available Free',
				payment_method: 'free',
				price: '0.00',
				price_type: 'fixed',
				seat_assignment_mode: 'best_available',
				price_category_id: category.id,
				venue_id: venue.id,
				max_tickets_per_user: 1
			},
			org.owner
		);

		await gotoHydrated(page, event.path);

		// Open the guest dialog (idempotent loop — clicks during hydration are
		// occasionally dropped, same pattern as the seated flow above).
		const guestDialog = page.getByRole('dialog', { name: 'Get tickets without an account' });
		const tierCta = page.getByRole('button', { name: 'Get Ticket', exact: true }).first();
		await expect(async () => {
			if (await guestDialog.isVisible()) return;
			await tierCta.click();
			await expect(guestDialog).toBeVisible({ timeout: 5_000 });
		}).toPass({ timeout: 60_000 });

		// Best-available section: no seat picker, but the accessible opt-in and
		// the "assigned when you confirm your email" notice render together.
		await expect(guestDialog.getByText('Best available seats')).toBeVisible({ timeout: 15_000 });
		await expect(
			guestDialog.getByRole('checkbox', { name: 'I need wheelchair-accessible seats' })
		).toBeVisible();
		await expect(
			guestDialog.getByText(
				'Your seats will be assigned automatically when you confirm your email.'
			)
		).toBeVisible();
	});
});
