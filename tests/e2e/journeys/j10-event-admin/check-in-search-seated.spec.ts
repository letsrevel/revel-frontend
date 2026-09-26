import crypto from 'node:crypto';
import { test, expect } from '../../support/fixtures';
import {
	claimTicketViaApi,
	createPlainConcertHall,
	createTicketedEvent,
	createTicketTier,
	createVerifiedUser,
	deleteDefaultTier,
	listAvailableSeats
} from '../../support/factories';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J6.10 (USER_JOURNEYS.md) check-in extras, from the event-admin Manage
// Tickets page (j06-tickets/check-in.spec.ts already covers the plain
// manual-code path on a general-admission ticket):
//
// 1. SEARCH BY NAME: staff find the attendee by surname (server-side search),
//    open Check In from the row, and the confirmation dialog reads back the
//    SEAT ("… • Row B • Seat 2") so door staff can direct the attendee; after
//    confirming, the row flips to Checked In.
// 2. SCAN of a seated ticket: the QR scanner's manual-entry fallback with the
//    ticket code opens the same dialog with the seat readback (Row B • Seat 3).
//
// Isolation: own event on Org Alpha (owner persona) at its own
// createPlainConcertHall (unpainted, so a free user_choice tier is valid);
// two throwaway attendees claim B2/B3 via the public checkout API. Surnames
// carry a random suffix so the name search matches exactly one ticket.

const TICKET_ROW = 'tr, div.rounded-lg.border.bg-card';

function uniqueSurname(label: string): string {
	return `${label}${crypto.randomBytes(3).toString('hex')}`;
}

test.describe('J6 check-in: name search & seat readback @p2', () => {
	test('search attendee by name, check in, and read back the seat', async ({ asOwner }) => {
		test.setTimeout(180_000);

		const hall = await createPlainConcertHall();
		const [event, searched, scanned] = await Promise.all([
			createTicketedEvent({
				freeTier: false,
				event: {
					venue_id: hall.venueId,
					require_ticket_names: false,
					check_in_starts_at: new Date(Date.now() - 60 * 60 * 1000).toISOString()
				}
			}),
			createVerifiedUser(uniqueSurname('Searched')),
			createVerifiedUser(uniqueSurname('Scanned'))
		]);
		await deleteDefaultTier(event.id);
		const tier = await createTicketTier(event.id, {
			name: 'Free Seats',
			payment_method: 'free',
			price: '0.00',
			seat_assignment_mode: 'user_choice',
			venue_id: hall.venueId,
			sector_id: hall.sectorId
		});
		const seats = await listAvailableSeats(searched, event.id);
		const seatId = (label: string): string => {
			const seat = seats.find((s) => s.label === label);
			if (!seat) throw new Error(`Seat ${label} missing from the arranged hall`);
			return seat.id;
		};
		const [, scannedTicket] = await Promise.all([
			claimTicketViaApi(searched, event.id, tier.id, { seatId: seatId('B2') }),
			claimTicketViaApi(scanned, event.id, tier.id, { seatId: seatId('B3') })
		]);
		const searchedName = `${searched.firstName} ${searched.lastName}`;
		const scannedName = `${scanned.firstName} ${scanned.lastName}`;

		const page = asOwner;
		await gotoHydrated(page, `/org/${event.orgSlug}/admin/events/${event.id}/tickets`);
		await waitForClientAuth(page);
		await expect(page.getByRole('heading', { name: 'Manage Tickets' })).toBeVisible();

		// --- 1. Search by surname narrows the list to one attendee ----------
		await page
			.getByPlaceholder('Search by holder, purchaser, email, or tier...')
			.fill(searched.lastName);
		await expect(page).toHaveURL(new RegExp(`search=${searched.lastName}`), { timeout: 15_000 });
		const row = page
			.locator(TICKET_ROW)
			.filter({ hasText: searchedName })
			.filter({ visible: true })
			.first();
		await expect(row).toBeVisible({ timeout: 15_000 });
		await expect(page.getByText(scannedName).filter({ visible: true })).toHaveCount(0, {
			timeout: 15_000
		});
		await expect(row).toContainText('Row B • Seat 2');

		await row.getByRole('button', { name: 'Check In', exact: true }).click();
		const dialog = page.getByRole('dialog', { name: 'Check In Attendee' });
		await expect(dialog).toBeVisible({ timeout: 10_000 });
		await expect(dialog.getByText(searched.email)).toBeVisible();
		// Seat readback for directing the attendee: sector + row + seat.
		await expect(dialog).toContainText('Main Floor • Row B • Seat 2');
		await dialog.getByRole('button', { name: 'Check In', exact: true }).click();
		await expect(dialog).toBeHidden({ timeout: 15_000 });

		await expect(
			page
				.locator(TICKET_ROW)
				.filter({ hasText: searchedName })
				.filter({ hasText: /Checked In/ })
				.filter({ visible: true })
				.first()
		).toBeVisible({ timeout: 15_000 });

		// --- 2. Scanner manual entry on a seated ticket: same seat readback ---
		await page.getByRole('button', { name: 'Scan QR Code to Check In' }).click();
		const scanner = page.getByRole('dialog', { name: 'Scan QR Code' });
		await scanner.getByLabel('Enter ticket code manually').fill(scannedTicket.id);
		await scanner.getByRole('button', { name: 'Check in' }).click();

		const scanDialog = page.getByRole('dialog', { name: 'Check In Attendee' });
		await expect(scanDialog).toBeVisible({ timeout: 15_000 });
		await expect(scanDialog.getByText(scanned.email)).toBeVisible();
		await expect(scanDialog).toContainText('Main Floor • Row B • Seat 3');
		await scanDialog.getByRole('button', { name: 'Check In', exact: true }).click();
		await expect(scanDialog).toBeHidden({ timeout: 15_000 });

		// Search the scanned attendee: their ticket is now Checked In too.
		await page
			.getByPlaceholder('Search by holder, purchaser, email, or tier...')
			.fill(scanned.lastName);
		await expect(
			page
				.locator(TICKET_ROW)
				.filter({ hasText: scannedName })
				.filter({ hasText: /Checked In/ })
				.filter({ visible: true })
				.first()
		).toBeVisible({ timeout: 15_000 });
	});
});
