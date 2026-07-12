import { test, expect } from '../../support/fixtures';
import { createTicketedEvent, createVerifiedUser, rsvpViaApi } from '../../support/factories';
import { ApiClient } from '../../support/api';
import { PERSONAS } from '../../support/personas';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J10 waitlist admin — the /waitlist admin page: issue, revoke and
// reactivate offers for a waitlist entry, then remove the entry.
//
// Arrange: a 1-seat RSVP event fills up, a throwaway joins the waitlist via
// the public API, then the seat is freed (filler flips to No) so offers can
// actually be issued — the backend answers 409 while at capacity.
//
// Locator gotcha: every row renders twice (table + md:hidden mobile card),
// so all row-level lookups filter on visibility. Removing an entry uses a
// native confirm().

test.describe('J10 waitlist admin @p2', () => {
	test('issue, revoke and reactivate an offer; remove the entry', async ({ asOwner }) => {
		const [event, filler, waiter] = await Promise.all([
			createTicketedEvent({
				freeTier: false,
				event: { requires_ticket: false, max_attendees: 1, waitlist_open: true }
			}),
			createVerifiedUser('Filler'),
			createVerifiedUser('Waiter')
		]);
		await rsvpViaApi(filler, event.id, 'yes');
		// The waiter joins the (now full) waitlist through the public API.
		const waiterApi = await ApiClient.login(waiter.email, waiter.password);
		await waiterApi.post(`/api/events/${event.id}/waitlist/join`, {});
		// Free the seat so issuing an offer doesn't 409 at capacity. The admin
		// deletes the filler's RSVP — the filler can't downgrade it themselves
		// on a full event (BE #691: rsvp() asserts capacity even for yes→no).
		const ownerApi = await ApiClient.login(PERSONAS.owner.email, PERSONAS.owner.password);
		const rsvps = await ownerApi.get<{ results: { id: string }[] }>(
			`/api/event-admin/${event.id}/rsvps`
		);
		await ownerApi.delete(`/api/event-admin/${event.id}/rsvps/${rsvps.results[0].id}`);
		const waiterName = `${waiter.firstName} ${waiter.lastName}`;

		const page = asOwner;
		page.on('dialog', (dialog) => void dialog.accept());
		await gotoHydrated(page, `/org/${event.orgSlug}/admin/events/${event.id}/waitlist`);
		await waitForClientAuth(page);
		await expect(page.getByRole('heading', { name: 'Event Waitlist', level: 1 })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Waitlist Settings' })).toBeVisible();
		await expect(page.getByText(waiterName).filter({ visible: true }).first()).toBeVisible({
			timeout: 15_000
		});

		const visibleButton = (name: string) =>
			page.getByRole('button', { name }).filter({ visible: true }).first();

		// Issue an offer (the expiry dialog is prefilled with a default window).
		await visibleButton('Issue offer').click();
		const issueDialog = page.getByRole('dialog', { name: `Issue offer to ${waiterName}` });
		await expect(issueDialog).toBeVisible();
		await issueDialog.getByRole('button', { name: 'Issue offer' }).click();
		await expect(issueDialog).not.toBeVisible({ timeout: 15_000 });
		await expect(visibleButton('Revoke offer')).toBeVisible({ timeout: 15_000 });
		await expect(page.getByText('Pending').filter({ visible: true }).first()).toBeVisible();

		// The offer also shows up on the Offers tab (default filter: Pending).
		await page.getByRole('tab', { name: 'Offers' }).click();
		await expect(page.getByText(waiterName).filter({ visible: true }).first()).toBeVisible({
			timeout: 15_000
		});
		await page.getByRole('tab', { name: 'Entries' }).click();

		// Revoke — immediate, no confirm. Only PENDING offers surface as an
		// entry's current_offer, so the row reverts to "Issue offer";
		// reactivation lives on the Offers tab behind the Revoked chip.
		await visibleButton('Revoke offer').click();
		await expect(visibleButton('Issue offer')).toBeVisible({ timeout: 15_000 });

		await page.getByRole('tab', { name: 'Offers' }).click();
		await page.getByRole('button', { name: 'Revoked', exact: true }).click();
		await visibleButton('Reactivate').click();
		const reactivateDialog = page.getByRole('dialog', {
			name: `Reactivate offer for ${waiterName}`
		});
		await expect(reactivateDialog).toBeVisible();
		await reactivateDialog.getByRole('button', { name: 'Reactivate' }).click();
		await expect(reactivateDialog).not.toBeVisible({ timeout: 15_000 });

		// Back on Entries the offer is pending again → revocable.
		await page.getByRole('tab', { name: 'Entries' }).click();
		await expect(visibleButton('Revoke offer')).toBeVisible({ timeout: 15_000 });

		// Remove the entry (native confirm auto-accepted) → empty state.
		await visibleButton('Remove').click();
		await expect(page.getByRole('heading', { name: 'No Waitlist Entries' })).toBeVisible({
			timeout: 15_000
		});
	});
});
