import { test, expect } from '../../support/fixtures';
import {
	createOrganization,
	createPriceCategory,
	createTicketedEvent,
	createTicketTier,
	uniqueName
} from '../../support/factories';
import { ApiClient } from '../../support/api';
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

// J19.2 (USER_JOURNEYS.md) — venue price-category admin CRUD: create through
// the modal (name + color + display order), edit, the duplicate-(venue,name)
// 400 surfacing inline in the modal, the tier-referenced delete guard
// (FK is SET_NULL, so the backend refuses with a 400 detail), and a clean
// delete of an unreferenced category.
//
// Isolation: throwaway org + venue; the delete-guard tier lives on a fresh
// event of that same org, so seeded venues/tiers are never touched.
test.describe('J19.2 price categories @p2', () => {
	test('create → edit → duplicate 400 → tier-referenced delete guard → delete', async ({
		browser
	}) => {
		test.setTimeout(150_000);

		// Arrange (API): throwaway org + venue; a category ("Velvet") that a
		// best-available tier on a fresh event references, arming the delete
		// guard. Tier creation only needs the category to exist on a venue of
		// the event's org — painted seats are irrelevant for validation.
		const org = await createOrganization();
		const api = await ApiClient.login(org.owner.email, org.owner.password);
		const venueName = uniqueName('Venue');
		const venue = await api.post<{ id: string }>(`/api/organization-admin/${org.slug}/venues`, {
			name: venueName
		});
		const velvet = await createPriceCategory(org.slug, venue.id, { name: 'Velvet' }, org.owner);
		const event = await createTicketedEvent({
			owner: org.owner,
			orgSlug: org.slug,
			freeTier: false
		});
		await createTicketTier(
			event.id,
			{
				name: 'BA Velvet',
				payment_method: 'free',
				price: '0.00',
				seat_assignment_mode: 'best_available',
				price_category_id: velvet.id
			},
			org.owner
		);

		const context = await browser.newContext();
		await authenticateContext(context, org.owner);
		const page = await context.newPage();
		// The section's delete flow uses native confirm(); Playwright dismisses
		// dialogs by default, so accept them for the whole page.
		page.on('dialog', (dialog) => void dialog.accept());

		await gotoHydrated(page, `/org/${org.slug}/admin/venues/${venue.id}`);
		await waitForClientAuth(page);
		await expect(page.getByRole('heading', { name: `Sectors - ${venueName}` })).toBeVisible();

		// The section is a labeled region; scoping every row assertion to it
		// keeps nav/list lookups strict-mode safe.
		const section = page.getByRole('region', { name: 'Price Categories' });
		await expect(section.getByText('Velvet')).toBeVisible();

		// CREATE — name, color (programmatically: native color pickers are not
		// automatable, so set the value and fire the input event the Svelte
		// binding listens for), display order.
		await section.getByRole('button', { name: 'Add Price Category' }).first().click();
		const createModal = page.getByRole('dialog', { name: 'Create Price Category' });
		await expect(createModal).toBeVisible();
		await createModal.getByLabel('Name').fill('Amber');
		await createModal.getByLabel('Color').evaluate((el, value) => {
			const input = el as HTMLInputElement;
			input.value = value;
			input.dispatchEvent(new Event('input', { bubbles: true }));
		}, '#0055aa');
		// The hex readback next to the picker reflects the programmatic value.
		await expect(createModal.getByText('#0055aa')).toBeVisible();
		await createModal.getByLabel('Display Order').fill('2');
		await createModal.getByRole('button', { name: 'Create Category' }).click();
		await expect(createModal).not.toBeVisible({ timeout: 15_000 });

		const amberRow = section.getByRole('listitem').filter({ hasText: 'Amber' });
		await expect(amberRow).toBeVisible();
		await expect(amberRow.getByText('#0055aa')).toBeVisible();
		await expect(amberRow.getByText('Order: 2')).toBeVisible();

		// EDIT — rename + reorder through the same modal.
		await amberRow.getByRole('button', { name: 'Edit price category Amber' }).click();
		const editModal = page.getByRole('dialog', { name: 'Edit Price Category' });
		await expect(editModal).toBeVisible();
		await editModal.getByLabel('Name').fill('Amber Premium');
		await editModal.getByLabel('Display Order').fill('0');
		await editModal.getByRole('button', { name: 'Save' }).click();
		await expect(editModal).not.toBeVisible({ timeout: 15_000 });
		await expect(amberRow.getByText('Amber Premium')).toBeVisible();
		await expect(amberRow.getByText('Order: 0')).toBeVisible();

		// DUPLICATE — a second "Velvet" on the same venue is a backend 400; the
		// modal surfaces it inline (role=alert) and stays open for a rename.
		await section.getByRole('button', { name: 'Add Price Category' }).first().click();
		const dupModal = page.getByRole('dialog', { name: 'Create Price Category' });
		await expect(dupModal).toBeVisible();
		await dupModal.getByLabel('Name').fill('Velvet');
		await dupModal.getByRole('button', { name: 'Create Category' }).click();
		const inlineError = dupModal.getByRole('alert');
		await expect(inlineError).toBeVisible({ timeout: 15_000 });
		await expect(inlineError).toHaveText(/\S/);
		await expect(dupModal).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(dupModal).not.toBeVisible();

		// DELETE GUARD — "Velvet" is referenced by the best-available tier, so
		// the backend refuses with a 400 whose detail lands in the error toast.
		const velvetRow = section.getByRole('listitem').filter({ hasText: 'Velvet' });
		await velvetRow.getByRole('button', { name: 'Delete price category Velvet' }).click();
		await expect(page.getByText(/used by one or more ticket tiers/)).toBeVisible({
			timeout: 15_000
		});
		await expect(velvetRow).toBeVisible();

		// DELETE — the unreferenced category goes away cleanly.
		await amberRow.getByRole('button', { name: 'Delete price category Amber Premium' }).click();
		await expect(page.getByText('Price category deleted')).toBeVisible({ timeout: 15_000 });
		await expect(amberRow).not.toBeVisible();

		await context.close();
	});
});
