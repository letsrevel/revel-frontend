import { test, expect } from '../../support/fixtures';
import { createVerifiedUser, uniqueName } from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J3.7 (USER_JOURNEYS.md) — dietary profile on /account/profile: add a
// preference (private), flip its visibility, add a restriction backed by a
// NEWLY created food item (unique name — the autocomplete must offer to
// create it), and remove both. Deletes go through a native confirm().
//
// Throwaway users: dietary rows accumulate per-user, and seeded personas'
// profiles are off-limits (j08 asserts on their display names).

test.describe('J03 dietary profile @p2', () => {
	test('adds a private preference, toggles visibility, removes it', async ({ browser }) => {
		const user = await createVerifiedUser('Dietary');
		const context = await browser.newContext();
		await authenticateContext(context, user);
		const page = await context.newPage();

		await gotoHydrated(page, '/account/profile');
		await waitForClientAuth(page);
		await expect(
			page.getByRole('heading', { name: 'Dietary Preferences & Restrictions' })
		).toBeVisible();

		// Add a preference from the seeded reference list, private.
		await page.getByRole('button', { name: 'Add Preference' }).click();
		const dialog = page.getByRole('dialog', { name: 'Add Dietary Preference' });
		await expect(dialog).toBeVisible();
		// Native select — index 0 is the placeholder; read back what we picked
		// so the card assertion doesn't hardcode reference data.
		const select = dialog.getByLabel('Preference');
		await expect(async () => {
			await select.selectOption({ index: 1 });
			expect(await select.inputValue()).not.toBe('');
		}).toPass({ timeout: 15_000 });
		const chosen = (await select.locator('option:checked').textContent())?.trim() ?? '';
		expect(chosen).toBeTruthy();
		await dialog.getByLabel(/Additional notes/).fill('E2E preference note');
		await dialog.getByRole('radio', { name: /^Private - / }).check();
		await dialog.getByRole('button', { name: 'Add Preference' }).click();
		await expect(page.getByText('Dietary preference added successfully')).toBeVisible();
		await expect(dialog).toBeHidden();

		// The card survives a reload and carries its Private visibility toggle.
		await gotoHydrated(page, '/account/profile');
		await waitForClientAuth(page);
		await expect(page.getByText(chosen, { exact: true })).toBeVisible();
		await page.getByRole('button', { name: 'Private', exact: true }).click();
		await expect(page.getByRole('button', { name: 'Public', exact: true })).toBeVisible();

		// Remove (native confirm) → back to the empty state.
		page.once('dialog', (d) => d.accept());
		await page.getByRole('button', { name: `Remove ${chosen}` }).click();
		await expect(page.getByText('Dietary preference removed')).toBeVisible();
		await expect(page.getByText('No dietary preferences added yet')).toBeVisible();

		await context.close();
	});

	test('adds a restriction with a new food item and removes it', async ({ browser }) => {
		const user = await createVerifiedUser('Restrict');
		const context = await browser.newContext();
		await authenticateContext(context, user);
		const page = await context.newPage();

		await gotoHydrated(page, '/account/profile');
		await waitForClientAuth(page);

		// Unique food name → the autocomplete finds nothing and offers to
		// create the item on save (also keeps parallel workers collision-free).
		const foodName = uniqueName('Peanut');
		await page.getByRole('button', { name: 'Add Restriction' }).click();
		const dialog = page.getByRole('dialog', { name: 'Add Restriction' });
		await expect(dialog).toBeVisible();
		const foodInput = dialog.getByLabel(/Food or ingredient/);
		await expect(async () => {
			await foodInput.fill(foodName);
			await expect(foodInput).toHaveValue(foodName, { timeout: 2_000 });
		}).toPass({ timeout: 15_000 });
		await expect(dialog.getByText('Will create new food item')).toBeVisible();
		await dialog.getByLabel('Severity').selectOption('allergy');
		await dialog.getByLabel('Notes').fill('E2E restriction note');
		// Visibility defaults to public — leave it.
		await dialog.getByRole('button', { name: 'Add Restriction' }).click();
		await expect(page.getByText('Dietary restriction added successfully')).toBeVisible();
		await expect(dialog).toBeHidden();

		await expect(page.getByText(foodName)).toBeVisible();
		await expect(page.getByText('Allergy', { exact: true })).toBeVisible();

		page.once('dialog', (d) => d.accept());
		await page.getByRole('button', { name: `Remove ${foodName}` }).click();
		await expect(page.getByText('Dietary restriction removed')).toBeVisible();
		await expect(page.getByText('No dietary restrictions added yet')).toBeVisible();

		await context.close();
	});
});
