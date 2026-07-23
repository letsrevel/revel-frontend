import type { Page } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import {
	claimTicketViaApi,
	createTicketedEvent,
	createTicketTier,
	createVerifiedUser,
	deleteDefaultTier,
	getSeededConcertHall,
	listAvailableSeats,
	type CreatedEvent
} from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J19.7 (USER_JOURNEYS.md) + the #658 box-office overrides UX contract — the
// event-admin Seating page (SeatOverridesPanel):
//
// 1. HOLD: the owner selects a free seat, applies a Hold with a reason, and the
//    panel reports "1 override(s) applied, 0 released.", lists the seat under
//    the blocked summary, and re-renders its checkbox as "…, unavailable" after
//    the forced availability refetch. A separate buyer context then sees that
//    seat rendered unavailable in the public purchase dialog. Releasing the
//    override frees the seat again — the buyer view recovers on reopen (fresh
//    availability fetch).
//
// 2. KILL + per-seat rejection: overrides are applied seat-by-seat, so a seat
//    that already has a live ticket is rejected INLINE ("has a ticket on this
//    event") while a free seat in the same request still applies — never a
//    whole-batch failure.
//
// Isolation: own throwaway events on Org Alpha (revel-events-collective, the
// `owner` persona / asOwner) attached to the seeded "Revel Concert Hall"
// (10×10 grid, rows A–J; row A is accessible so seats are picked from rows
// B/C where accessible names are bare). Overrides are per-event state on a
// throwaway event, so no cleanup is needed. The tiers are offline user_choice
// (Stripe stays out; the buyer dialog renders the seat picker).

const OFFLINE_USER_CHOICE_TIER = {
	name: 'Choose Your Seat',
	payment_method: 'offline',
	price: '25.00',
	seat_assignment_mode: 'user_choice'
} as const;

/** Path to the event-admin Seating page (the SeatOverridesPanel host). */
function seatingAdminPath(event: CreatedEvent): string {
	return `/org/${event.orgSlug}/admin/events/${event.id}/seating`;
}

/**
 * Toggle a seat checkbox by NAME via the keyboard (focus + Space). The seat
 * list is a long scroll region under the app's sticky top header, so a pointer
 * click — even forced — dispatches at coordinates the header can intercept.
 * Keyboard activation goes straight to the focused control, no hit-testing.
 */
async function toggleSeatCheckbox(
	page: Page,
	name: string,
	options: { exact?: boolean } = {}
): Promise<void> {
	const checkbox = page.getByRole('checkbox', { name, exact: options.exact ?? false });
	await expect(checkbox).toBeVisible({ timeout: 20_000 });
	await checkbox.focus();
	await checkbox.press(' ');
}

/**
 * Open the public purchase confirmation dialog for a user_choice tier. Fresh
 * navigation each call, so a second call reloads and refetches availability —
 * the "reopen after the override changed" step. Idempotent open loop mirrors
 * seat-selection.spec.ts.
 */
async function openConfirmDialog(page: Page, event: CreatedEvent) {
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
}

test.describe('J10 box-office seat overrides @p2', () => {
	test('hold blocks a seat for buyers; releasing it frees the seat again', async ({
		asOwner,
		browser
	}) => {
		test.setTimeout(180_000);

		const hall = await getSeededConcertHall();
		const [event, buyer] = await Promise.all([
			// The chart/availability endpoints resolve the venue from event.venue_id.
			createTicketedEvent({ freeTier: false, event: { venue_id: hall.venueId } }),
			createVerifiedUser('OverrideBuyer')
		]);
		await deleteDefaultTier(event.id); // its auto-tier card also says "Reserve Ticket"
		await createTicketTier(event.id, {
			...OFFLINE_USER_CHOICE_TIER,
			venue_id: hall.venueId,
			sector_id: hall.sectorId
		});

		// OWNER: open the event-admin Seating page and HOLD seat B2.
		const owner = asOwner;
		await gotoHydrated(owner, seatingAdminPath(event));
		await waitForClientAuth(owner);
		await toggleSeatCheckbox(owner, 'Seat B2', { exact: true });
		await expect(owner.getByRole('checkbox', { name: /^Seat B2(,|$)/ })).toBeChecked();
		await owner.getByLabel('Reason (required)').fill('camera platform');
		await owner.getByRole('button', { name: 'Apply override' }).click();

		// Applied count reported, seat now blocked (list checkbox flips + summary chip).
		await expect(owner.getByText('1 override(s) applied, 0 released.')).toBeVisible({
			timeout: 15_000
		});
		await expect(owner.getByRole('checkbox', { name: 'Seat B2, unavailable' })).toBeVisible({
			timeout: 15_000
		});
		const blockedSummary = owner.locator('section', {
			has: owner.getByRole('heading', { name: /Blocked seats/ })
		});
		await expect(blockedSummary.getByText('B2', { exact: true })).toBeVisible();

		// BUYER (fresh context): the held seat renders unavailable in the dialog.
		const context = await browser.newContext();
		try {
			await authenticateContext(context, buyer);
			const page = await context.newPage();
			const confirmDialog = await openConfirmDialog(page, event);
			await expect(confirmDialog.getByRole('group', { name: 'Seat display' })).toBeVisible({
				timeout: 15_000
			});
			await expect(confirmDialog.getByRole('button', { name: 'Seat B2, unavailable' })).toBeVisible(
				{ timeout: 15_000 }
			);

			// OWNER: RELEASE the override on B2 (reason not required for release).
			await toggleSeatCheckbox(owner, 'Seat B2, unavailable');
			await owner.getByRole('radio', { name: /Release/ }).check();
			await owner.getByRole('button', { name: 'Release selected seats' }).click();
			await expect(owner.getByText('0 override(s) applied, 1 released.')).toBeVisible({
				timeout: 15_000
			});
			await expect(owner.getByRole('checkbox', { name: /^Seat B2(,|$)/ })).toBeVisible({
				timeout: 15_000
			});

			// BUYER: reopen (reload → fresh availability) — the seat is free again.
			const reopened = await openConfirmDialog(page, event);
			await expect(reopened.getByRole('button', { name: /^Seat B2(,|$)/ })).toBeVisible({
				timeout: 15_000
			});
			await expect(reopened.getByRole('button', { name: 'Seat B2, unavailable' })).toHaveCount(0);
		} finally {
			await context.close();
		}
	});

	test('kill rejects ticketed seats inline while free seats still apply', async ({ asOwner }) => {
		test.setTimeout(180_000);

		const hall = await getSeededConcertHall();
		const [event, ticketHolder] = await Promise.all([
			createTicketedEvent({ freeTier: false, event: { venue_id: hall.venueId } }),
			createVerifiedUser('SeatTicketHolder')
		]);
		await deleteDefaultTier(event.id);
		const tier = await createTicketTier(event.id, {
			...OFFLINE_USER_CHOICE_TIER,
			venue_id: hall.venueId,
			sector_id: hall.sectorId
		});

		// Give C5 a live ticket (another attendee) — it must reject on kill.
		const seats = await listAvailableSeats(ticketHolder, event.id);
		const seatC5 = seats.find((s) => s.label === 'C5');
		if (!seatC5) throw new Error('Seeded seat C5 missing from Revel Concert Hall');
		await claimTicketViaApi(ticketHolder, event.id, tier.id, { seatId: seatC5.id });

		// OWNER: select the ticketed seat (shown "sold") + a free seat, then KILL.
		const owner = asOwner;
		await gotoHydrated(owner, seatingAdminPath(event));
		await waitForClientAuth(owner);
		await toggleSeatCheckbox(owner, 'Seat C5, sold');
		await toggleSeatCheckbox(owner, 'Seat C6', { exact: true });
		await owner.getByRole('radio', { name: /Kill/ }).check();
		await owner.getByLabel('Reason (required)').fill('decommissioned platform');
		await owner.getByRole('button', { name: 'Apply override' }).click();

		// Result region: one applied (C6), C5 rejected inline — never a batch failure.
		const result = owner.getByRole('status').filter({ hasText: 'override(s) applied' });
		await expect(result).toContainText('1 override(s) applied, 0 released.', { timeout: 15_000 });
		await expect(result).toContainText('C5');
		await expect(result).toContainText('has a ticket on this event');

		// The free seat C6 applied → it now renders blocked.
		await expect(owner.getByRole('checkbox', { name: 'Seat C6, unavailable' })).toBeVisible({
			timeout: 15_000
		});
		// C5 was NOT overridden — it stays "sold" (its ticket is intact).
		await expect(owner.getByRole('checkbox', { name: 'Seat C5, sold' })).toBeVisible();
	});
});
