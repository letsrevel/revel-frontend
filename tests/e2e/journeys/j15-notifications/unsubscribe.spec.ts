import { test, expect } from '../../support/fixtures';
import { createTicketedEvent, createVerifiedUser, inviteToEvent } from '../../support/factories';
import { gotoHydrated } from '../../support/navigation';
import { extractLink, waitForEmail } from '../../support/mailpit';

// J15.2 (USER_JOURNEYS.md) — one-click unsubscribe: every notification email
// carries a tokened /unsubscribe link; following it (no auth) and saving
// confirms the preference change. A fresh user defaults to in_app+email
// channels, so an invitation notification emails them with the footer link.

test.describe('J15 unsubscribe @p2', () => {
	test('follows the emailed unsubscribe link and saves preferences', async ({ page }) => {
		const [user, event] = await Promise.all([
			createVerifiedUser('Unsub'),
			createTicketedEvent({ freeTier: false })
		]);
		// The invitation fires INVITATION_RECEIVED → email with the footer link.
		await inviteToEvent(event.id, [user.email]);

		const message = await waitForEmail({ to: user.email, subject: "You're invited" });
		const link = extractLink(message, /\/unsubscribe\?token=/);

		await gotoHydrated(page, link);
		await expect(
			page.getByRole('heading', { name: 'Unsubscribe from Notifications' })
		).toBeVisible();

		await page.locator('.bg-card').getByRole('button', { name: 'Save Changes' }).click();
		await expect(page.getByRole('heading', { name: 'Preferences Updated' })).toBeVisible();
	});
});
