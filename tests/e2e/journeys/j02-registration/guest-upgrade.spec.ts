import { test, expect } from '../../support/fixtures';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import { createGuestRsvp, createTicketedEvent } from '../../support/factories';
import { extractLink, waitForEmail } from '../../support/mailpit';
import { fillRegistrationForm } from '../../support/auth-forms';
import { uiLogin } from '../../support/session';

// J2.4 (USER_JOURNEYS.md) — guest → account upgrade. A guest RSVP creates a
// passwordless guest RevelUser; registering the same email does NOT create a
// second account: the backend rejects the registration (400) but sends an
// "Activate your account" email whose link is a set-password flow. Completing
// it converts the SAME user record in place — so the guest's RSVP history is
// already there when they first sign in.

const PASSWORD = 'E2e-upgrade-Pass!123';

test.describe('J2 guest upgrade keeps history @p1', () => {
	test('a guest who registers the same email keeps their RSVP', async ({ page }) => {
		// Arrange the guest leg via API (the guest UI journey itself is j07):
		// a confirmed guest RSVP on a no-login event.
		const event = await createTicketedEvent({
			freeTier: false,
			event: { requires_ticket: false, can_attend_without_login: true }
		});
		const guest = await createGuestRsvp(event.id, 'GuestUpgrade');

		// Registering that email through the UI is refused (the address is
		// taken by the guest user)…
		await fillRegistrationForm(page, guest.email, PASSWORD);
		await page.getByRole('button', { name: 'Create your account' }).click();
		await expect(page.getByRole('alert').filter({ hasNotText: 'Demo Mode' }).first()).toBeVisible();
		expect(new URL(page.url()).pathname).toBe('/register');

		// …but it triggers the activation email, whose link sets a password on
		// the existing guest account (reset-password flow).
		const activation = await waitForEmail({ to: guest.email, subject: 'Activate your account' });
		const link = extractLink(activation, /reset-password\?token=/);
		await gotoHydrated(page, link);

		const password = page.getByLabel('New password');
		const confirm = page.getByLabel('Confirm password');
		await expect(async () => {
			await password.fill(PASSWORD);
			await confirm.fill(PASSWORD);
			await expect(password).toHaveValue(PASSWORD, { timeout: 2_000 });
			await expect(confirm).toHaveValue(PASSWORD, { timeout: 2_000 });
		}).toPass({ timeout: 30_000 });
		await page.getByRole('button', { name: 'Reset password' }).click();
		await expect(page.getByRole('heading', { name: 'Password reset successful' })).toBeVisible();

		// First real sign-in: the guest-era RSVP is already in the account.
		// The RSVP list query is gated on the client auth bootstrap and shows
		// the empty state until the token exists — wait for auth first.
		await uiLogin(page, { email: guest.email, password: PASSWORD });
		await gotoHydrated(page, '/dashboard/rsvps');
		await waitForClientAuth(page);
		await expect(page.getByText(event.name).first()).toBeVisible();
	});
});
