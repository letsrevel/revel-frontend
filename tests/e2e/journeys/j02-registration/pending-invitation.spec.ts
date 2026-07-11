import { test, expect } from '../../support/fixtures';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import { createTicketedEvent, inviteToEvent, uniqueEmail } from '../../support/factories';
import { extractLink, waitForEmail } from '../../support/mailpit';
import { fillRegistrationForm } from '../../support/auth-forms';

// J2.3 (USER_JOURNEYS.md) — inviting an email with no account creates a
// PendingEventInvitation (and sends the invite email with a sign-up nudge);
// when that email registers, a post_save signal converts it into a real
// EventInvitation, waivers and all, which the new user finds on
// /dashboard/invitations without anyone re-inviting them.

const STRONG_PASSWORD = 'E2e-test-Pass!123';

test.describe('J2 pending invitation auto-links on registration @p1', () => {
	test('an invited email registers and finds the invitation in the dashboard', async ({ page }) => {
		const event = await createTicketedEvent();
		const email = uniqueEmail('PendingInvite');

		// Invite the not-yet-registered address, with a waiver that must
		// survive the pending → real conversion.
		await inviteToEvent(event.id, [email], {
			invitation: { waives_purchase: true }
		});

		// The invite email reaches the address even without an account.
		const invite = await waitForEmail({ to: email, subject: "You're invited" });
		expect(invite.Subject).toContain(event.name);

		// Register that exact email through the UI…
		await fillRegistrationForm(page, email, STRONG_PASSWORD);
		await page.getByRole('button', { name: 'Create your account' }).click();
		await page.waitForURL(/\/register\/check-email/);

		// …and verify it (subject filter keeps us off the invitation email).
		const verification = await waitForEmail({ to: email, subject: 'Verify your email' });
		const link = extractLink(verification, /token=/);
		await page.goto(link);
		await page.waitForURL(/\/account\/profile/);

		// The pending invitation was auto-converted: it shows up as a real
		// invitation, waiver included. This fresh account has exactly one
		// invitation, so page-level assertions are unambiguous. The list query
		// is gated on the client auth bootstrap and renders the empty state
		// until the token exists — wait for auth before asserting.
		await gotoHydrated(page, '/dashboard/invitations');
		await waitForClientAuth(page);
		await expect(page.getByRole('link', { name: event.name })).toBeVisible();
		await expect(page.getByText('Special Invitation')).toBeVisible();
		await expect(page.getByText('Free admission')).toBeVisible();
		await expect(page.getByRole('link', { name: 'View Event' })).toBeVisible();
	});
});
