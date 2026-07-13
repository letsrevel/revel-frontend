import { test, expect } from '../../support/fixtures';
import { createTicketedEvent, createVerifiedUser, rsvpViaApi } from '../../support/factories';
import { ApiClient } from '../../support/api';
import { PERSONAS } from '../../support/personas';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J5 (USER_JOURNEYS.md) — the advanced waitlist window, attendee side: a
// waitlisted user with a PENDING offer sees the offer banner on the event
// page and accepts it before expiry. There is NO dedicated accept endpoint —
// the offer reserves the seat and is CLAIMED by registering normally (here:
// RSVP Yes), which also removes the waitlist entry, so the banner disappears.
//
// Arrange mirrors j10 waitlist-admin: a 1-seat RSVP event fills up, the
// waiter joins via the public API, the seat is freed (admin deletes the
// filler's RSVP — BE #691 blocks self-downgrade on a full event), and the
// offer is issued via the admin API with an explicit expiry (the event
// carries no waitlist_time_window default).

test.describe('J5 waitlist offer @p3', () => {
	test('pending offer banner → claim by RSVPing before expiry', async ({ browser }) => {
		test.setTimeout(150_000);

		const [event, filler, waiter] = await Promise.all([
			createTicketedEvent({
				freeTier: false,
				event: { requires_ticket: false, max_attendees: 1, waitlist_open: true }
			}),
			createVerifiedUser('OfferFiller'),
			createVerifiedUser('OfferWaiter')
		]);
		await rsvpViaApi(filler, event.id, 'yes');
		const waiterApi = await ApiClient.login(waiter.email, waiter.password);
		await waiterApi.post(`/api/events/${event.id}/waitlist/join`, {});

		// Free the seat, then issue the offer (would 409 while at capacity).
		const ownerApi = await ApiClient.login(PERSONAS.owner.email, PERSONAS.owner.password);
		const rsvps = await ownerApi.get<{ results: { id: string }[] }>(
			`/api/event-admin/${event.id}/rsvps`
		);
		await ownerApi.delete(`/api/event-admin/${event.id}/rsvps/${rsvps.results[0].id}`);
		const entries = await ownerApi.get<{ results: { id: string }[] }>(
			`/api/event-admin/${event.id}/waitlist`
		);
		await ownerApi.post(`/api/event-admin/${event.id}/waitlist-offers`, {
			waitlist_entry_id: entries.results[0].id,
			expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
		});

		// The waiter sees the offer banner with the countdown.
		const context = await browser.newContext();
		await authenticateContext(context, waiter);
		const page = await context.newPage();
		await gotoHydrated(page, event.path);
		await waitForClientAuth(page);
		await expect(page.getByText("You've been selected!")).toBeVisible({ timeout: 15_000 });
		await expect(page.getByText('Time remaining')).toBeVisible();

		// "Claim spot" scrolls to the action sidebar — the RSVP card is the
		// actual accept surface (the offer reserved the seat on a full event).
		await page.getByRole('button', { name: 'Claim spot' }).click();
		await expect(
			page.getByRole('heading', { name: 'Will you attend?' }).filter({ visible: true }).first()
		).toBeVisible();
		await page
			.getByRole('button', { name: /^RSVP Yes/ })
			.filter({ visible: true })
			.first()
			.click();
		await expect(page.getByRole('status').filter({ hasText: "You're attending" })).toBeVisible({
			timeout: 15_000
		});

		// Claiming consumed the offer and the waitlist entry — after a reload the
		// banner is gone and the attending state persists (reload-retry: the
		// status arrives via a client-side query and can lag a beat).
		await expect(async () => {
			await gotoHydrated(page, event.path);
			await expect(page.getByRole('status').filter({ hasText: "You're attending" })).toBeVisible({
				timeout: 5_000
			});
		}).toPass({ timeout: 45_000 });
		await expect(page.getByText("You've been selected!")).toBeHidden();

		// The offer is CLAIMED on the admin side (no pending offer left to revoke).
		const offers = await ownerApi.get<{ results: Array<{ status: string }> }>(
			`/api/event-admin/${event.id}/waitlist-offers`
		);
		expect(offers.results[0]?.status).toBe('claimed');

		await context.close();
	});
});
