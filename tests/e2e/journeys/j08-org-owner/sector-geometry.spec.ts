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

/**
 * Snug outline around the plain 3x5 grid: the seats sit at integer positions
 * (0..4, 0..2), so this box contains them all with half a unit to spare and
 * NOTHING else. Any curve immediately pushes seats outside it — which is the
 * whole point: it arms the shape-fit gate.
 */
const SNUG_SHAPE = [
	{ x: -0.5, y: -0.5 },
	{ x: 4.5, y: -0.5 },
	{ x: 4.5, y: 2.5 },
	{ x: -0.5, y: 2.5 }
];

/** Ray-casting point-in-polygon, mirroring the backend's own containment test. */
function pointInPolygon(
	point: { x: number; y: number },
	polygon: Array<{ x: number; y: number }>
): boolean {
	let inside = false;
	for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
		const a = polygon[i];
		const b = polygon[j];
		const straddles = a.y > point.y !== b.y > point.y;
		if (straddles && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) {
			inside = !inside;
		}
	}
	return inside;
}

async function openSectorEditor(
	browser: Browser,
	options: { shape?: Array<{ x: number; y: number }> } = {}
): Promise<GeometryFixture> {
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
		{ name: 'Stalls', seats, ...(options.shape ? { shape: options.shape } : {}) }
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
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const saved = sectors.find((s) => s.id === sectorId)!;
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const positions = new Map(saved.seats!.map((s) => [s.label, s.position]));
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		for (const seat of saved.seats!) expect(seat.position).toBeTruthy();
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const saved = sectors.find((s) => s.id === sectorId)!;
		expect(saved.metadata?.rowLayout).toBeUndefined();
		// Positions ARE baked now (integers) — the gate's death is the feature.
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		for (const seat of saved.seats!) expect(seat.position).toBeTruthy();

		await close();
	});

	// Regression, final review Critical: the sector SHAPE must be written BEFORE
	// the seat writes. The backend validates every bulk-created/updated seat
	// position against the PERSISTED shape, so writing seats first made both
	// "Auto-fit outline" and "Clear outline" 400 every time — the dialog's only
	// working button was Cancel.
	test('auto-fit outline: shape lands first, so the curved seats save', async ({ browser }) => {
		test.setTimeout(150_000);
		const { page, api, slug, venueId, sectorId, close } = await openSectorEditor(browser, {
			shape: SNUG_SHAPE
		});

		const curve = page.getByRole('slider', { name: 'Curve' });
		await expect(curve).toBeVisible({ timeout: 15_000 });
		await curve.fill('12');

		// Curved rows now fall outside the snug outline → the gate stops the save.
		await page.getByRole('button', { name: 'Save Changes' }).click();
		const dialog = page.getByRole('dialog');
		await expect(dialog.getByText('Outline no longer fits')).toBeVisible({ timeout: 15_000 });

		await dialog.getByRole('button', { name: 'Auto-fit outline' }).click();

		// Seat write succeeds (it used to 400 here), and the whole chain settles.
		await expect(page.getByText('Seats updated successfully')).toBeVisible({ timeout: 15_000 });
		await expect(page.getByRole('button', { name: 'Save Changes' })).toBeEnabled({
			timeout: 15_000
		});

		const sectors = await api.get<
			Array<{
				id: string;
				shape?: Array<{ x: number; y: number }> | null;
				metadata?: { rowLayout?: { curve?: number } };
				seats?: Array<{ label: string; position?: { x: number; y: number } | null }>;
			}>
		>(`/api/organization-admin/${slug}/venues/${venueId}/sectors`);
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const saved = sectors.find((s) => s.id === sectorId)!;

		// The recipe round-tripped and the seats really are curved.
		expect(saved.metadata?.rowLayout?.curve).toBe(12);
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const positions = new Map(saved.seats!.map((s) => [s.label, s.position]));
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		expect(positions.get('A3')!.y).toBeGreaterThan(positions.get('A1')!.y);

		// The outline was REPLACED (not left at the snug box) and now contains
		// every baked seat — which is exactly why the seat write was allowed.
		const shape = saved.shape ?? [];
		expect(shape.length).toBeGreaterThanOrEqual(3);
		expect(shape).not.toEqual(SNUG_SHAPE);
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		for (const seat of saved.seats!) {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			expect(pointInPolygon(seat.position!, shape), `${seat.label} inside outline`).toBe(true);
		}

		await close();
	});
});
