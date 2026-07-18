import { test, expect } from '../../support/fixtures';
import {
	createTicketedEvent,
	createTicketTier,
	createVerifiedUser,
	deleteDefaultTier,
	getSeatingAvailability,
	getSeatingChart,
	getSeededConcertHall,
	holdSeatsViaApi,
	releaseHoldsViaApi,
	type ThrowawayUser
} from '../../support/factories';
import { authenticateContext, uiLogin } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J19.4 + J19.6 (USER_JOURNEYS.md) and the #657 UX contract — hold CONFLICTS
// and release-on-login:
//
// 1. Foreign-hold conflict: holds are all-or-nothing server-side, so a tap on
//    a seat someone else just held 409s (conflict_reason "unavailable"). The
//    dialog must surface the conflict copy in its polite live region and,
//    after the forced availability refetch, render the seat disabled with the
//    "held by someone else" accessible name. Ordering matters: the dialog
//    opens FIRST (caching an availability snapshot where the seat is free),
//    THEN the rival holds it via the API, THEN the buyer taps it — tapping is
//    the only client action that reveals the staleness.
//
// 2. Release-on-login: anonymous holds belong to the signed guest cookie. A
//    logged-in purchase would see them as FOREIGN 409s, so the app records
//    hold-carrying events in sessionStorage (seat-holds.ts) and the root
//    layout releases them cookie-identified right after the auth bootstrap.
//    Closing the guest dialog normally RELEASES holds (reset effect), so the
//    abandoned-hold path is reached by HARD-navigating away with the dialog
//    still open — a full-page load skips the close handler while the
//    sessionStorage record survives same-tab navigation. Login itself ends in
//    a full reload (login/+page.svelte does window.location.href on the 303),
//    which re-runs the layout bootstrap that fires the release.
//
// Isolation: own events on Org Alpha attached to the seeded "Revel Concert
// Hall" (availability is per event); offline tiers keep Stripe out. Row A is
// seeded accessible (aria "…, accessible"), so seats are picked from rows B/C
// where accessible names are bare. Hold-aware retries throughout: a second
// tap on an already-pressed seat would RELEASE the hold, so loops only click
// when the seat isn't pressed yet.

/** Resolve a seat id by its label from the event's public chart. */
async function seatIdByLabel(eventId: string, label: string): Promise<string> {
	const chart = await getSeatingChart(eventId);
	for (const sector of chart.sectors) {
		const seat = (sector.seats ?? []).find((s) => s.label === label);
		if (seat) return seat.id;
	}
	throw new Error(`Seat ${label} not found on the chart for event ${eventId}`);
}

test.describe('J19 seat holds @p2', () => {
	// API-identified holds to drop after each test (anonymous guest-cookie
	// holds can't be reached from here — they expire within the 10-minute TTL).
	const holdCleanups: Array<{ user: ThrowawayUser; eventId: string }> = [];

	test.afterEach(async () => {
		for (const { user, eventId } of holdCleanups.splice(0)) {
			await releaseHoldsViaApi(user, eventId).catch(() => undefined);
		}
	});

	test('foreign hold: tapping a just-taken seat surfaces the conflict, seat flips unavailable', async ({
		browser
	}) => {
		test.setTimeout(180_000);

		const hall = await getSeededConcertHall();
		const [event, buyer, rival] = await Promise.all([
			// The chart endpoint reads event.venue_id — attach the hall to the EVENT
			// (the tier's venue_id alone 404s "This event has no venue").
			createTicketedEvent({ freeTier: false, event: { venue_id: hall.venueId } }),
			createVerifiedUser('HoldBuyer'),
			createVerifiedUser('HoldRival')
		]);
		await deleteDefaultTier(event.id); // its card also says "Reserve Ticket"
		await createTicketTier(event.id, {
			name: 'Choose Your Seat',
			payment_method: 'offline',
			price: '25.00',
			seat_assignment_mode: 'user_choice',
			venue_id: hall.venueId,
			sector_id: hall.sectorId
		});
		const contestedSeatId = await seatIdByLabel(event.id, 'B2');

		const context = await browser.newContext();
		try {
			await authenticateContext(context, buyer);
			const page = await context.newPage();
			await gotoHydrated(page, event.path);
			await waitForClientAuth(page);

			// Open the confirmation dialog (idempotent loop, see seat-selection.spec.ts).
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

			// The map is rendered with B2 free — this availability snapshot is now
			// the client's cache; nothing refetches it until the buyer's next tap.
			await expect(confirmDialog.getByText('STAGE')).toBeVisible({ timeout: 15_000 });
			const freeSeat = confirmDialog.getByRole('button', { name: 'Seat B2', exact: true });
			await expect(freeSeat).toBeEnabled();

			// NOW the rival grabs B2 through the API — the buyer's map is stale.
			await holdSeatsViaApi(rival, event.id, [contestedSeatId]);
			holdCleanups.push({ user: rival, eventId: event.id });

			// Tapping the stale seat POSTs a hold that 409s (all-or-nothing). The
			// conflict copy must land in the dialog's polite live region.
			const conflict = confirmDialog
				.locator('[aria-live="polite"]')
				.getByText('That seat was just taken — please pick another.');
			await expect(async () => {
				if (await conflict.isVisible()) return;
				await freeSeat.click();
				await expect(conflict).toBeVisible({ timeout: 5_000 });
			}).toPass({ timeout: 30_000 });

			// The 409 forces an availability refetch: B2 flips to the disabled
			// held-by-someone-else state (accessible name carries the status).
			const heldSeat = confirmDialog.getByRole('button', {
				name: 'Seat B2, held by someone else'
			});
			await expect(heldSeat).toBeDisabled({ timeout: 15_000 });

			// Recovery: a different free seat still holds fine (hold-aware loop —
			// a second click would release), and the next tap clears the conflict.
			const altSeat = confirmDialog.getByRole('button', { name: 'Seat B4', exact: true });
			await expect(async () => {
				if ((await altSeat.getAttribute('aria-pressed')) !== 'true') {
					await altSeat.click();
				}
				await expect(altSeat).toHaveAttribute('aria-pressed', 'true', { timeout: 5_000 });
			}).toPass({ timeout: 30_000 });
			holdCleanups.push({ user: buyer, eventId: event.id });
			await expect(
				confirmDialog.getByText('Selected seats are held for you for 10 minutes.')
			).toBeVisible();
			await expect(conflict).toBeHidden();
		} finally {
			await context.close();
		}
	});

	test('release-on-login: abandoned anonymous hold is released after signing in', async ({
		page
	}) => {
		test.setTimeout(180_000);

		const hall = await getSeededConcertHall();
		const [event, account] = await Promise.all([
			createTicketedEvent({
				freeTier: false,
				event: { can_attend_without_login: true, venue_id: hall.venueId }
			}),
			createVerifiedUser('HoldLogin')
		]);
		await deleteDefaultTier(event.id); // its card also says "Get Ticket" to guests
		await createTicketTier(event.id, {
			name: 'Guest Choose Seat',
			payment_method: 'offline',
			price: '15.00',
			seat_assignment_mode: 'user_choice',
			venue_id: hall.venueId,
			sector_id: hall.sectorId
		});
		const seatId = await seatIdByLabel(event.id, 'C3');

		// ANONYMOUS visitor: the tier card CTA opens the guest dialog directly.
		await gotoHydrated(page, event.path);
		const guestDialog = page.getByRole('dialog', { name: 'Get tickets without an account' });
		await expect(async () => {
			if (await guestDialog.isVisible()) return;
			await page.getByRole('button', { name: 'Get Ticket', exact: true }).first().click();
			await expect(guestDialog).toBeVisible({ timeout: 5_000 });
		}).toPass({ timeout: 60_000 });

		await expect(guestDialog.getByText('STAGE')).toBeVisible({ timeout: 15_000 });

		// Tap C3 — the first anonymous hold mints the signed guest cookie and
		// records the event in sessionStorage for release-on-login.
		const seat = guestDialog.getByRole('button', { name: 'Seat C3', exact: true });
		await expect(async () => {
			if ((await seat.getAttribute('aria-pressed')) !== 'true') {
				await seat.click();
			}
			await expect(seat).toHaveAttribute('aria-pressed', 'true', { timeout: 5_000 });
		}).toPass({ timeout: 60_000 });
		await expect(
			guestDialog.getByText('Selected seats are held for you for 10 minutes.')
		).toBeVisible();

		// Server truth: the seat reads as held to an identity-less probe (the
		// raw fetch carries no cookie jar, so the hold is foreign to it).
		await expect
			.poll(async () => (await getSeatingAvailability(event.id)).seats[seatId], {
				timeout: 10_000
			})
			.toBe('held');

		// HARD-navigate away with the dialog still open: the full-page load
		// skips the dialog's close-time release, so the hold stays alive…
		await gotoHydrated(page, '/login');
		expect((await getSeatingAvailability(event.id)).seats[seatId]).toBe('held');

		// …until login. The 303 → full reload re-runs the root layout's auth
		// bootstrap, which reads the sessionStorage record and releases the
		// guest-cookie holds without an Authorization header (seat-holds.ts).
		await uiLogin(page, account);
		await waitForClientAuth(page);

		await expect
			.poll(async () => (await getSeatingAvailability(event.id)).seats[seatId], {
				timeout: 30_000
			})
			.toBeUndefined();
	});
});
