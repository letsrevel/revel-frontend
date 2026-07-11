import { test, expect } from '../../support/fixtures';
import { createTicketedEvent, createVerifiedUser, uniqueEmail } from '../../support/factories';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import { waitForEmail } from '../../support/mailpit';

// J10.6 (USER_JOURNEYS.md) — invitations: one create flow handles BOTH a
// registered user (→ direct invitation) and an unregistered email (→ pending
// invitation, converted on signup), with waivers + custom message; each gets
// an email; deletion removes the row.
//
// Isolation: own event; one registered throwaway + one never-registered
// unique email.

test.describe('J10 invitations @p1', () => {
	test('invite registered + unregistered with waivers; emails sent; delete', async ({
		asOwner
	}) => {
		test.setTimeout(120_000);
		const [event, registered] = await Promise.all([
			createTicketedEvent(),
			createVerifiedUser('Invitee')
		]);
		const unregisteredEmail = uniqueEmail('PendingInvitee');

		const page = asOwner;
		// Tab state is a URL param (plain buttons whose labels differ by
		// viewport) — navigate straight to the tab.
		await gotoHydrated(
			page,
			`/org/${event.orgSlug}/admin/events/${event.id}/invitations?tab=invitations`
		);
		await waitForClientAuth(page);

		// Create both invitations in one dialog, with waivers + custom message.
		await page.getByRole('button', { name: 'Create Invitations' }).click();
		const dialog = page.getByRole('dialog', { name: 'Create Invitations' });
		await expect(dialog).toBeVisible();
		// The tag input drops its placeholder once a tag exists — use its id.
		const emailInput = dialog.locator('#email-tag-input');
		await emailInput.fill(registered.email);
		await emailInput.press('Enter');
		await emailInput.fill(unregisteredEmail);
		await emailInput.press('Enter');
		await dialog.getByLabel('Custom Message (Optional)').fill('Come join us — E2E');
		await dialog.getByLabel('Waive purchase requirement (free ticket)').check();
		await dialog.getByLabel('Waive questionnaire requirement').check();
		await dialog.getByRole('button', { name: 'Send Invitations' }).click();
		await expect(dialog).not.toBeVisible({ timeout: 20_000 });

		// One lands as a registered/direct invitation, the other as pending.
		await expect(page.getByText(/Registered Users \(1\)/)).toBeVisible({ timeout: 20_000 });
		await expect(page.getByText(registered.email).first()).toBeVisible();
		await expect(page.getByText(/Pending \(Unregistered\) \(1\)/)).toBeVisible();
		await expect(page.getByText(unregisteredEmail).first()).toBeVisible();

		// Both invitees receive an invitation email.
		await waitForEmail({ to: registered.email, subject: 'nvit' });
		await waitForEmail({ to: unregisteredEmail, subject: 'nvit' });

		// Delete the pending invitation — its row disappears.
		const pendingRow = page.locator('tr').filter({ hasText: unregisteredEmail }).first();
		await pendingRow.getByRole('button', { name: 'Delete' }).click();
		await expect(page.getByText(unregisteredEmail)).not.toBeVisible({ timeout: 20_000 });
	});
});
