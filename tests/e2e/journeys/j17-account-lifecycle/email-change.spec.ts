import { test, expect } from '../../support/fixtures';
import { obtainTokenPair } from '../../support/api';
import { createVerifiedUser, uniqueEmail } from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import { extractLink, waitForEmail } from '../../support/mailpit';

// J17.3 (USER_JOURNEYS.md) — email change: request with the current password
// on /account/security, the OLD address is notified immediately, the NEW
// address gets the confirmation link, and confirming (an explicit button on
// /account/confirm-email-change) re-issues a fresh token pair to THIS
// session — every other device is signed out, but the confirming one
// survives. Both addresses then get the "has been changed" notice.
//
// Throwaway user: changes the account's login identity — never a persona.

test.describe('J17 email change @p2', () => {
	test('changes the sign-in email via the confirmation link, session survives', async ({
		browser
	}) => {
		test.setTimeout(180_000);
		const user = await createVerifiedUser('EmailChange');
		const newEmail = uniqueEmail('emailchangenew');
		const context = await browser.newContext();
		await authenticateContext(context, user);
		const page = await context.newPage();

		await gotoHydrated(page, '/account/security');
		await waitForClientAuth(page);
		await page.getByRole('button', { name: 'Change email' }).click();
		await expect(page.getByRole('heading', { name: 'Change your email' })).toBeVisible();

		const emailInput = page.getByLabel('New email address');
		const passwordInput = page.getByLabel('Current password');
		await expect(async () => {
			await emailInput.fill(newEmail);
			await passwordInput.fill(user.password);
			await expect(emailInput).toHaveValue(newEmail, { timeout: 2_000 });
			await expect(passwordInput).toHaveValue(user.password, { timeout: 2_000 });
		}).toPass({ timeout: 30_000 });
		await page.getByRole('button', { name: 'Send confirmation link' }).click();
		await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible();

		// Old address is warned at REQUEST time; new address gets the link.
		await waitForEmail({
			to: user.email,
			subject: 'An email change was requested on your account'
		});
		const confirmation = await waitForEmail({
			to: newEmail,
			subject: 'Confirm your new email address'
		});
		const link = extractLink(confirmation, /confirm-email-change\?token=/);

		// Confirm in the SAME context — the action swaps in a fresh token pair.
		await gotoHydrated(page, link);
		await expect(page.getByRole('heading', { name: 'Confirm your new email' })).toBeVisible();
		await page.getByRole('button', { name: 'Confirm change' }).click();
		await expect(page.getByRole('heading', { name: 'Email updated' })).toBeVisible();
		await expect(page.getByText(`Your email has been updated to ${newEmail}`)).toBeVisible();

		// Completion notices go to BOTH addresses.
		await waitForEmail({ to: user.email, subject: 'Your Revel email address has been changed' });
		await waitForEmail({ to: newEmail, subject: 'Your Revel email address has been changed' });

		// The confirming session survives and shows the new address…
		await gotoHydrated(page, '/account/security');
		await waitForClientAuth(page);
		await expect(page.getByText(newEmail).filter({ visible: true }).first()).toBeVisible();

		// …and only the new email signs in from now on.
		await obtainTokenPair(newEmail, user.password);
		await expect(obtainTokenPair(user.email, user.password)).rejects.toThrow();

		await context.close();
	});
});
