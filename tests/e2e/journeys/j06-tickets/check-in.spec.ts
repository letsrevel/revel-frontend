import { test, expect } from '../../support/fixtures';
import {
	createTicketedEvent,
	createVerifiedUser,
	claimTicketViaApi
} from '../../support/factories';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J6.6 (USER_JOURNEYS.md) — staff check-in via the QR scanner's MANUAL-ENTRY
// path (no camera in headless runs; the field is always available as the
// camera fallback): enter the ticket code → attendee confirmation dialog →
// Check In → ticket flips ACTIVE → CHECKED_IN in the admin list.
//
// Isolation: own event + free tier + a throwaway attendee whose API-claimed
// ticket is the one checked in — the seeded festival tickets stay untouched
// for other suites.

test.describe('J6 check-in @p1', () => {
	test('manual-entry check-in flips the ticket to Checked In', async ({ asOwner }) => {
		// Check-in is only open between check_in_starts_at (default: event
		// start) and check_in_ends_at — open the window explicitly, since the
		// arranged event itself starts days in the future.
		const [event, attendee] = await Promise.all([
			createTicketedEvent({
				event: { check_in_starts_at: new Date(Date.now() - 60 * 60 * 1000).toISOString() }
			}),
			createVerifiedUser('CheckIn')
		]);
		if (!event.freeTierId) throw new Error('arranged event is missing its free tier');
		const ticket = await claimTicketViaApi(attendee, event.id, event.freeTierId);
		expect(ticket.status).toBe('active');

		const page = asOwner;
		await gotoHydrated(page, `/org/${event.orgSlug}/admin/events/${event.id}/tickets`);
		await waitForClientAuth(page);

		// Open the scanner and use the manual-entry fallback with the ticket id
		// (the QR payload IS the ticket id).
		await page.getByRole('button', { name: 'Scan QR Code to Check In' }).click();
		const scanner = page.getByRole('dialog', { name: 'Scan QR Code' });
		await scanner.getByLabel('Enter ticket code manually').fill(ticket.id);
		await scanner.getByRole('button', { name: 'Check in' }).click();

		// The attendee-confirmation dialog previews who is being checked in.
		const confirm = page.getByRole('dialog', { name: 'Check In Attendee' });
		await expect(confirm).toBeVisible({ timeout: 15_000 });
		await expect(confirm.getByText(attendee.email)).toBeVisible();
		await confirm.getByRole('button', { name: 'Check In', exact: true }).click();
		await expect(confirm).not.toBeVisible({ timeout: 15_000 });

		// The refreshed list (table on desktop, cards on mobile) shows the
		// attendee's ticket as Checked In.
		const checkedInRow = page
			.locator('tr, article, li, div')
			.filter({ hasText: `${attendee.firstName} ${attendee.lastName}` })
			.filter({ hasText: /Checked In/i })
			.first();
		await expect(checkedInRow).toBeVisible({ timeout: 15_000 });
	});
});
