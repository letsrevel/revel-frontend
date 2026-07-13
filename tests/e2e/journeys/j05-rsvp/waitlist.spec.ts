import { test, expect } from '../../support/fixtures';
import { createTicketedEvent, createVerifiedUser, rsvpViaApi } from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J5 waitlist join/leave — the mutating counterpart to the read-only
// eligibility matrix (which only asserts the "Join Waitlist" CTA renders on
// the seeded full events). A fresh 1-seat RSVP event is filled by a
// throwaway, so joining/leaving here never touches seeded waitlist state.
//
// UX quirks encoded: join success is an inline "Success!" status (no toast)
// followed by window.location.reload() after 1.5s; leave goes through a
// native confirm() and also reloads.

test.describe('J5 waitlist @p2', () => {
	test('join and leave the waitlist on a full RSVP event', async ({ browser }) => {
		const [event, filler, joiner] = await Promise.all([
			createTicketedEvent({
				freeTier: false,
				event: { requires_ticket: false, max_attendees: 1, waitlist_open: true }
			}),
			createVerifiedUser('Filler'),
			createVerifiedUser('Waitlister')
		]);
		// The single seat goes to the filler — the event is now full.
		await rsvpViaApi(filler, event.id, 'yes');

		const context = await browser.newContext();
		await authenticateContext(context, joiner);
		const page = await context.newPage();
		// Leaving the waitlist fires a native confirm() — auto-accept.
		page.on('dialog', (dialog) => void dialog.accept());

		await gotoHydrated(page, event.path);
		await waitForClientAuth(page);
		await expect(page.getByRole('heading', { name: 'Event is full' })).toBeVisible({
			timeout: 15_000
		});

		// Join: inline success state, then the page reloads itself into the
		// on-waitlist gate (disabled status button + Leave).
		await page.getByRole('button', { name: 'Join Waitlist' }).click();
		await expect(page.getByText('Success!')).toBeVisible({ timeout: 15_000 });
		const onWaitlistButton = page.getByRole('button', { name: "You're on the Waitlist" });
		await expect(onWaitlistButton).toBeVisible({ timeout: 30_000 });
		await expect(onWaitlistButton).toBeDisabled();

		// Leave: confirm() accepted above; the reload lands back on the
		// join-able full-event gate.
		await page.getByRole('button', { name: 'Leave', exact: true }).click();
		await expect(page.getByRole('button', { name: 'Join Waitlist' })).toBeVisible({
			timeout: 30_000
		});

		await context.close();
	});
});
