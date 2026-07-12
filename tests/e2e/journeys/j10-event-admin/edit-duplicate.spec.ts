import { test, expect } from '../../support/fixtures';
import { createTicketedEvent, uniqueName } from '../../support/factories';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J10 edit + duplicate — rename an event through the editor's SaveBar, then
// duplicate it from the "More actions" kebab. The duplicate modal prefills
// "Copy of {name}" and a future start; on success it navigates straight to
// the NEW event's edit page (no toast) with the copy reset to DRAFT.

test.describe('J10 edit & duplicate @p2', () => {
	test('rename persists; duplicate creates a draft copy', async ({ asOwner }) => {
		const event = await createTicketedEvent({
			freeTier: false,
			event: { requires_ticket: false }
		});
		const page = asOwner;
		await gotoHydrated(page, `/org/${event.orgSlug}/admin/events/${event.id}/edit`);
		await waitForClientAuth(page);
		await expect(page.getByRole('heading', { name: 'Edit Event', level: 1 })).toBeVisible();

		// Edit: rename and Save (SaveBar keeps you on the page).
		const newName = uniqueName('Renamed');
		await page.locator('#event-name').fill(newName);
		// Two SaveBars render (top + bottom of the editor) — take the first.
		await page.getByRole('button', { name: 'Save', exact: true }).first().click();
		await expect(page.getByText('Event updated successfully!')).toBeVisible({ timeout: 20_000 });
		// The rename survives a fresh load.
		await gotoHydrated(page, `/org/${event.orgSlug}/admin/events/${event.id}/edit`);
		await waitForClientAuth(page);
		await expect(page.locator('#event-name')).toHaveValue(newName, { timeout: 15_000 });

		// Duplicate: kebab → "Duplicate" → modal prefilled "Copy of {name}".
		await page.getByRole('button', { name: 'More actions' }).click();
		await page.getByRole('menuitem', { name: 'Duplicate' }).click();
		const dialog = page.getByRole('dialog', { name: 'Duplicate Event' });
		await expect(dialog).toBeVisible();
		await expect(dialog.getByLabel('New Event Name')).toHaveValue(`Copy of ${newName}`);
		await dialog.getByRole('button', { name: 'Duplicate Event' }).click();

		// Success navigates to the copy's edit page — a DIFFERENT event id (a
		// bare pattern would match the CURRENT edit URL and resolve instantly).
		await page.waitForURL(
			(url) =>
				/\/admin\/events\/[0-9a-f-]+\/edit/.test(url.pathname) && !url.pathname.includes(event.id),
			{ timeout: 30_000 }
		);
		const copyId = page.url().match(/\/admin\/events\/([0-9a-f-]+)\/edit/)?.[1];
		expect(copyId).toBeTruthy();
		expect(copyId).not.toBe(event.id);

		// The copy carries the new name and is reset to DRAFT.
		await expect(page.locator('#event-name')).toHaveValue(`Copy of ${newName}`, {
			timeout: 15_000
		});
		await expect(page.getByText('Draft', { exact: true })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Publish Event' })).toBeVisible();
	});
});
