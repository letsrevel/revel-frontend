import type { Browser, Page } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import { createOrganization, uniqueName } from '../../support/factories';
import { ApiClient } from '../../support/api';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// #680 — multi-floor venues, designer side. The layout designer grows a floor
// bar: floors are created/renamed/reordered/deleted there, each floor is its
// own canvas (only its blocks render), blocks without an explicit assignment
// live on the FIRST floor by convention, and a selected block can be moved to
// another floor (the canvas follows it). Deleting a floor that still has
// sectors is refused with a deterministic message. Saving persists
// `venue.metadata.floors` + `sector.metadata.floor` (merged, never clobbering
// transform/stage), proven here by a full reload.
//
// Isolation: throwaway org + venue + two seated sectors arranged via API.

interface FloorsFixture {
	page: Page;
	slug: string;
	venueId: string;
	close: () => Promise<void>;
}

/** Arrange a throwaway venue with two seated sectors and open its designer. */
async function openDesigner(browser: Browser): Promise<FloorsFixture> {
	const org = await createOrganization();
	const api = await ApiClient.login(org.owner.email, org.owner.password);
	const venue = await api.post<{ id: string }>(`/api/organization-admin/${org.slug}/venues`, {
		name: uniqueName('Floors Venue')
	});
	await api.post(`/api/organization-admin/${org.slug}/venues/${venue.id}/sectors`, {
		name: 'Stalls',
		seats: [
			{ label: 'A1', row: 'A', number: 1, position: { x: 0, y: 0 } },
			{ label: 'A2', row: 'A', number: 2, position: { x: 1, y: 0 } }
		]
	});
	await api.post(`/api/organization-admin/${org.slug}/venues/${venue.id}/sectors`, {
		name: 'Balcony',
		seats: [
			{ label: 'B1', row: 'B', number: 1, position: { x: 0, y: 0 } },
			{ label: 'B2', row: 'B', number: 2, position: { x: 1, y: 0 } }
		]
	});

	const context = await browser.newContext();
	await authenticateContext(context, org.owner);
	const page = await context.newPage();
	await gotoHydrated(page, `/org/${org.slug}/admin/venues/${venue.id}/designer`);
	await waitForClientAuth(page);

	return { page, slug: org.slug, venueId: venue.id, close: () => context.close() };
}

test.describe('J8 designer floors @p2', () => {
	test('create floors → per-floor canvases → move block → delete guard → save persists', async ({
		browser
	}) => {
		test.setTimeout(180_000);

		const { page, close } = await openDesigner(browser);

		await expect(page.getByRole('application', { name: 'Seat layout canvas' })).toBeVisible({
			timeout: 15_000
		});
		const stallsBlock = page.getByRole('button', { name: /^Sector Stalls/ });
		const balconyBlock = page.getByRole('button', { name: /^Sector Balcony/ });
		await expect(stallsBlock).toBeVisible();
		await expect(balconyBlock).toBeVisible();

		// No floors yet: the bar offers only "Add floor" (flattened plane).
		const floorChips = page.getByRole('group', { name: 'Floors' });
		await expect(floorChips).toBeHidden();

		// Create two floors. Each new floor becomes active — and since both
		// sectors implicitly live on the FIRST floor, Floor 2's canvas is empty.
		await page.getByRole('button', { name: 'Add floor', exact: true }).click();
		await expect(floorChips.getByRole('button', { name: 'Floor 1', exact: true })).toBeVisible();
		await page.getByRole('button', { name: 'Add floor', exact: true }).click();
		const floor2Chip = floorChips.getByRole('button', { name: 'Floor 2', exact: true });
		await expect(floor2Chip).toBeVisible();
		await expect(floor2Chip).toHaveAttribute('aria-pressed', 'true');
		await expect(stallsBlock).toBeHidden();
		await expect(balconyBlock).toBeHidden();

		// Rename the active floor (Floor 2) from the bar.
		await page.getByLabel('Floor name').fill('Balcony Level');
		await page.keyboard.press('Enter');
		const balconyChip = floorChips.getByRole('button', { name: 'Balcony Level', exact: true });
		await expect(balconyChip).toBeVisible();

		// Back on Floor 1 both implicit blocks render.
		await floorChips.getByRole('button', { name: 'Floor 1', exact: true }).click();
		await expect(stallsBlock).toBeVisible();
		await expect(balconyBlock).toBeVisible();

		// Select the Balcony block and move it to the renamed floor — the
		// canvas follows the block: Balcony Level shows ONLY Balcony.
		await balconyBlock.click();
		await expect(balconyBlock).toHaveAttribute('aria-pressed', 'true');
		await page.getByLabel('Move to floor').selectOption({ label: 'Balcony Level' });
		await expect(balconyChip).toHaveAttribute('aria-pressed', 'true');
		await expect(balconyBlock).toBeVisible();
		await expect(stallsBlock).toBeHidden();
		// The stage lives on the FIRST floor by convention — hidden here.
		await expect(page.getByRole('button', { name: 'Stage', exact: true })).toBeHidden();

		// Deleting a floor that still has sectors is refused, deterministically.
		// (Scoped: the demo-mode banner is a page-level role=alert too.)
		await page.getByRole('button', { name: 'Delete floor', exact: true }).click();
		const deleteBlocked = page.getByRole('alert').filter({ hasText: 'Cannot delete' });
		await expect(deleteBlocked).toContainText('Balcony Level');
		await expect(deleteBlocked).toContainText('(Balcony)');
		await expect(balconyChip).toBeVisible();

		// Save persists floors + assignment; the toast confirms, Save disables.
		const saveButton = page.getByRole('button', { name: 'Save layout' });
		await expect(saveButton).toBeEnabled();
		await saveButton.click();
		await expect(page.getByText('Layout saved')).toBeVisible({ timeout: 15_000 });
		await expect(saveButton).toBeDisabled({ timeout: 15_000 });

		// Full reload: the persisted convention round-trips — Floor 1 (first,
		// active by default) shows only Stalls plus the stage; Balcony Level
		// shows only Balcony.
		await page.reload();
		await waitForClientAuth(page);
		await expect(page.getByRole('application', { name: 'Seat layout canvas' })).toBeVisible({
			timeout: 15_000
		});
		await expect(floorChips.getByRole('button', { name: 'Floor 1', exact: true })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await expect(stallsBlock).toBeVisible();
		await expect(balconyBlock).toBeHidden();
		await expect(page.getByRole('button', { name: 'Stage', exact: true })).toBeVisible();
		await floorChips.getByRole('button', { name: 'Balcony Level', exact: true }).click();
		await expect(balconyBlock).toBeVisible();
		await expect(stallsBlock).toBeHidden();

		await close();
	});
});
