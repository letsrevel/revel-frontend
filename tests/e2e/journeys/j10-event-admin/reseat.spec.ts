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
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J10 / #663 — box-office reseat (ReseatDialog): the event admin moves a
// seated ticket to a FREE seat in the SAME price category from the Manage
// Tickets page. The dialog derives eligibility from the venue chart joined
// with availability (reseat-model.ts, unit-tested); this spec covers the
// browser round-trip: the row's "Move seat" action, the current-seat readback,
// the same-category picker (current seat itself not offered), the reseat POST,
// the success toast, and the refreshed list showing the new seat.
//
// Isolation: own throwaway event on Org Alpha (the `owner` persona / asOwner)
// attached to the seeded "Revel Concert Hall" (10×10 grid; row A is
// accessible, so seats are picked from row B where accessible names are
// bare). The ticket holder claims seat B2 via API on an offline user_choice
// tier; B3 is free and shares B2's category (adjacent seats in the seeded
// hall), so it is always an eligible target.

test.describe('J10 box-office reseat @p2', () => {
	test('move a seated ticket to a free same-category seat', async ({ asOwner }) => {
		test.setTimeout(180_000);

		const hall = await getSeededConcertHall();
		const [event, holder] = await Promise.all([
			// The chart/availability endpoints resolve the venue from event.venue_id.
			createTicketedEvent({ freeTier: false, event: { venue_id: hall.venueId } }),
			createVerifiedUser('ReseatHolder')
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

		// The holder sits on B2 (a real ticket, not a hold).
		const seats = await listAvailableSeats(holder, event.id);
		const seatB2 = seats.find((s) => s.label === 'B2');
		if (!seatB2) throw new Error('Seeded seat B2 missing from Revel Concert Hall');
		await claimTicketViaApi(holder, event.id, tier.id, { seatId: seatB2.id });
		const holderName = `${holder.firstName} ${holder.lastName}`;

		const page = asOwner;
		await gotoHydrated(page, `/org/${event.orgSlug}/admin/events/${event.id}/tickets`);
		await waitForClientAuth(page);
		await expect(page.getByRole('heading', { name: 'Manage Tickets' })).toBeVisible();
		// Generous ceiling: under 4-worker load the local backend's first list
		// render is regularly slow (the suite keeps one retry for the same reason).
		await expect(page.getByText(holderName).filter({ visible: true }).first()).toBeVisible({
			timeout: 20_000
		});

		// Open the reseat dialog from the row's actions menu (desktop table and
		// mobile cards share the accessible label; only one is visible).
		const kebab = page
			.getByRole('button', { name: `More actions for ${holderName}` })
			.filter({ visible: true });
		const dialog = page.getByRole('dialog', { name: 'Move seat' });
		await expect(async () => {
			if (!(await dialog.isVisible())) {
				await kebab.first().click({ timeout: 3_000 });
				await page.getByRole('menuitem', { name: 'Move seat' }).click({ timeout: 3_000 });
			}
			await expect(dialog).toBeVisible({ timeout: 5_000 });
		}).toPass({ timeout: 60_000 });

		// Current seat readback (getSeatDisplay: "… • Row B • Seat 2").
		await expect(dialog.getByText('Current seat')).toBeVisible();
		await expect(dialog.getByText(/Row B\b/).first()).toBeVisible({ timeout: 15_000 });

		// The picker offers free same-category seats; the current seat itself is
		// not selectable. Keyboard activation (focus + Space) — the seat list is
		// its own scroll region with sticky sector headers a pointer click could
		// land under (same trap as seat-overrides.spec.ts).
		const picker = dialog.getByRole('radiogroup', { name: 'Choose a seat' });
		await expect(picker).toBeVisible({ timeout: 15_000 });
		await expect(picker.getByRole('radio', { name: /^Seat B2(,|$)/ })).toBeDisabled();
		const target = picker.getByRole('radio', { name: /^Seat B3(,|$)/ });
		await expect(target).toBeEnabled({ timeout: 15_000 });
		await target.focus();
		await target.press(' ');
		await expect(target).toBeChecked();

		await dialog.getByRole('button', { name: 'Move ticket' }).click();

		// Success toast, dialog closes, and the refreshed list shows the new seat.
		await expect(page.getByText('Moved to seat B3')).toBeVisible({ timeout: 15_000 });
		await expect(dialog).toBeHidden({ timeout: 15_000 });
		await expect(
			page
				.locator('tr, article, li, div')
				.filter({ hasText: holderName })
				.filter({ hasText: /Row B • Seat 3/ })
				.filter({ visible: true })
				.first()
		).toBeVisible({ timeout: 20_000 });
	});
});
