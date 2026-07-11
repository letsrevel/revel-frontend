import { test, expect } from '../../support/fixtures';
import { gotoHydrated } from '../../support/navigation';
import { createTicketedEvent, uniqueEmail } from '../../support/factories';
import { extractLink, waitForEmail } from '../../support/mailpit';

// J7.1 (USER_JOURNEYS.md) — RSVP without an account on a
// `can_attend_without_login` event: name+email dialog → confirmation email
// (the RSVP is NOT created yet) → following the emailed link confirms it.
// The whole journey runs logged out.

test.describe('J7 guest RSVP @p1', () => {
	test('RSVPs with name and email and confirms via the emailed link', async ({ page }) => {
		const event = await createTicketedEvent({
			freeTier: false,
			event: { requires_ticket: false, can_attend_without_login: true }
		});
		const email = uniqueEmail('GuestRsvp');

		// Logged out, the RSVP card offers the guest path.
		await gotoHydrated(page, event.path);
		await expect(page.getByRole('heading', { name: 'Will you attend?' })).toBeVisible();
		await page.getByRole('button', { name: 'Submit RSVP' }).click();

		// Guest dialog: identify + answer (defaults to yes). The dialog's submit
		// shares its "Submit RSVP" label with the page CTA, so stay scoped to
		// the dialog.
		const dialog = page.getByRole('dialog', { name: 'RSVP without an account' });
		await expect(dialog).toBeVisible();
		await expect(async () => {
			await dialog.getByLabel('Email address').fill(email);
			await dialog.getByLabel('First name').fill('E2E');
			await dialog.getByLabel('Last name').fill('Guest');
			await expect(dialog.getByLabel('Email address')).toHaveValue(email, { timeout: 2_000 });
		}).toPass({ timeout: 30_000 });
		await dialog.getByRole('button', { name: 'Submit RSVP' }).click();

		// Two-step contract: nothing is booked yet — the dialog says to go
		// confirm from the inbox.
		await expect(dialog.getByText('Check your email!')).toBeVisible();
		await expect(dialog.getByText(email)).toBeVisible();

		// The confirmation email names the event and links to /events/confirm-action.
		const message = await waitForEmail({ to: email, subject: 'Confirm your RSVP to' });
		expect(message.Subject).toContain(event.name);
		const link = extractLink(message, /confirm-action\?token=/);

		// Following the link creates the RSVP (the page confirms on mount; the
		// heading role dodges the sr-only live-region twin of the same text).
		// The confirm POST has no retry of its own, so a transient backend 5xx
		// under parallel load surfaces as the failure state — retry through
		// the UI's own Try Again button until the confirmation lands.
		await page.goto(link);
		await expect(async () => {
			const retry = page.getByRole('button', { name: 'Try Again' });
			if (await retry.isVisible()) await retry.click();
			await expect(page.getByRole('heading', { name: 'RSVP Confirmed!' })).toBeVisible({
				timeout: 10_000
			});
		}).toPass({ timeout: 45_000 });
		await expect(page.getByRole('button', { name: 'View Event Details' })).toBeVisible();
	});
});
