import { test, expect } from '../../support/fixtures';
import { createOrganization, uniqueEmail, uniqueName } from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import {
	chooseEntryAction,
	createRegisterEntry,
	daysFromNow,
	registerEntry,
	registerPath,
	toDatetimeLocal
} from '../../support/member-register';

// FE #1166: the member register. Staff add an account-less entry, edit it, end
// it (reason "removed"), narrow the list to "members on a date", export the
// register as xlsx, and the owner deletes an entry.

/** `<input type="datetime-local">` value for `days` from now (local wall time). */
function localInput(days: number): string {
	return toDatetimeLocal(new Date(Date.now() + days * 24 * 60 * 60 * 1000));
}

/** `YYYY-MM-DD` for `days` from now (local calendar day). */
function localDay(days: number): string {
	return localInput(days).slice(0, 10);
}

test.describe('J31 register: create, edit, end, filter, export, delete @p1', () => {
	test('staff manage an account-less entry end to end', async ({ browser }) => {
		test.setTimeout(240_000);
		const org = await createOrganization();
		const originalName = uniqueName('Walk-in');
		const editedName = `${originalName} Edited`;

		const context = await browser.newContext();
		await authenticateContext(context, org.owner);
		const page = await context.newPage();
		try {
			await gotoHydrated(page, registerPath(org.slug));
			await waitForClientAuth(page);
			await expect(page.getByRole('heading', { name: 'Member register', level: 1 })).toBeVisible();
			await expect(page.getByText('No register entries yet')).toBeVisible({ timeout: 15_000 });

			// Create an account-less entry.
			await page.getByRole('button', { name: 'Add entry' }).first().click();
			const form = page.getByRole('dialog', { name: 'Add register entry' });
			await form.getByLabel('Full name').fill(originalName);
			await form.getByLabel('Email (optional)').fill(uniqueEmail('Walkin'));
			await form.getByLabel('Tier').selectOption({ label: 'General membership' });
			await form.getByLabel('Valid from').fill(localInput(-30));
			await form.getByRole('button', { name: 'Add entry' }).click();
			await expect(form).toBeHidden({ timeout: 15_000 });

			const created = registerEntry(page, originalName);
			await expect(created).toBeVisible({ timeout: 15_000 });
			await expect(created.getByTestId('register-badge-no-account')).toBeVisible();

			// Edit the name.
			await chooseEntryAction(page, originalName, 'Edit');
			const edit = page.getByRole('dialog', { name: 'Edit register entry' });
			await edit.getByLabel('Full name').fill(editedName);
			await edit.getByRole('button', { name: 'Save changes' }).click();
			await expect(edit).toBeHidden({ timeout: 15_000 });
			await expect(registerEntry(page, editedName)).toBeVisible({ timeout: 15_000 });
			await expect(registerEntry(page, originalName).filter({ hasNotText: 'Edited' })).toHaveCount(
				0
			);

			// End it with reason "removed".
			await chooseEntryAction(page, editedName, 'End membership');
			const end = page.getByRole('dialog', { name: `End membership of ${editedName}` });
			await end.getByLabel('Removed').check();
			await end.getByRole('button', { name: 'End membership', exact: true }).click();
			await expect(end).toBeHidden({ timeout: 15_000 });
			await expect(registerEntry(page, editedName).getByText('Ended: removed')).toBeVisible({
				timeout: 15_000
			});

			// Two more entries (arranged) for the "members on date" filter: one that
			// covered the day 100 days ago, one that only started afterwards.
			const coveredName = uniqueName('Covered');
			const laterName = uniqueName('Later');
			await createRegisterEntry(org.owner, org.slug, {
				fullName: coveredName,
				tierId: org.defaultTierId,
				validFrom: daysFromNow(-150),
				validUntil: daysFromNow(-50)
			});
			await createRegisterEntry(org.owner, org.slug, {
				fullName: laterName,
				tierId: org.defaultTierId,
				validFrom: daysFromNow(-20)
			});
			await gotoHydrated(page, registerPath(org.slug));
			await waitForClientAuth(page);
			await expect(registerEntry(page, laterName)).toBeVisible({ timeout: 15_000 });
			await expect(registerEntry(page, coveredName)).toBeVisible();

			await page.getByLabel('Members on date').fill(localDay(-100));
			await expect(page).toHaveURL(/[?&]on=\d{4}-\d{2}-\d{2}/);
			await expect(registerEntry(page, coveredName)).toBeVisible({ timeout: 15_000 });
			await expect(registerEntry(page, laterName)).toHaveCount(0, { timeout: 15_000 });
			await expect(registerEntry(page, editedName)).toHaveCount(0);

			// Export: the job completes and the browser is offered an .xlsx download.
			await page.getByRole('button', { name: 'Export xlsx' }).first().click();
			const exportDialog = page.getByRole('dialog', { name: 'Export the register' });
			await expect(exportDialog).toBeVisible();
			const [download] = await Promise.all([
				page.waitForEvent('download', { timeout: 130_000 }),
				exportDialog.getByRole('button', { name: 'Export xlsx' }).click()
			]);
			expect(download.suggestedFilename()).toMatch(/\.xlsx$/i);
			await expect(
				page.getByText('Export ready! Your download should start automatically.')
			).toBeVisible({ timeout: 15_000 });
			await page.keyboard.press('Escape');
			await expect(exportDialog).toBeHidden();

			// Owner delete (clear the date filter first so the ended entry is listed).
			await page.getByRole('button', { name: 'Clear filters' }).click();
			await expect(registerEntry(page, editedName)).toBeVisible({ timeout: 15_000 });
			await chooseEntryAction(page, editedName, 'Delete');
			const del = page
				.getByRole('alertdialog')
				.or(page.getByRole('dialog'))
				.filter({
					hasText: `Delete the entry of ${editedName}?`
				});
			await del.getByRole('button', { name: 'Delete entry' }).click();
			await expect(registerEntry(page, editedName)).toHaveCount(0, { timeout: 15_000 });
			await expect(registerEntry(page, laterName)).toBeVisible();
		} finally {
			await context.close();
		}
	});
});
