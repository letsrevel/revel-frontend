import { test, expect } from '../../support/fixtures';
import { createOrganization, uniqueName } from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J8 (USER_JOURNEYS.md) — venue management, all through the UI: create a
// venue, add a sector, bulk-create its seats in the grid editor, and prove
// the layout persists.
//
// Isolation: throwaway-owned org — the seeded "Revel Concert Hall" (Org
// Alpha) is never touched.

test.describe('J8 venues @p2', () => {
	test('create venue → sector → bulk seats in the grid editor', async ({ browser }) => {
		test.setTimeout(150_000);

		const org = await createOrganization();
		const venueName = uniqueName('Venue');

		const context = await browser.newContext();
		await authenticateContext(context, org.owner);
		const page = await context.newPage();

		// Create the venue.
		await gotoHydrated(page, `/org/${org.slug}/admin/venues`);
		await waitForClientAuth(page);
		await expect(page.getByRole('heading', { name: 'Venues', level: 1 })).toBeVisible();
		// Header button + empty-state CTA both say "Create Venue" on a fresh org.
		await page.getByRole('button', { name: 'Create Venue' }).first().click();
		const venueModal = page.getByRole('dialog', { name: 'Create Venue' });
		await expect(venueModal).toBeVisible();
		await venueModal.getByLabel('Venue Name').fill(venueName);
		await venueModal.getByLabel('Total Capacity').fill('12');
		await venueModal.getByRole('button', { name: 'Create Venue' }).click();
		await expect(venueModal).not.toBeVisible({ timeout: 15_000 });
		await expect(page.getByText(venueName)).toBeVisible();

		// Into the venue → create a sector.
		await page.getByLabel('Manage sectors').first().click();
		await expect(page.getByRole('heading', { name: `Sectors - ${venueName}` })).toBeVisible();
		// Header button + empty-state CTA both say "Add Sector".
		await page.getByRole('button', { name: 'Add Sector' }).first().click();
		const sectorModal = page.getByRole('dialog', { name: 'Create Sector' });
		await expect(sectorModal).toBeVisible();
		await sectorModal.getByLabel('Sector Name').fill('Balcony');
		await sectorModal.getByLabel('Sector Code').fill('BAL');
		await sectorModal.getByRole('button', { name: 'Create Sector' }).click();
		await expect(sectorModal).not.toBeVisible({ timeout: 15_000 });
		await expect(page.getByText('Balcony')).toBeVisible();

		// Into the sector → bulk-create a 2×3 grid of seats.
		await page.getByLabel('Manage seats').first().click();
		await expect(page.getByRole('heading', { name: 'Seats - Balcony' })).toBeVisible();
		await page.getByLabel('Rows').fill('2');
		await page.getByLabel('Columns').fill('3');
		await page.getByRole('button', { name: 'Fill All' }).click();
		await expect(page.getByText('Total:')).toContainText('6');
		await page.getByRole('button', { name: 'Save Changes' }).click();
		await expect(page.getByText('Seats saved successfully')).toBeVisible({ timeout: 15_000 });

		// Reload: the editor re-initializes from the persisted seats.
		await gotoHydrated(page, page.url());
		await expect(page.getByText('Total:')).toContainText('6', { timeout: 15_000 });

		// Back on the sectors page the card counts the seats.
		await page.getByRole('button', { name: 'Back to sectors' }).click();
		await expect(page.getByText(/6 seats/)).toBeVisible({ timeout: 15_000 });

		await context.close();
	});
});
