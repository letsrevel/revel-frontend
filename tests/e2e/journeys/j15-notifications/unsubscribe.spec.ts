import { test, expect } from '../../support/fixtures';
import { createTicketedEvent, createVerifiedUser, inviteToEvent } from '../../support/factories';
import { ApiClient } from '../../support/api';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import { extractLink, waitForEmail } from '../../support/mailpit';

// J15.6 (USER_JOURNEYS.md) — unsubscribe: every notification email carries a
// tokened /unsubscribe link (no auth). The default submit stops EMAIL and keeps
// in-app (silence stays off, per-type settings untouched); a scoped token also
// offers a one-click "stop these emails" for that notification type; a bad
// link shows the invalid-link state. J3.4 — turning email back on in settings
// restores delivery.
//
// A fresh user defaults to in_app+email, so an invitation (INVITATION_RECEIVED)
// emails them with the footer link. Throwaway users: preferences are per-user.

interface Preferences {
	silence_all_notifications: boolean;
	enabled_channels: string[];
	notification_type_settings: Record<string, { enabled?: boolean; channels?: string[] }>;
}

async function invitationUnsubscribeLink(label: string) {
	const [user, event] = await Promise.all([
		createVerifiedUser(label),
		createTicketedEvent({ freeTier: false })
	]);
	await inviteToEvent(event.id, [user.email]);
	const message = await waitForEmail({ to: user.email, subject: "You're invited" });
	return { user, message, link: extractLink(message, /\/unsubscribe\?token=/) };
}

test.describe('J15 unsubscribe @p2', () => {
	test('default save stops email but keeps in-app and leaves silence off', async ({ page }) => {
		const { user, link } = await invitationUnsubscribeLink('Unsub');

		await gotoHydrated(page, link);
		await expect(
			page.getByRole('heading', { name: 'Unsubscribe from Notifications' })
		).toBeVisible();
		// The page says which mail keeps coming regardless.
		await expect(page.getByRole('heading', { name: 'Some emails always arrive' })).toBeVisible();
		await expect(
			page.getByRole('checkbox', { name: 'Silence all notifications' })
		).not.toBeChecked();

		await page.locator('.bg-card').getByRole('button', { name: 'Save Changes' }).click();
		await expect(page.getByRole('heading', { name: 'Preferences Updated' })).toBeVisible();

		const api = await ApiClient.login(user.email, user.password);
		const prefs = await api.get<Preferences>('/api/notification-preferences');
		expect(prefs.silence_all_notifications).toBe(false);
		expect(prefs.enabled_channels).toContain('in_app');
		expect(prefs.enabled_channels).not.toContain('email');
	});

	test('the scoped one-click stops only that kind of email', async ({ page }) => {
		const { user, link } = await invitationUnsubscribeLink('UnsubScoped');

		await gotoHydrated(page, link);
		await page.getByRole('button', { name: 'Stop these emails' }).click();
		await expect(page.getByText("You won't get these emails anymore")).toBeVisible();

		const api = await ApiClient.login(user.email, user.password);
		const prefs = await api.get<Preferences>('/api/notification-preferences');
		// Email stays on globally; only the invitation type loses it.
		expect(prefs.enabled_channels).toContain('email');
		expect(prefs.notification_type_settings.invitation_received?.channels ?? []).not.toContain(
			'email'
		);
	});

	test('a malformed link shows the invalid-link state with a login way out', async ({ page }) => {
		await gotoHydrated(page, '/unsubscribe?token=not-a-real-token');
		await expect(
			page.getByRole('heading', { level: 1, name: 'Invalid or Expired Link' })
		).toBeVisible();
		await expect(page.getByRole('link', { name: 'Log in to manage preferences' })).toHaveAttribute(
			'href',
			/returnUrl=%2Faccount%2Fsettings/
		);
		await expect(page.getByRole('button', { name: 'Save Changes' })).toHaveCount(0);
	});

	test('J3.4: turning email back on in settings restores delivery', async ({ page, browser }) => {
		test.setTimeout(120_000);
		const { user, message, link } = await invitationUnsubscribeLink('Resub');

		// Unsubscribe with the default (email off).
		await gotoHydrated(page, link);
		await page.locator('.bg-card').getByRole('button', { name: 'Save Changes' }).click();
		await expect(page.getByRole('heading', { name: 'Preferences Updated' })).toBeVisible();

		// Re-enable email in account settings.
		const context = await browser.newContext();
		await authenticateContext(context, user);
		const settings = await context.newPage();
		await gotoHydrated(settings, '/account/settings');
		await waitForClientAuth(settings);
		const email = settings.getByRole('checkbox', { name: 'Email', exact: true });
		await expect(email).not.toBeChecked();
		await email.click();
		await settings.getByRole('button', { name: 'Save Changes' }).last().click();
		await expect(settings.getByText('Notification preferences updated successfully')).toBeVisible();
		await context.close();

		// A new invitation emails them again, without ticking any per-type box.
		const nextEvent = await createTicketedEvent({ freeTier: false });
		await inviteToEvent(nextEvent.id, [user.email]);
		await waitForEmail({ to: user.email, subject: "You're invited", excludeIds: [message.ID] });
	});
});
