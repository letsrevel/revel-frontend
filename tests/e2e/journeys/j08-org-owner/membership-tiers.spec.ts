import { test, expect } from '../../support/fixtures';
import { createOrganization } from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J8 (USER_JOURNEYS.md) — membership tier CRUD + reorder (reorder shipped in
// #622 / BE #690: optimistic up/down buttons calling the reorder endpoint).
//
// Isolation: throwaway-owned org. Every new org starts with its post-save
// "General membership" tier, so the reorder buttons appear as soon as one
// more tier exists.

test.describe('J8 membership tiers @p2', () => {
	test('create, edit, reorder, and delete tiers', async ({ browser }) => {
		test.setTimeout(150_000);

		const org = await createOrganization();

		const context = await browser.newContext();
		await authenticateContext(context, org.owner);
		const page = await context.newPage();

		await gotoHydrated(page, `/org/${org.slug}/admin/members`);
		await waitForClientAuth(page);
		await page.getByRole('tab', { name: /^Tiers/ }).click();
		const panel = page.getByRole('tabpanel');
		await expect(panel.getByRole('heading', { name: 'General membership' })).toBeVisible();

		// Create two tiers through the form dialog.
		const formDialog = page.getByRole('dialog', {
			name: /Create Membership Tier|Edit Membership Tier/
		});
		for (const name of ['Gold', 'Silver']) {
			await panel.getByRole('button', { name: 'Create Tier' }).click();
			await expect(formDialog).toBeVisible();
			await formDialog.getByLabel('Tier Name').fill(name);
			await formDialog.getByRole('button', { name: 'Create Tier' }).click();
			await expect(formDialog).not.toBeVisible({ timeout: 15_000 });
			await expect(panel.getByRole('heading', { name, exact: true })).toBeVisible();
		}

		// Edit: rename Silver → Silver Plus.
		await panel.getByRole('button', { name: 'Edit Silver' }).click();
		await expect(formDialog).toBeVisible();
		await formDialog.getByLabel('Tier Name').fill('Silver Plus');
		await formDialog.getByRole('button', { name: 'Update Tier' }).click();
		await expect(formDialog).not.toBeVisible({ timeout: 15_000 });
		await expect(panel.getByRole('heading', { name: 'Silver Plus' })).toBeVisible();
		await expect(panel.getByRole('heading', { name: 'Silver', exact: true })).toBeHidden();

		// Reorder: Gold sits second (created after the default tier); move it to
		// the top. The mutation is optimistic — reload to prove persistence.
		// Order is read off the card headings, filtered to the known tier names
		// (cards can contain other headings, e.g. per-tier plan sections).
		const KNOWN = ['General membership', 'Gold', 'Silver Plus'];
		const tierOrder = async () => {
			const texts = await panel.getByRole('heading', { level: 3 }).allTextContents();
			return texts.map((t) => t.trim()).filter((t) => KNOWN.includes(t));
		};
		await expect.poll(tierOrder).toEqual(['General membership', 'Gold', 'Silver Plus']);
		await panel.getByRole('button', { name: 'Move Gold up' }).click();
		await expect.poll(tierOrder).toEqual(['Gold', 'General membership', 'Silver Plus']);

		await gotoHydrated(page, `/org/${org.slug}/admin/members`);
		await waitForClientAuth(page);
		await page.getByRole('tab', { name: /^Tiers/ }).click();
		await expect.poll(tierOrder).toEqual(['Gold', 'General membership', 'Silver Plus']);

		// Delete Silver Plus through the confirmation dialog.
		const deleteDialog = page.getByRole('dialog', { name: 'Delete Membership Tier' });
		await panel.getByRole('button', { name: 'Delete Silver Plus' }).click();
		await expect(deleteDialog).toBeVisible();
		await deleteDialog.getByRole('button', { name: 'Delete Tier' }).click();
		await expect(deleteDialog).not.toBeVisible({ timeout: 15_000 });
		await expect(panel.getByRole('heading', { name: 'Silver Plus' })).toBeHidden();

		await context.close();
	});
});
