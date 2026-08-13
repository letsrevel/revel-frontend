import type { Browser, Page } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import { createOrganization, uniqueName } from '../../support/factories';
import { ApiClient } from '../../support/api';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J8 — sector GEOMETRY (seat-geometry phase 1): the sector editor's geometry
// panel bends rows (curve) IN THE GRID ITSELF — there is one WYSIWYG editing
// surface, whose cell buttons sit at the baked positions checkout renders —
// Save bakes an explicit position onto EVERY seat, and the recipe round-trips
// through sector.metadata.rowLayout. Bake math is unit-tested
// (seat-layout-bake); this spec proves panel -> grid -> save -> persistence
// wiring end to end.
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
	test('curve slider bends the grid → save bakes positions → recipe round-trips', async ({
		browser
	}) => {
		test.setTimeout(150_000);
		const { page, api, slug, venueId, sectorId, close } = await openSectorEditor(browser);

		// Panel + the single WYSIWYG grid render.
		const curve = page.getByRole('slider', { name: 'Curve' });
		await expect(curve).toBeVisible({ timeout: 15_000 });
		await expect(page.getByTestId('seat-grid-canvas')).toBeVisible();

		// The grid IS the preview now: cell buttons are absolutely positioned at
		// their baked coordinates, so the curve has to move THEM. Row A spans
		// data-cell 0-0 .. 0-4; the arc pins its endpoints and sags the middle.
		const cellTop = (key: string) =>
			page.locator(`[data-cell="${key}"]`).evaluate((node) => (node as HTMLElement).offsetTop);

		// Straight baseline: the whole row is level.
		const flat = await Promise.all(['0-0', '0-2', '0-4'].map(cellTop));
		expect(new Set(flat).size).toBe(1);

		// Bend: range inputs respond to fill().
		await curve.fill('12');
		await expect
			.poll(async () => (await cellTop('0-2')) - (await cellTop('0-0')), { timeout: 5_000 })
			.toBeGreaterThan(0);
		// Endpoints stay level with each other — that's an arc, not a tilt.
		expect(await cellTop('0-4')).toBe(await cellTop('0-0'));

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
		// The proposed outline is drawn INSIDE the dialog (it used to live in the
		// editor's side preview, i.e. behind this modal's own overlay).
		const thumbnail = dialog.getByRole('img', { name: 'Live preview of the seat layout' });
		await expect(thumbnail).toBeVisible();
		await expect(thumbnail.locator('polygon')).toHaveCount(2);

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
	// Phase 4 (Task B): "Adjust seats" mode — the friction gate. Only inside it
	// does a seat drag; the delta becomes ONE seatNudge on the recipe and moves
	// exactly that seat's baked position. Undo is session-only and window-level.
	test('adjust mode: keyboard-nudge a seat → save writes seatNudges and the moved position', async ({
		browser
	}) => {
		test.setTimeout(150_000);
		const { page, api, slug, venueId, sectorId, close } = await openSectorEditor(browser);

		const adjustToggle = page.getByTestId('adjust-mode-toggle');
		await expect(adjustToggle).toBeVisible({ timeout: 15_000 });
		await expect(adjustToggle).toHaveAttribute('aria-pressed', 'false');

		const seat = page.locator('[data-cell="0-1"]');
		const homeLeft = await seat.evaluate((node) => (node as HTMLElement).offsetLeft);

		// Off: a click still toggles the cell (normal editing is untouched). Undo
		// that immediately so the rest of the test starts from the saved grid.
		await seat.click();
		await expect(page.getByTestId('seat-grid-undo')).toBeEnabled();
		await page.getByTestId('seat-grid-undo').click();

		// On: the same click SELECTS the seat, and the inspector names it.
		await adjustToggle.click();
		await expect(adjustToggle).toHaveAttribute('aria-pressed', 'true');
		await seat.click();
		await expect(page.getByTestId('adjust-inspector-title')).toContainText('A2');

		// Keyboard nudge (the WCAG path): Shift = half-seat steps.
		await seat.focus();
		await page.keyboard.press('Shift+ArrowRight');
		await expect
			.poll(async () => seat.evaluate((node) => (node as HTMLElement).offsetLeft), {
				timeout: 5_000
			})
			.toBeGreaterThan(homeLeft);
		await expect(page.getByLabel('Move sideways (seats)')).toHaveValue('0.5');

		// Undo BEFORE saving reverts the grid to its un-nudged geometry...
		await page.getByTestId('seat-grid-undo').click();
		await expect
			.poll(async () => seat.evaluate((node) => (node as HTMLElement).offsetLeft), {
				timeout: 5_000
			})
			.toBe(homeLeft);
		// ...and redo puts it back.
		await page.getByTestId('seat-grid-redo').click();
		await expect
			.poll(async () => seat.evaluate((node) => (node as HTMLElement).offsetLeft), {
				timeout: 5_000
			})
			.toBeGreaterThan(homeLeft);

		await page.getByRole('button', { name: 'Save Changes' }).click();
		await expect(page.getByText('Seats updated successfully')).toBeVisible({ timeout: 15_000 });
		await expect(page.getByRole('button', { name: 'Save Changes' })).toBeEnabled({
			timeout: 15_000
		});

		const sectors = await api.get<
			Array<{
				id: string;
				metadata?: { rowLayout?: { seatNudges?: Array<Record<string, number>> } };
				seats?: Array<{ label: string; position?: { x: number; y: number } | null }>;
			}>
		>(`/api/organization-admin/${slug}/venues/${venueId}/sectors`);
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const saved = sectors.find((s) => s.id === sectorId)!;

		// ONE nudge, addressed by (row_order rank, adjacency_index) — never two.
		expect(saved.metadata?.rowLayout?.seatNudges).toEqual([{ row: 0, seat: 1, dx: 0.5 }]);
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const positions = new Map(saved.seats!.map((s) => [s.label, s.position]));
		// A2 sits half a seat right of its lattice slot; its neighbours did not move.
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		expect(positions.get('A2')!.x).toBeCloseTo(1.5, 5);
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		expect(positions.get('A1')!.x).toBeCloseTo(0, 5);
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		expect(positions.get('A3')!.x).toBeCloseTo(2, 5);

		// The recipe hydrates back into the inspector after a reload.
		await page.reload();
		await waitForClientAuth(page);
		await page.getByTestId('adjust-mode-toggle').click();
		await page.locator('[data-cell="0-1"]').click();
		await expect(page.getByLabel('Move sideways (seats)')).toHaveValue('0.5');

		await close();
	});

	test('adjust mode: drag a seat, and add one to a row', async ({ browser }) => {
		test.setTimeout(150_000);
		const { page, api, slug, venueId, sectorId, close } = await openSectorEditor(browser);

		await expect(page.getByTestId('adjust-mode-toggle')).toBeVisible({ timeout: 15_000 });
		await page.getByTestId('adjust-mode-toggle').click();

		// Drag B2 one full cell to the right (CELL_PX = 48). Scroll first:
		// `page.mouse` takes VIEWPORT coordinates, so a bounding box below the
		// fold would put the press somewhere else entirely.
		const seat = page.locator('[data-cell="1-1"]');
		await seat.scrollIntoViewIfNeeded();
		const box = await seat.boundingBox();
		if (!box) throw new Error('no seat box');
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
		await page.mouse.down();
		await page.mouse.move(box.x + box.width / 2 + 48, box.y + box.height / 2, { steps: 8 });
		await page.mouse.up();
		await expect(page.getByLabel('Move sideways (seats)')).toHaveValue('1');

		// A row's "+" appends a seat at its end — row C had C1..C5, so C6 appears.
		await page.getByLabel('Add a seat to row C').click();
		await expect(page.locator('[data-cell="2-5"]')).toHaveText('C6');

		await page.getByRole('button', { name: 'Save Changes' }).click();
		await expect(page.getByText('Seats updated successfully')).toBeVisible({ timeout: 15_000 });
		await expect(page.getByRole('button', { name: 'Save Changes' })).toBeEnabled({
			timeout: 15_000
		});

		const sectors = await api.get<
			Array<{
				id: string;
				metadata?: { rowLayout?: { seatNudges?: Array<Record<string, number>> } };
				seats?: Array<{ label: string; position?: { x: number; y: number } | null }>;
			}>
		>(`/api/organization-admin/${slug}/venues/${venueId}/sectors`);
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const saved = sectors.find((s) => s.id === sectorId)!;
		expect(saved.metadata?.rowLayout?.seatNudges).toEqual([{ row: 1, seat: 1, dx: 1 }]);
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const positions = new Map(saved.seats!.map((s) => [s.label, s.position]));
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		expect(positions.get('B2')!.x).toBeCloseTo(2, 5);
		// The appended seat persisted, at the end of its row.
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		expect(positions.get('C6')!.x).toBeCloseTo(5, 5);

		await close();
	});
});
