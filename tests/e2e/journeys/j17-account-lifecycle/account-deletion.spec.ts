import { test, expect } from '../../support/fixtures';
import { obtainTokenPair } from '../../support/api';
import { createVerifiedUser } from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import { extractLink, waitForEmail } from '../../support/mailpit';

// J17.5 (USER_JOURNEYS.md) — account deletion: the Danger Zone modal on
// /account/privacy requires an explicit "I understand" checkbox and only
// EMAILS a confirmation link; the account dies when the link's page's
// "Permanently Delete Account" is pressed. Afterwards the credentials are
// dead. Deletion itself runs async (eager Celery inline here), so the final
// login check polls instead of asserting once.
//
// Throwaway user, obviously. It must not own an org (the backend 403s
// deletion for active org owners) — createVerifiedUser doesn't create one.

test.describe('J17 account deletion @p2', () => {
	test('deletes the account via the emailed confirmation and login dies', async ({ browser }) => {
		test.setTimeout(150_000);
		const user = await createVerifiedUser('Delete');
		const context = await browser.newContext();
		await authenticateContext(context, user);
		const page = await context.newPage();

		await gotoHydrated(page, '/account/privacy');
		await waitForClientAuth(page);
		await expect(page.getByRole('heading', { name: 'Danger Zone' })).toBeVisible();

		await page.getByRole('button', { name: 'Delete My Account' }).click();
		const modal = page.getByRole('dialog', { name: 'Permanently Delete Account?' });
		await expect(modal).toBeVisible();
		const confirmSend = modal.getByRole('button', { name: 'Send Confirmation Email' });
		await expect(confirmSend).toBeDisabled();
		await modal.getByLabel('I understand this action is permanent and cannot be reversed').check();
		await confirmSend.click();
		await expect(page.getByText('Deletion confirmation email sent')).toBeVisible();

		const message = await waitForEmail({ to: user.email, subject: 'Confirm Account Deletion' });
		const link = extractLink(message, /confirm-deletion\?token=/);

		await gotoHydrated(page, link);
		await expect(
			page.getByRole('heading', { level: 1, name: 'Confirm Account Deletion' })
		).toBeVisible();
		await page.getByRole('button', { name: 'Permanently Delete Account' }).click();
		await expect(page.getByRole('heading', { name: 'Account Deleted' })).toBeVisible();

		// The credentials stop working once the (async) deletion lands.
		await expect
			.poll(
				async () => {
					try {
						await obtainTokenPair(user.email, user.password);
						return 'alive';
					} catch {
						return 'gone';
					}
				},
				{ timeout: 30_000 }
			)
			.toBe('gone');

		await context.close();
	});
});
