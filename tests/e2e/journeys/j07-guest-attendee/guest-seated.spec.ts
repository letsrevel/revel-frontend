import type { Page } from '@playwright/test';
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
	createPlainConcertHall,
	uniqueEmail,
	uniqueName
} from '../../support/factories';
import { extractLink, waitForEmail } from '../../support/mailpit';

// J7.4 + J19.6 (USER_JOURNEYS.md) — guest SEATED checkout on the cart flow
// (#853 PR 3/4): an anonymous visitor gets the SAME "Pick seats…" entry point
// on the tier card an authenticated buyer sees (`TierCard`'s
// `canTransact = isAuthenticated || canAttendWithoutLogin`), which opens
// `SeatPickerDialog` (testid `seat-picker-dialog`, the SAME `SeatPickerPanel`
// map/hold UI seat-holds.spec.ts's foreign-hold test drives). Tapping a seat
// IS the anonymous server hold (the first hold mints the server-signed
// `revel_guest_hold` cookie); Done hands the pick to the cart. Buy ALWAYS
// opens the checkout sheet for a guest, where email (+ name, per
// `require_ticket_names`) is collected. Free/offline tiers never hold-at-
// checkout — confirming the sheet gets the email-confirm flow
// (`CartEmailConfirmation` dialog closes the sheet; the ticket is only
// created when the emailed token is confirmed). Confirming in the SAME
// browser context matters: the guest cookie is the hold identity, so the
// buyer's own live hold is consumed rather than rejected as a foreign 409
// conflict.
//
// #853 rewrite (task 9): replaces the deleted `GuestTicketDialog` flow, and
// extends it to a MIXED multi-tier guest cart (seated + GA in one cart, one
// email, one confirm) — the series' capstone assertion, proving
// `ConfirmationResult`'s multi-ticket rendering (#853 Task 7) end to end for
// a real guest purchase.
//
// Isolation: own events on Org Alpha attached to the seeded "Revel Concert
// Hall" 10×10 grid (availability is per event, so other specs' seats are
// untouched) or a throwaway org's own painted venue. Row A is seeded
// accessible (aria "…, accessible"), so specs use rows B/C where seat names
// are bare.
//
// Hold-awareness: every seat tap is a real POST /seating/holds round-trip and
// a second tap RELEASES the hold, so retry loops only click while the seat is
// not yet pressed (same pattern as j06 seat-selection.spec.ts).

/** Release any leftover guest-cookie holds for `eventId` IN the page (the
 * guest cookie is the identity — `releaseHoldsViaApi` would target a logged-in
 * user instead). A successful run has none; a mid-test failure would
 * otherwise pin the seat for up to 10 minutes. */
async function releaseGuestHolds(page: Page, eventId: string): Promise<void> {
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
			{ apiUrl: API_URL, eventId }
		)
		.catch(() => undefined);
}

type ConfirmedTicket = {
	seat?: { label?: string; row_label?: string | null } | null;
	tier?: { id?: string; name?: string } | null;
};

/** Captures the `/guest-actions/confirm` response's `tickets` array — the
 * confirm page itself only says "Ticket Confirmed!", it doesn't render the
 * seat/tier detail, so the network layer is the only way to assert it. */
function captureConfirmTickets(page: Page): () => ConfirmedTicket[] | null {
	let tickets: ConfirmedTicket[] | null = null;
	page.on('response', (response) => {
		if (!response.url().includes('/api/events/guest-actions/confirm') || !response.ok()) return;
		void response
			.json()
			.then((body: { tickets?: ConfirmedTicket[] }) => {
				tickets = body.tickets ?? tickets;
			})
			.catch(() => undefined);
	});
	// Getter defeats TS's flow narrowing (the assignment lives in a closure).
	return () => tickets;
}

test.describe('J7 guest seated checkout @p2', () => {
	test('anonymous seat hold → sheet submit → email confirm consumes own hold → ticket has the seat', async ({
		page
	}) => {
		// Email round-trip + several hold round-trips don't fit the default budget.
		test.setTimeout(180_000);

		const hall = await createPlainConcertHall();
		const event = await createTicketedEvent({
			freeTier: false,
			// The chart endpoint reads event.venue_id — attach the hall to the EVENT
			// (the tier's venue_id alone 404s "This event has no venue").
			event: { can_attend_without_login: true, venue_id: hall.venueId }
		});
		await deleteDefaultTier(event.id); // its stepper would also render
		// user_choice tiers have no stepper (just the "Pick seats…" button below,
		// unambiguous once the default tier is gone) — the created tier's id/name
		// is never read again, so its result isn't bound.
		await createTicketTier(event.id, {
			name: 'Guest Seated Free',
			payment_method: 'free',
			price: '0.00',
			price_type: 'fixed',
			seat_assignment_mode: 'user_choice',
			venue_id: hall.venueId,
			sector_id: hall.sectorId
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

			// "Pick seats…" opens the seat-picker dialog directly (idempotent
			// loop — clicks during hydration are occasionally dropped).
			const picker = page.getByTestId('seat-picker-dialog');
			await expect(async () => {
				if (await picker.isVisible()) return;
				await page.getByRole('button', { name: 'Pick seats…', exact: true }).first().click();
				await expect(picker).toBeVisible({ timeout: 8_000 });
			}).toPass({ timeout: 60_000 });

			await expect(picker.getByText('STAGE')).toBeVisible({ timeout: 15_000 });

			// Tap B2 — the tap IS the anonymous server hold (this first hold mints
			// the guest cookie). Only click while not pressed: a second click would
			// release the hold. Pressed state + the held notice prove the hold.
			const seatButton = picker.getByRole('button', { name: /^Seat B2(,|$)/ });
			await expect(async () => {
				if ((await seatButton.getAttribute('aria-pressed')) !== 'true') {
					await seatButton.click();
				}
				await expect(seatButton).toHaveAttribute('aria-pressed', 'true', { timeout: 5_000 });
				await expect(
					picker.getByText('Selected seats are held for you for 10 minutes.')
				).toBeVisible();
			}).toPass({ timeout: 60_000 });

			// Server-side: the guest-cookie hold reads as 'held' to everyone else
			// (the Node fetch here carries no cookie, so it's a foreign observer).
			await expect(async () => {
				const availability = await getSeatingAvailability(event.id);
				expect(availability.seats[seatB2.id]).toBe('held');
			}).toPass({ timeout: 15_000 });

			// Done hands the pick to the cart — the dialog closes and the cart
			// group appears.
			await picker.getByRole('button', { name: 'Done', exact: true }).click();
			await expect(picker).toBeHidden();

			const summaryBar = page.getByTestId('cart-summary-bar');
			await summaryBar.getByRole('button', { name: 'Buy', exact: true }).click();

			// Checkout sheet: identity + this group's ticket-holder name
			// (require_ticket_names defaults true). Free tier → the confirm label
			// is "Claim" and, being non-online, submitting gets the email-confirm
			// flow: the checkout sheet closes and `CartEmailConfirmation` opens —
			// NO ticket exists client-side yet.
			const sheet = page.getByRole('dialog', { name: 'Checkout' });
			await expect(sheet).toBeVisible();

			// Idempotent loop (submit clicks are occasionally dropped, same pattern
			// as best-available.spec.ts's Reserve): retry from whatever state the
			// UI is in until the email-confirm dialog opens.
			const confirmDialog = page.getByRole('dialog', { name: 'Check your email!' });
			await expect(async () => {
				if (await confirmDialog.isVisible()) return;
				await sheet.getByLabel('Email address').fill(email);
				await sheet.getByLabel('First name').fill('E2E');
				await sheet.getByLabel('Last name').fill('GuestSeated');
				await sheet.getByLabel('Name for ticket 1').fill('E2E Guest 1');
				await expect(sheet.getByLabel('Email address')).toHaveValue(email, { timeout: 2_000 });
				await sheet.getByRole('button', { name: 'Claim', exact: true }).click();
				await expect(confirmDialog).toBeVisible({ timeout: 10_000 });
			}).toPass({ timeout: 60_000 });
			await expect(confirmDialog.getByText(email)).toBeVisible();
			await expect(sheet).toBeHidden();

			// The hold survives the submit (purchase is handed off to the email
			// flow, NOT released on submit) — it must still be live when the guest
			// confirms.
			const afterSubmit = await getSeatingAvailability(event.id);
			expect(afterSubmit.seats[seatB2.id]).toBe('held');

			// Fetch the confirmation email and its confirm-action link.
			const message = await waitForEmail({ to: email, subject: 'Confirm your ticket for' });
			expect(message.Subject).toContain(event.name);
			const link = extractLink(message, /confirm-action\?token=/);

			// The confirm page POSTs /guest-actions/confirm on mount; capture the
			// BatchCheckoutResponse to assert the created ticket carries the seat.
			const getTickets = captureConfirmTickets(page);

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

			// Single-tier cart: the pluralized count line, no per-tier breakdown
			// (that only renders when tierBreakdown.length > 1 — the mixed-cart
			// test below covers it).
			await expect(page.getByText('1 ticket confirmed')).toBeVisible();

			// The ticket carries the picked seat (row/seat from the confirm payload).
			await expect.poll(() => getTickets()?.[0]?.seat?.label, { timeout: 10_000 }).toBe('B2');
			expect(getTickets()?.[0]?.seat?.row_label).toBe('B');

			// And the seat converted from hold to SOLD for everyone.
			await expect(async () => {
				const availability = await getSeatingAvailability(event.id);
				expect(availability.seats[seatB2.id]).toBe('sold');
			}).toPass({ timeout: 15_000 });
		} finally {
			await releaseGuestHolds(page, event.id);
		}
	});

	// J7 (USER_JOURNEYS.md) — guest BEST_AVAILABLE checkout surface: a FREE
	// best-available guest tier never lets the buyer pick seats (the server
	// assigns the best adjacent block from the accessible-aware pool). The tier
	// is `quickBuyEligible` (same as any GA tier) — its inline stepper feeds
	// straight into the sheet, which exposes the accessible opt-in and the
	// mandatory zone picker (pricing convergence: a seated tier's category_prices
	// define its zones) alongside the email-assignment notice. Non-online, so
	// confirming gets the email-confirm flow same as the seated test above —
	// this extends the legacy UI-only assertion to a real completed purchase,
	// proving the notice's actual claim (seats assigned at email-confirm time).
	//
	// Isolation: throwaway org + venue + painted sector; a guest-enabled event on
	// that org with a single MAPPED best_available FREE tier. Nothing seeded is
	// touched, and no seats are held (best_available never holds before confirm).
	test('best_available free tier: zone/accessible + email-assignment notice → email confirm assigns a seat', async ({
		page
	}) => {
		test.setTimeout(120_000);

		const org = await createOrganization();
		const api = await ApiClient.login(org.owner.email, org.owner.password);
		const venue = await api.post<{ id: string }>(`/api/organization-admin/${org.slug}/venues`, {
			name: uniqueName('Venue')
		});
		const category = await createPriceCategory(org.slug, venue.id, { name: 'Galleria' }, org.owner);
		// A seated tier of either mode now requires a sector; paint its seats so
		// the tier's single zone has a real pool.
		const sector = await api.post<{ id: string; seats: Array<{ id: string }> }>(
			`/api/organization-admin/${org.slug}/venues/${venue.id}/sectors`,
			{
				name: 'Stalls',
				kind: 'seated',
				// Seat writes still use `row` (becomes `row_label` in the Phase-2 rename).
				seats: Array.from({ length: 4 }, (_, i) => ({
					label: `A${i + 1}`,
					row: 'A',
					number: i + 1,
					price_category_id: category.id
				}))
			}
		);
		const event = await createTicketedEvent({
			owner: org.owner,
			orgSlug: org.slug,
			freeTier: false,
			event: { can_attend_without_login: true, venue_id: venue.id }
		});
		// The backend auto-creates a "General Admission" tier; drop it so only
		// the target tier's stepper renders.
		await deleteDefaultTier(event.id, org.owner);
		const tier = await createTicketTier(
			event.id,
			{
				name: 'Guest Best Available Free',
				payment_method: 'free',
				price: '0.00',
				price_type: 'fixed',
				seat_assignment_mode: 'best_available',
				venue_id: venue.id,
				sector_id: sector.id,
				category_prices: { [category.id]: '0.00' }
			},
			org.owner
		);

		const email = uniqueEmail('GuestBestAvailable');
		await gotoHydrated(page, event.path);

		const stepper = page.getByRole('group', { name: `Quantity for ${tier.name}` });
		await expect(stepper).toBeVisible({ timeout: 15_000 });
		// No seat-picker entry point exists for a best_available tier.
		await expect(page.getByRole('button', { name: 'Pick seats…' })).toHaveCount(0);
		await stepper.getByRole('button', { name: `Add one ${tier.name}` }).click();
		await expect(stepper.locator('span[aria-live="polite"]')).toHaveText('1');

		const summaryBar = page.getByTestId('cart-summary-bar');
		await summaryBar.getByRole('button', { name: 'Buy', exact: true }).click();

		const sheet = page.getByRole('dialog', { name: 'Checkout' });
		await expect(sheet).toBeVisible();

		// Best-available section: no seat map, but the accessible opt-in and the
		// "assigned when you confirm your email" notice render together — the
		// notice only shows for a non-online payment method (this tier is free).
		await expect(sheet.getByText('Select Your Seats')).toBeHidden();
		await expect(sheet.getByText('STAGE')).toBeHidden();
		await expect(
			sheet.getByRole('checkbox', { name: 'I need wheelchair-accessible seats' })
		).toBeVisible();
		await expect(
			sheet.getByText('Your seats will be assigned automatically when you confirm your email.')
		).toBeVisible();

		// Mapped tier (pricing convergence): the mandatory zone picker renders,
		// auto-selecting the single zone once availability loads.
		await expect(sheet.getByText('Seating zone', { exact: true })).toBeVisible();
		await expect(sheet.getByRole('radio', { name: /Galleria/ })).toBeChecked({ timeout: 8_000 });

		const confirmDialog = page.getByRole('dialog', { name: 'Check your email!' });
		await expect(async () => {
			if (await confirmDialog.isVisible()) return;
			await sheet.getByLabel('Email address').fill(email);
			await sheet.getByLabel('First name').fill('E2E');
			await sheet.getByLabel('Last name').fill('GuestBA');
			await sheet.getByLabel('Name for ticket 1').fill('E2E Guest 1');
			await expect(sheet.getByLabel('Email address')).toHaveValue(email, { timeout: 2_000 });
			await sheet.getByRole('button', { name: 'Claim', exact: true }).click();
			await expect(confirmDialog).toBeVisible({ timeout: 10_000 });
		}).toPass({ timeout: 60_000 });
		await expect(sheet).toBeHidden();

		const message = await waitForEmail({ to: email, subject: 'Confirm your ticket for' });
		expect(message.Subject).toContain(event.name);
		const link = extractLink(message, /confirm-action\?token=/);

		const getTickets = captureConfirmTickets(page);
		await page.goto(link);
		await expect(async () => {
			const retry = page.getByRole('button', { name: 'Try Again' });
			if (await retry.isVisible()) await retry.click();
			await expect(page.getByRole('heading', { name: 'Ticket Confirmed!' })).toBeVisible({
				timeout: 10_000
			});
		}).toPass({ timeout: 45_000 });

		// The server auto-assigned a seat from the painted "Stalls" pool at
		// confirm time — the notice's claim, proven end to end.
		await expect.poll(() => getTickets()?.[0]?.seat?.row_label, { timeout: 10_000 }).toBe('A');
	});

	// #853 capstone (task 9): a MIXED multi-tier guest cart — one seated
	// user_choice group + one plain GA group, in ONE cart, ONE email, ONE
	// confirm — proving `ConfirmationResult`'s multi-ticket rendering (#853
	// Task 7's `summarizeConfirmedTickets`/`cartSheet.confirmedTicketCount`
	// pluralization + per-tier breakdown) end to end for a real guest
	// purchase, not just the component's own unit tests.
	//
	// require_ticket_names is OFF here (deliberately) — that surface is
	// already covered by guest-email-only-checkout.spec.ts; keeping it off
	// here isolates the assertion this test exists for (multi-ticket
	// confirmation rendering) from per-ticket name filling.
	test('mixed cart (seated + GA): one email confirms both, confirmation page shows the multi-ticket count', async ({
		page
	}) => {
		test.setTimeout(180_000);

		const hall = await createPlainConcertHall();
		const event = await createTicketedEvent({
			freeTier: false,
			event: {
				can_attend_without_login: true,
				venue_id: hall.venueId,
				require_ticket_names: false
			}
		});
		await deleteDefaultTier(event.id);
		const seatedTier = await createTicketTier(event.id, {
			name: 'Guest Mixed Seated',
			payment_method: 'free',
			price: '0.00',
			price_type: 'fixed',
			seat_assignment_mode: 'user_choice',
			venue_id: hall.venueId,
			sector_id: hall.sectorId
		});
		const gaTier = await createTicketTier(event.id, {
			name: 'Guest Mixed GA',
			payment_method: 'free',
			price: '0.00',
			price_type: 'fixed',
			seat_assignment_mode: 'none',
			total_quantity: 50
		});

		const chart = await getSeatingChart(event.id);
		const seatC2 = chart.sectors
			.find((sector) => sector.id === hall.sectorId)
			?.seats?.find((seat) => seat.label === 'C2');
		if (!seatC2) throw new Error('Seeded seat C2 missing from Revel Concert Hall');

		const email = uniqueEmail('GuestMixed');

		try {
			await gotoHydrated(page, event.path);

			// Pick a seat for the seated tier first.
			const picker = page.getByTestId('seat-picker-dialog');
			await expect(async () => {
				if (await picker.isVisible()) return;
				await page.getByRole('button', { name: 'Pick seats…', exact: true }).first().click();
				await expect(picker).toBeVisible({ timeout: 8_000 });
			}).toPass({ timeout: 60_000 });
			await expect(picker.getByText('STAGE')).toBeVisible({ timeout: 15_000 });

			const seatButton = picker.getByRole('button', { name: /^Seat C2(,|$)/ });
			await expect(async () => {
				if ((await seatButton.getAttribute('aria-pressed')) !== 'true') {
					await seatButton.click();
				}
				await expect(seatButton).toHaveAttribute('aria-pressed', 'true', { timeout: 5_000 });
			}).toPass({ timeout: 60_000 });

			// Done, then let the seated group settle (its OWN `CartSeatGroupHolds`
			// mounts fresh and seeds from a fresh chart/availability fetch) BEFORE
			// adding the second tier — the summary bar's "1 ticket" is the signal
			// that write has landed, so the two groups' cart writes don't race.
			// Idempotent loop: under heavy parallel-worker load the settle can
			// outrun a short fixed wait, and a dropped click would otherwise hang.
			const summaryBar = page.getByTestId('cart-summary-bar');
			await expect(async () => {
				if (await summaryBar.getByText('1 ticket').isVisible()) return;
				if (await picker.isVisible()) {
					await picker.getByRole('button', { name: 'Done', exact: true }).click();
				}
				await expect(summaryBar.getByText('1 ticket')).toBeVisible({ timeout: 10_000 });
			}).toPass({ timeout: 45_000 });
			await expect(picker).toBeHidden();

			// Add the GA tier into the SAME cart.
			const gaStepper = page.getByRole('group', { name: `Quantity for ${gaTier.name}` });
			await expect(gaStepper).toBeVisible({ timeout: 15_000 });
			await gaStepper.getByRole('button', { name: `Add one ${gaTier.name}` }).click();
			await expect(gaStepper.locator('span[aria-live="polite"]')).toHaveText('1');

			// Both groups now in the SAME cart.
			await expect(summaryBar.getByText('2 tickets')).toBeVisible({ timeout: 10_000 });
			await summaryBar.getByRole('button', { name: 'Buy', exact: true }).click();

			// Sheet: both groups present, names off, email only.
			const sheet = page.getByRole('dialog', { name: 'Checkout' });
			await expect(sheet).toBeVisible();
			await expect(sheet.getByText(`${seatedTier.name} × 1`, { exact: true })).toBeVisible();
			await expect(sheet.getByText(`${gaTier.name} × 1`, { exact: true })).toBeVisible();

			const confirmDialog = page.getByRole('dialog', { name: 'Check your email!' });
			await expect(async () => {
				if (await confirmDialog.isVisible()) return;
				await sheet.getByLabel('Email address').fill(email);
				await expect(sheet.getByLabel('Email address')).toHaveValue(email, { timeout: 2_000 });
				await sheet.getByRole('button', { name: 'Claim', exact: true }).click();
				await expect(confirmDialog).toBeVisible({ timeout: 10_000 });
			}).toPass({ timeout: 60_000 });
			await expect(sheet).toBeHidden();

			// ONE email for the whole cart.
			const message = await waitForEmail({ to: email, subject: 'Confirm your ticket for' });
			expect(message.Subject).toContain(event.name);
			const link = extractLink(message, /confirm-action\?token=/);

			const getTickets = captureConfirmTickets(page);
			await page.goto(link);
			await expect(async () => {
				const retry = page.getByRole('button', { name: 'Try Again' });
				if (await retry.isVisible()) await retry.click();
				await expect(page.getByRole('heading', { name: 'Ticket Confirmed!' })).toBeVisible({
					timeout: 10_000
				});
			}).toPass({ timeout: 45_000 });

			// The capstone assertion: BOTH tickets confirmed by the ONE emailed
			// link, the pluralized count line, and a per-tier breakdown (renders
			// only when tierBreakdown.length > 1 — see ConfirmationResult.svelte).
			await expect(page.getByText('2 tickets confirmed')).toBeVisible();
			await expect(page.getByText(`1 ticket · ${seatedTier.name}`)).toBeVisible();
			await expect(page.getByText(`1 ticket · ${gaTier.name}`)).toBeVisible();

			// Network truth: two tickets, one per tier, the seated one carrying C2.
			await expect.poll(() => getTickets()?.length, { timeout: 10_000 }).toBe(2);
			const tickets = getTickets() ?? [];
			const seatedTicket = tickets.find((t) => t.tier?.id === seatedTier.id);
			const gaTicket = tickets.find((t) => t.tier?.id === gaTier.id);
			expect(seatedTicket?.seat?.label).toBe('C2');
			expect(gaTicket?.seat ?? null).toBeFalsy();

			// The seat converted from hold to SOLD.
			await expect(async () => {
				const availability = await getSeatingAvailability(event.id);
				expect(availability.seats[seatC2.id]).toBe('sold');
			}).toPass({ timeout: 15_000 });
		} finally {
			await releaseGuestHolds(page, event.id);
		}
	});
});
