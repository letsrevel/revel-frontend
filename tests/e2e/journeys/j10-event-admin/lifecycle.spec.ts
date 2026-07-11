import { test, expect } from '../../support/fixtures';
import { createTicketedEvent, createVerifiedUser, rsvpViaApi } from '../../support/factories';
import { ApiError } from '../../support/api';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J10.2 (USER_JOURNEYS.md) — event lifecycle: OPEN → CLOSED stops new RSVPs;
// cancel with a reason → ATTENDEES see the reason, non-attendees see only the
// cancellation banner (backend resolve_cancellation_reason gates on active
// ticket / confirmed RSVP / staff).
//
// Isolation: API-arranged RSVP event (requires_ticket=false); an attendee
// throwaway RSVPs YES pre-cancel; a second throwaway verifies the closed
// event rejects new RSVPs via the API (400).

test.describe('J10 event lifecycle @p1', () => {
	test('close stops RSVPs; cancel reason visible to attendees only', async ({
		asOwner,
		browser
	}) => {
		const [event, attendee, latecomer] = await Promise.all([
			createTicketedEvent({ freeTier: false, event: { requires_ticket: false } }),
			createVerifiedUser('Attendee'),
			createVerifiedUser('Latecomer')
		]);
		await rsvpViaApi(attendee, event.id, 'yes');

		const page = asOwner;
		// Status changes fire native confirm() dialogs — auto-accept.
		page.on('dialog', (dialog) => void dialog.accept());
		await gotoHydrated(page, `/org/${event.orgSlug}/admin/events/${event.id}/edit`);
		await waitForClientAuth(page);

		// Close the event (page reloads itself on success).
		await page.getByRole('button', { name: 'Close Event' }).click();
		await expect(page.getByRole('button', { name: 'Reopen Event' })).toBeVisible({
			timeout: 20_000
		});

		// A closed event rejects NEW RSVPs (public API answers 400).
		await expect(rsvpViaApi(latecomer, event.id, 'yes')).rejects.toThrowError(ApiError);

		// Cancel with a reason.
		const reason = 'Venue flooded — E2E cancellation reason';
		await page.getByRole('button', { name: 'Cancel event' }).click();
		const cancelDialog = page.getByRole('dialog', { name: 'Cancel this event' });
		await cancelDialog.getByLabel('Reason (optional)').fill(reason);
		await cancelDialog.getByRole('button', { name: 'Cancel event' }).click();
		// { exact: true } — the edit-page header concatenates "... Event cancelled",
		// so a substring match resolves to 2 elements (strict-mode violation) with
		// render-order-dependent timing; the status badge is the exact-text one.
		await expect(page.getByText('Event cancelled', { exact: true })).toBeVisible({
			timeout: 20_000
		});

		// The attendee sees the banner WITH the organizer's reason.
		const attendeeContext = await browser.newContext();
		await authenticateContext(attendeeContext, attendee);
		const attendeePage = await attendeeContext.newPage();
		await gotoHydrated(attendeePage, event.path);
		await waitForClientAuth(attendeePage);
		await expect(
			attendeePage.getByText('This event has been cancelled').filter({ visible: true }).first()
		).toBeVisible({
			timeout: 15_000
		});
		await expect(attendeePage.getByText(reason).filter({ visible: true }).first()).toBeVisible();

		// Non-attendees can't see cancelled events AT ALL (backend visibility
		// excludes them) — a guest gets a 404, and with it, no reason leak.
		const guestContext = await browser.newContext();
		const guestPage = await guestContext.newPage();
		await guestPage.goto(event.path);
		await expect(guestPage.getByRole('heading', { name: 'Page Not Found' })).toBeVisible({
			timeout: 15_000
		});
		await expect(guestPage.getByText(reason)).toHaveCount(0);

		await attendeeContext.close();
		await guestContext.close();
	});
});
