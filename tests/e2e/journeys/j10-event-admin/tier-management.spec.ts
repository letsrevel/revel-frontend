import { test, expect } from '../../support/fixtures';
import { createTicketedEvent } from '../../support/factories';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J10.3 (USER_JOURNEYS.md) — ticket-tier management on the edit page's
// Ticketing tab: create a tier (payment method + visibility), edit an
// existing one, reorder via the arrow buttons, delete.
//
// Isolation: own event arranged with ONE free tier via API; everything else
// happens through the UI. Tier deletion uses a native confirm() dialog.

test.describe('J10 tier management @p1', () => {
	test('create, edit, reorder, and delete tiers', async ({ asOwner }) => {
		test.setTimeout(120_000);
		const event = await createTicketedEvent(); // arrives with "Free Entry"

		const page = asOwner;
		page.on('dialog', (dialog) => void dialog.accept());
		await gotoHydrated(page, `/org/${event.orgSlug}/admin/events/${event.id}/edit?tab=ticketing`);
		await waitForClientAuth(page);
		await expect(page.getByRole('heading', { name: 'Ticket Tiers' })).toBeVisible({
			timeout: 15_000
		});
		await expect(page.getByText('Free Entry').first()).toBeVisible({ timeout: 15_000 });

		// CREATE an at-the-door tier, members-only visibility.
		const tierForm = page.getByRole('dialog', { name: /Create Ticket Tier|Edit Ticket Tier/ });
		await page.getByRole('button', { name: 'Add Another Tier' }).click();
		await expect(tierForm).toBeVisible();
		await tierForm.getByLabel('Tier Name').fill('Door Sales');
		await tierForm.getByLabel(/Payment Method/).selectOption('at_the_door');
		await tierForm.locator('#visibility').selectOption('members-only');
		await tierForm.getByRole('button', { name: 'Create Tier' }).click();
		await expect(tierForm).not.toBeVisible({ timeout: 15_000 });
		await expect(page.getByText('Door Sales').first()).toBeVisible();

		// EDIT the free tier's name.
		await page.getByRole('button', { name: 'Edit Free Entry' }).click();
		await expect(tierForm).toBeVisible();
		await tierForm.getByLabel('Tier Name').fill('General Entry');
		await tierForm.getByRole('button', { name: 'Save Changes' }).click();
		await expect(tierForm).not.toBeVisible({ timeout: 15_000 });
		await expect(page.getByText('General Entry').first()).toBeVisible({ timeout: 15_000 });

		// REORDER: move Door Sales up — it becomes the first card.
		await page.getByRole('button', { name: 'Move Door Sales up' }).click();
		await expect(page.getByText('Tier order updated')).toBeVisible({ timeout: 15_000 });
		const tierNames = page.locator('h3, h4').filter({ hasText: /Door Sales|General Entry/ });
		await expect(tierNames.first()).toHaveText(/Door Sales/, { timeout: 15_000 });

		// DELETE Door Sales from its edit modal (native confirm auto-accepted).
		await page.getByRole('button', { name: 'Edit Door Sales' }).click();
		await expect(tierForm).toBeVisible();
		await tierForm.getByRole('button', { name: 'Delete Tier' }).click();
		await expect(tierForm).not.toBeVisible({ timeout: 15_000 });
		await expect(page.getByText('Door Sales')).not.toBeVisible({ timeout: 15_000 });
	});
});
