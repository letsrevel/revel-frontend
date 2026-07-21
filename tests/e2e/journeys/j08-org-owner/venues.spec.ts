import { test, expect } from '../../support/fixtures';
import {
	createOrganization,
	createPriceCategory,
	createTicketedEvent,
	createTicketTier,
	deleteDefaultTier,
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
		// guard. Pricing convergence: the reference lives in the tier's
		// category_prices map (the guard checks `category_prices__has_key`), and
		// a seated tier needs a sector — so paint a small sector with the
		// category and bind the tier to it.
		const org = await createOrganization();
		const api = await ApiClient.login(org.owner.email, org.owner.password);
		const venueName = uniqueName('Venue');
		const venue = await api.post<{ id: string }>(`/api/organization-admin/${org.slug}/venues`, {
			name: venueName
		});
		const velvet = await createPriceCategory(org.slug, venue.id, { name: 'Velvet' }, org.owner);
		const guardSector = await api.post<{ id: string }>(
			`/api/organization-admin/${org.slug}/venues/${venue.id}/sectors`,
			{
				name: 'Velvet Floor',
				kind: 'seated',
				seats: Array.from({ length: 2 }, (_, i) => ({
					label: `A${i + 1}`,
					row: 'A',
					number: i + 1,
					price_category_id: velvet.id
				}))
			}
		);
		const event = await createTicketedEvent({
			owner: org.owner,
			orgSlug: org.slug,
			freeTier: false,
			event: { venue_id: venue.id }
		});
		await createTicketTier(
			event.id,
			{
				name: 'BA Velvet',
				payment_method: 'free',
				price: '0.00',
				seat_assignment_mode: 'best_available',
				venue_id: venue.id,
				sector_id: guardSector.id,
				category_prices: { [velvet.id]: '0.00' }
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

// J19.3 (USER_JOURNEYS.md) — seat PAINTING in the grid editor: the sector page's
// paint palette lists the venue's price categories as chips; selecting a chip
// turns painting on, and clicking a seat cell paints it. Saving fires the venue
// paint endpoint (PUT …/seats/paint) for the touched seats, and the paint
// ROUND-TRIPS: the seat read exposes price_category_id (BE #734), so a reload
// re-hydrates the painted seat — asserted here after a full navigation.
//
// Isolation: throwaway org + venue + sector arranged via API; nothing seeded is
// touched. The sector is created WITH four seats so the editor hydrates a real
// grid the paint clicks can land on.
test.describe('J19.3 seat painting @p2', () => {
	test('paint palette → select chip → click seat → save fires the paint endpoint', async ({
		browser
	}) => {
		test.setTimeout(150_000);

		// Arrange (API): venue + a price category + a seated sector carrying a
		// 2×2 grid (A1/A2/B1/B2) the editor can re-derive from labels.
		const org = await createOrganization();
		const api = await ApiClient.login(org.owner.email, org.owner.password);
		const venueName = uniqueName('Venue');
		const venue = await api.post<{ id: string }>(`/api/organization-admin/${org.slug}/venues`, {
			name: venueName
		});
		await createPriceCategory(org.slug, venue.id, { name: 'Amber', color: '#f9b233' }, org.owner);
		const sector = await api.post<{ id: string }>(
			`/api/organization-admin/${org.slug}/venues/${venue.id}/sectors`,
			{
				name: 'Stalls',
				code: 'STL',
				seats: [
					{ label: 'A1', row: 'A', number: 1, position: { x: 0, y: 0 } },
					{ label: 'A2', row: 'A', number: 2, position: { x: 1, y: 0 } },
					{ label: 'B1', row: 'B', number: 1, position: { x: 0, y: 1 } },
					{ label: 'B2', row: 'B', number: 2, position: { x: 1, y: 1 } }
				]
			}
		);

		const context = await browser.newContext();
		await authenticateContext(context, org.owner);
		const page = await context.newPage();

		await gotoHydrated(page, `/org/${org.slug}/admin/venues/${venue.id}/sectors/${sector.id}`);
		await waitForClientAuth(page);
		await expect(page.getByRole('heading', { name: 'Seats - Stalls' })).toBeVisible();

		// The grid hydrated from the four arranged seats.
		await expect(page.getByText('Total:')).toContainText('4', { timeout: 15_000 });

		// The paint palette lists the venue's category as a chip. Selecting it
		// turns painting on (the "Painting is on" status confirms).
		const palette = page.getByRole('group', { name: 'Price category palette' });
		await expect(palette).toBeVisible();
		const amberChip = palette.getByRole('button', { name: 'Amber' });
		await expect(amberChip).toBeVisible();
		await amberChip.click();
		await expect(amberChip).toHaveAttribute('aria-pressed', 'true');
		await expect(page.getByText('Painting is on', { exact: false })).toBeVisible();

		// Clicking a seat cell paints it: its accessible name gains the category.
		const seatA1 = page.getByRole('button', { name: 'Seat A1', exact: true });
		await expect(seatA1).toBeVisible();
		await seatA1.click();
		await expect(page.getByRole('button', { name: 'Seat A1, Amber', exact: true })).toBeVisible();

		// Save: existing-seat paint changes go to the paint endpoint after the
		// bulk ops. The paint toast proves that request succeeded.
		await page.getByRole('button', { name: 'Save Changes' }).click();
		await expect(page.getByText('Seat pricing updated')).toBeVisible({ timeout: 15_000 });

		// Round-trip (BE #734): reload and confirm the paint re-hydrates from the
		// seat read — A1 keeps its category in its accessible name, A2 stays plain.
		await gotoHydrated(page, `/org/${org.slug}/admin/venues/${venue.id}/sectors/${sector.id}`);
		await waitForClientAuth(page);
		await expect(page.getByText('Total:')).toContainText('4', { timeout: 15_000 });
		await expect(page.getByRole('button', { name: 'Seat A1, Amber', exact: true })).toBeVisible({
			timeout: 15_000
		});
		await expect(page.getByRole('button', { name: 'Seat A2', exact: true })).toBeVisible();

		await context.close();
	});

	// J19.4 repricing guard (#674, BE #747): repainting a seat between two
	// PRICED categories changes what buyers are charged for every event at the
	// venue and fails OPEN — coverage stays complete, so nothing else fires.
	// The editor previews the paint (?preview=true), demands confirmation when
	// an on-sale (open) event is repriced, and reports the precise move after
	// applying. Isolation: throwaway org + own venue (painting a shared venue
	// would break concurrently-saved category-priced tiers).
	test('repaint between priced categories → confirm on live event → precise reprice toast', async ({
		browser
	}) => {
		test.setTimeout(150_000);

		const org = await createOrganization();
		const api = await ApiClient.login(org.owner.email, org.owner.password);
		const venue = await api.post<{ id: string }>(`/api/organization-admin/${org.slug}/venues`, {
			name: uniqueName('Venue')
		});
		const gold = await createPriceCategory(
			org.slug,
			venue.id,
			{ name: 'Gold', color: '#f9b233' },
			org.owner
		);
		await createPriceCategory(org.slug, venue.id, { name: 'Silver', color: '#9ab2ff' }, org.owner);
		const sector = await api.post<{ id: string }>(
			`/api/organization-admin/${org.slug}/venues/${venue.id}/sectors`,
			{
				name: 'Stalls',
				code: 'STL',
				seats: [
					{ label: 'A1', row: 'A', number: 1, price_category_id: gold.id },
					{ label: 'A2', row: 'A', number: 2, price_category_id: gold.id },
					{ label: 'B1', row: 'B', number: 1 },
					{ label: 'B2', row: 'B', number: 2 }
				]
			}
		);
		// An OPEN (on-sale) event whose user_choice tier prices BOTH categories:
		// the repaint keeps coverage complete, so only the repricing guard fires.
		const event = await createTicketedEvent({
			owner: org.owner,
			orgSlug: org.slug,
			freeTier: false,
			event: { venue_id: venue.id }
		});
		await deleteDefaultTier(event.id, org.owner);
		const silver = await api.get<Array<{ id: string; name: string }>>(
			`/api/organization-admin/${org.slug}/venues/${venue.id}/price-categories`
		);
		const silverId = silver.find((c) => c.name === 'Silver')?.id;
		if (!silverId) throw new Error('Silver category missing');
		await createTicketTier(
			event.id,
			{
				name: 'Stalls Tier',
				payment_method: 'offline',
				price: '10.00',
				seat_assignment_mode: 'user_choice',
				venue_id: venue.id,
				sector_id: sector.id,
				category_prices: { [gold.id]: '80.00', [silverId]: '30.00' }
			},
			org.owner
		);

		const context = await browser.newContext();
		await authenticateContext(context, org.owner);
		const page = await context.newPage();
		await gotoHydrated(page, `/org/${org.slug}/admin/venues/${venue.id}/sectors/${sector.id}`);
		await waitForClientAuth(page);
		await expect(page.getByText('Total:')).toContainText('4', { timeout: 15_000 });

		// The palette states the venue-wide blast radius BEFORE any paint.
		await expect(
			page.getByText('Paint applies to every event at this venue', { exact: false })
		).toBeVisible();

		// Repaint A1: Gold (80.00) → Silver (30.00). The save previews the paint
		// and must ask for confirmation naming the tier, event and price move.
		const palette = page.getByRole('group', { name: 'Price category palette' });
		await palette.getByRole('button', { name: 'Silver' }).click();
		await page.getByRole('button', { name: 'Seat A1, Gold', exact: true }).click();

		let confirmMessage = '';
		page.once('dialog', (dialog) => {
			confirmMessage = dialog.message();
			void dialog.accept();
		});
		await page.getByRole('button', { name: 'Save Changes' }).click();

		// Accepted: the paint applies and the precise repricing toast follows.
		await expect(page.getByText('Seat pricing updated')).toBeVisible({ timeout: 15_000 });
		await expect(page.getByText('Repainted seats changed price zone')).toBeVisible({
			timeout: 15_000
		});
		await expect(page.getByText(/1 seat\(s\) 80\.00 → 30\.00/)).toBeVisible();
		expect(confirmMessage).toContain('ON SALE');
		expect(confirmMessage).toContain('Stalls Tier');
		expect(confirmMessage).toContain(event.name);
		expect(confirmMessage).toContain('1 seat(s) 80.00 → 30.00');

		await context.close();
	});
});
