import { test, expect } from '../../support/fixtures';
import { createVerifiedUser } from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J3.5 (USER_JOURNEYS.md) — notification preferences on /account/settings:
// master toggles, channel checkboxes, digest frequency (+ send time revealed
// for daily/weekly), all persisted through a single "Save Changes" PATCH.
// The controls are bits-ui (role=checkbox buttons / role=radio group), not
// native inputs.
//
// Throwaway user: preferences are per-user singletons — mutating a seeded
// persona's would leak into every other suite's notification expectations.

test.describe('J03 notification preferences @p2', () => {
	test('saves channel, reminder and digest changes and they persist', async ({ browser }) => {
		const user = await createVerifiedUser('NotifPrefs');
		const context = await browser.newContext();
		await authenticateContext(context, user);
		const page = await context.newPage();

		await gotoHydrated(page, '/account/settings');
		await waitForClientAuth(page);
		await expect(page.getByRole('heading', { name: 'Master Controls' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Notification Channels' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Digest Settings' })).toBeVisible();

		// Silence-all disables every other control while checked.
		const silenceAll = page.getByRole('checkbox', { name: 'Silence all notifications' });
		const eventReminders = page.getByRole('checkbox', { name: 'Event reminders' });
		await silenceAll.check();
		await expect(eventReminders).toBeDisabled();
		await silenceAll.uncheck();
		await expect(eventReminders).toBeEnabled();

		// Defaults: in_app + email enabled, digest immediate. Drop the email
		// channel and switch to a daily 09:00 digest.
		const emailChannel = page.getByRole('checkbox', { name: 'Email', exact: true });
		await expect(emailChannel).toBeChecked();
		await emailChannel.uncheck();
		// Telegram stays disabled until an account is linked.
		await expect(page.getByRole('checkbox', { name: 'Telegram' })).toBeDisabled();

		await page.getByRole('radio', { name: 'Daily' }).check();
		const sendTime = page.getByLabel('Send time');
		await expect(sendTime).toBeVisible();
		await sendTime.fill('09:00');

		// The advanced per-type section carries its own "Save Changes"; the
		// master form's is the last one on the page.
		await page.getByRole('button', { name: 'Save Changes' }).last().click();
		await expect(page.getByText('Notification preferences updated successfully')).toBeVisible();

		// Reload → the server-loaded form reflects the saved state.
		await gotoHydrated(page, '/account/settings');
		await waitForClientAuth(page);
		await expect(page.getByRole('checkbox', { name: 'Email', exact: true })).not.toBeChecked();
		await expect(page.getByRole('checkbox', { name: 'In-App' })).toBeChecked();
		await expect(page.getByRole('radio', { name: 'Daily' })).toBeChecked();
		// The backend stores seconds; the native time input reads back 09:00:00.
		await expect(page.getByLabel('Send time')).toHaveValue(/^09:00(:00)?$/);

		await context.close();
	});
});
