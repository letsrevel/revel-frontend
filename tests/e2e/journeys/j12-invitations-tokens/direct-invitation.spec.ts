import { test, expect } from '../../support/fixtures';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import {
	attachAdmissionQuestionnaire,
	createTicketedEvent,
	createVerifiedUser,
	inviteToEvent
} from '../../support/factories';
import { waitForEmail } from '../../support/mailpit';
import { authenticateContext } from '../../support/session';

// J12.1 (USER_JOURNEYS.md) — direct invitation to a registered user: it
// arrives in-app AND by email, shows on /dashboard/invitations with its
// waiver privileges, and RSVPing from it skips the event's admission
// questionnaire (waives_questionnaire). A second, uninvited user proves the
// questionnaire gate is real — otherwise "the waiver worked" would be
// indistinguishable from "there was no gate".

const CUSTOM_MESSAGE = 'Come as our special guest — no questionnaire needed!';

test.describe('J12 direct invitation @p1', () => {
	test('delivers in-app + email, shows waivers, and skips the questionnaire on RSVP', async ({
		browser
	}) => {
		// A non-ticketed event behind a published admission questionnaire.
		const event = await createTicketedEvent({
			freeTier: false,
			event: { requires_ticket: false }
		});
		await attachAdmissionQuestionnaire(event);
		const invitee = await createVerifiedUser('Invitee');
		const control = await createVerifiedUser('Control');

		await inviteToEvent(event.id, [invitee.email], {
			invitation: { waives_questionnaire: true, custom_message: CUSTOM_MESSAGE }
		});

		// The invitation email goes out to the registered address.
		const email = await waitForEmail({ to: invitee.email, subject: "You're invited" });
		expect(email.Subject).toContain(event.name);

		// CONTROL: without an invitation the questionnaire gate blocks the RSVP.
		const controlContext = await browser.newContext();
		await authenticateContext(controlContext, control);
		const controlPage = await controlContext.newPage();
		await controlPage.goto(event.path);
		await expect(controlPage.getByRole('heading', { name: event.name, level: 1 })).toBeVisible();
		await waitForClientAuth(controlPage);
		await expect(
			controlPage.getByRole('heading', { name: 'Questionnaire required' })
		).toBeVisible();
		await expect(controlPage.getByRole('button', { name: /^RSVP Yes/ })).toBeHidden();
		await controlContext.close();

		// INVITEE: the invitation reached the in-app inbox…
		const context = await browser.newContext();
		await authenticateContext(context, invitee);
		const page = await context.newPage();
		await gotoHydrated(page, '/dashboard');
		await waitForClientAuth(page);
		await page.getByRole('button', { name: 'Open notifications' }).click();
		await expect(page.getByText(`You're invited to ${event.name}`)).toBeVisible();

		// …and /dashboard/invitations shows the card with its privileges (the
		// list query waits on the auth bootstrap — empty state until then).
		await gotoHydrated(page, '/dashboard/invitations');
		await waitForClientAuth(page);
		await expect(page.getByRole('link', { name: event.name })).toBeVisible();
		await expect(page.getByText('Special Invitation')).toBeVisible();
		await expect(page.getByText('No questionnaire required')).toBeVisible();
		await expect(page.getByText(CUSTOM_MESSAGE)).toBeVisible();

		// View Event → the gate is waived: RSVP card instead of the
		// questionnaire prompt.
		await page.getByRole('link', { name: 'View Event' }).click();
		await expect(page.getByRole('heading', { name: event.name, level: 1 })).toBeVisible();
		await waitForClientAuth(page);
		await expect(page.getByRole('heading', { name: 'Questionnaire required' })).toBeHidden();
		await expect(page.getByRole('heading', { name: 'Will you attend?' })).toBeVisible();

		// RSVP yes straight away. The attending status renders OPTIMISTICALLY
		// (onMutate) — navigating on it aborts the in-flight POST and the RSVP
		// never lands (the optimistic-mutation nav trap). Gate on the server
		// response instead. (The onSuccess success banner is no good either:
		// its local $state resets when invalidateAll() remounts the component.)
		const [rsvpResponse] = await Promise.all([
			page.waitForResponse(
				(r) => r.request().method() === 'POST' && /\/rsvp\/yes$/.test(new URL(r.url()).pathname)
			),
			page.getByRole('button', { name: /^RSVP Yes/ }).click()
		]);
		expect(rsvpResponse.status()).toBe(200);
		await expect(page.getByRole('status').filter({ hasText: "You're attending" })).toBeVisible();

		// Accepted invitations drop off the default dashboard list
		// (exclude_accepted) — this fresh account now shows none. Wait for
		// auth first: the pre-bootstrap render shows the SAME empty state, so
		// asserting it early would pass vacuously.
		await gotoHydrated(page, '/dashboard/invitations');
		await waitForClientAuth(page);
		await expect(page.getByText("You haven't received any invitations")).toBeVisible();
		await expect(page.getByRole('link', { name: event.name })).toBeHidden();
		await context.close();
	});
});
