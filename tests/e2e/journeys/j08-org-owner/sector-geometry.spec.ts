import type { Browser, Page } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import { createOrganization, uniqueName } from '../../support/factories';
import { ApiClient } from '../../support/api';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J8 — sector GEOMETRY (seat-geometry phase 1): the sector editor's geometry
// panel bends rows (curve) with a live preview, Save bakes an explicit
// position onto EVERY seat, and the recipe round-trips through
// sector.metadata.rowLayout. Bake math is unit-tested (seat-layout-bake);
// this spec proves panel -> preview -> save -> persistence wiring end to end.
//
// Isolation: throwaway org + venue + one seated sector arranged via API.

interface GeometryFixture {
	page: Page;
	api: ApiClient;
	slug: string;
	venueId: string;
	sectorId: string;
	close: () => Promise<void>;
}

async function openSectorEditor(browser: Browser): Promise<GeometryFixture> {
	const org = await createOrganization();
	const api = await ApiClient.login(org.owner.email, org.owner.password);
	const venue = await api.post<{ id: string }>(`/api/organization-admin/${org.slug}/venues`, {
		name: uniqueName('Curved Hall')
	});
	// 3 rows x 5 seats, NO positions — legacy grid-derived sector.
	// Seat writes still use `row` (becomes `row_label` in the Phase-2 rename).
	const seats = ['A', 'B', 'C'].flatMap((row, rowIndex) =>
		Array.from({ length: 5 }, (_, i) => ({
			label: `${row}${i + 1}`,
			row,
			number: i + 1,
			row_order: rowIndex,
			adjacency_index: i
		}))
	);
	const sector = await api.post<{ id: string }>(
		`/api/organization-admin/${org.slug}/venues/${venue.id}/sectors`,
		{ name: 'Stalls', seats }
	);

	const context = await browser.newContext();
	await authenticateContext(context, org.owner);
	const page = await context.newPage();
	await gotoHydrated(page, `/org/${org.slug}/admin/venues/${venue.id}/sectors/${sector.id}`);
	await waitForClientAuth(page);
	return {
		page,
		api,
		slug: org.slug,
		venueId: venue.id,
		sectorId: sector.id,
		close: () => context.close()
	};
}

test.describe('J8 sector geometry @p2', () => {
	test('curve slider bends preview → save bakes positions → recipe round-trips', async ({
		browser
	}) => {
		test.setTimeout(150_000);
		const { page, api, slug, venueId, sectorId, close } = await openSectorEditor(browser);

		// Panel + preview render.
		const curve = page.getByRole('slider', { name: 'Curve' });
		await expect(curve).toBeVisible({ timeout: 15_000 });
		const preview = page.getByRole('img', { name: 'Live preview of the seat layout' });
		await expect(preview).toBeVisible();

		// Straight baseline: every circle in row A shares one cy.
		const rowACy = async () =>
			preview
				.locator('circle')
				.evaluateAll((nodes) => nodes.slice(0, 5).map((n) => Number(n.getAttribute('cy'))));
		const flat = await rowACy();
		expect(new Set(flat).size).toBe(1);

		// Bend: range inputs respond to fill().
		await curve.fill('12');
		await expect
			.poll(async () => new Set(await rowACy()).size, { timeout: 5_000 })
			.toBeGreaterThan(1);

		// Save the whole plan. Seats already exist, so this round-trips through
		// the bulk-UPDATE mutation (`orgAdmin.seats.toast.updated`), not create.
		// handlePersist chains the seat write and the sector-metadata write
		// (rowLayout) as SEPARATE, sequential mutations — the "Seats updated"
		// toast only confirms the first. Wait for the Save button to re-enable
		// (isSaving flips false only once every mutation, including the
		// metadata one, has resolved) before reading persistence back via API.
		await page.getByRole('button', { name: 'Save Changes' }).click();
		await expect(page.getByText('Seats updated successfully')).toBeVisible({
			timeout: 15_000
		});
		await expect(page.getByRole('button', { name: 'Save Changes' })).toBeEnabled({
			timeout: 15_000
		});

		// Persistence: every seat now has a position; middle of row A sags below the ends.
		const sectors = await api.get<
			Array<{
				id: string;
				metadata?: { rowLayout?: { curve?: number } };
				seats?: Array<{ label: string; position?: { x: number; y: number } | null }>;
			}>
		>(`/api/organization-admin/${slug}/venues/${venueId}/sectors`);
		const saved = sectors.find((s) => s.id === sectorId)!;
		const positions = new Map(saved.seats!.map((s) => [s.label, s.position]));
		for (const seat of saved.seats!) expect(seat.position).toBeTruthy();
		expect(positions.get('A3')!.y).toBeGreaterThan(positions.get('A1')!.y);
		expect(saved.metadata?.rowLayout?.curve).toBe(12);

		// Reload: the recipe hydrates the panel.
		await page.reload();
		await waitForClientAuth(page);
		await expect(page.getByRole('slider', { name: 'Curve' })).toHaveValue('12', {
			timeout: 15_000
		});

		await close();
	});

	test('untouched geometry saves NO rowLayout key (grid stays byte-identical)', async ({
		browser
	}) => {
		test.setTimeout(150_000);
		const { page, api, slug, venueId, sectorId, close } = await openSectorEditor(browser);

		await expect(page.getByRole('slider', { name: 'Curve' })).toBeVisible({ timeout: 15_000 });
		// Save without touching geometry — the grid is unchanged, but positions
		// are still baked onto every seat (that's the always-bake contract).
		await page.getByRole('button', { name: 'Save Changes' }).click();
		await expect(page.getByText('Seats updated successfully')).toBeVisible({
			timeout: 15_000
		});
		// See the sibling test: wait for every chained mutation (seats +
		// sector-metadata) to resolve before reading persistence back via API.
		await expect(page.getByRole('button', { name: 'Save Changes' })).toBeEnabled({
			timeout: 15_000
		});

		const sectors = await api.get<
			Array<{
				id: string;
				metadata?: Record<string, unknown>;
				seats?: Array<{ position?: unknown }>;
			}>
		>(`/api/organization-admin/${slug}/venues/${venueId}/sectors`);
		const saved = sectors.find((s) => s.id === sectorId)!;
		expect(saved.metadata?.rowLayout).toBeUndefined();
		// Positions ARE baked now (integers) — the gate's death is the feature.
		for (const seat of saved.seats!) expect(seat.position).toBeTruthy();

		await close();
	});
});
