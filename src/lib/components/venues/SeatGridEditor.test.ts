import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { tick } from 'svelte';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import type { VenueSeatSchema } from '$lib/api/generated/types.gen';
import SeatGridEditor from './SeatGridEditor.svelte';

// The palette query is irrelevant here; keep it from touching the network.
vi.mock('$lib/stores/auth.svelte', () => ({ authStore: { accessToken: 'test-token' } }));
vi.mock('$lib/api/generated/sdk.gen', () => ({
	organizationadminvenuesListPriceCategories: vi.fn(async () => ({ data: [], error: undefined }))
}));

function seat(row: string, number: number): VenueSeatSchema {
	return {
		id: `${row}${number}`,
		label: `${row}${number}`,
		row,
		row_label: row,
		number,
		is_accessible: false,
		is_obstructed_view: false
	} as VenueSeatSchema;
}

/** A 2 x 3 seated sector — small enough to reason about, real enough to save. */
const EXISTING = ['A', 'B'].flatMap((row) => [1, 2, 3].map((n) => seat(row, n)));

function renderEditor(onPersist = vi.fn(), sectorMetadata: Record<string, unknown> | null = null) {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false, gcTime: 0 } }
	});
	render(QueryClientTestWrapper, {
		props: {
			client,
			component: SeatGridEditor,
			componentProps: {
				existingSeats: EXISTING,
				sectorMetadata,
				sectorShape: null,
				organizationSlug: 'org',
				venueId: 'venue-1',
				onPersist,
				isSaving: false
			}
		}
	});
	return { onPersist };
}

const cell = (key: string): HTMLElement => {
	const button = document.querySelector<HTMLElement>(`[data-cell="${key}"]`);
	if (!button) throw new Error(`no cell ${key}`);
	return button;
};

const savedRecipe = (onPersist: ReturnType<typeof vi.fn>) => {
	const [, metadata] = onPersist.mock.calls.at(-1) ?? [];
	return (metadata as { rowLayout?: { seatNudges?: unknown[] } } | undefined)?.rowLayout;
};

/** The legend's live seat count. */
function seatTally(): number {
	const total = document.querySelector('[data-testid="seat-grid-total"]');
	return Number(total?.textContent);
}

async function save(user: ReturnType<typeof userEvent.setup>) {
	await user.click(screen.getByRole('button', { name: 'Save Changes' }));
}

describe('SeatGridEditor — adjust mode end to end', () => {
	it('nudges the selected seat with the arrow keys and saves it as ONE nudge', async () => {
		const user = userEvent.setup();
		const { onPersist } = renderEditor();
		await tick();

		await user.click(screen.getByTestId('adjust-mode-toggle'));
		cell('0-1').focus();
		await user.keyboard('{ArrowRight}{ArrowRight}{ArrowDown}');
		await save(user);

		expect(savedRecipe(onPersist)).toMatchObject({
			seatNudges: [{ row: 0, seat: 1, dx: 0.2, dy: 0.1 }]
		});
	});

	it('the inspector edits the selected seat and reflects the stored value', async () => {
		const user = userEvent.setup();
		const { onPersist } = renderEditor();
		await tick();

		await user.click(screen.getByTestId('adjust-mode-toggle'));
		await user.click(cell('1-2'));
		expect(screen.getByTestId('adjust-inspector-title').textContent).toContain('B3');

		const dx = screen.getByLabelText('Move sideways (seats)') as HTMLInputElement;
		await user.clear(dx);
		await user.type(dx, '1.5');
		const rot = screen.getByLabelText('Rotation (degrees)') as HTMLInputElement;
		await user.clear(rot);
		await user.type(rot, '200');
		await tick();

		await save(user);
		// Rank 1 = row B; rotation normalized into [-180, 180).
		expect(savedRecipe(onPersist)).toMatchObject({
			seatNudges: [{ row: 1, seat: 2, dx: 1.5, rot: -160 }]
		});
	});

	it('"Reset seat" drops the nudge, and the recipe key disappears with it', async () => {
		const user = userEvent.setup();
		const { onPersist } = renderEditor();
		await tick();

		await user.click(screen.getByTestId('adjust-mode-toggle'));
		cell('0-0').focus();
		await user.keyboard('{ArrowRight}');
		await user.click(screen.getByRole('button', { name: 'Reset seat' }));
		await save(user);

		// A recipe with nothing but (now removed) nudges serializes to nothing.
		expect(savedRecipe(onPersist)).toBeUndefined();
	});

	it('"Remove seat" deletes the cell and clears the inspector', async () => {
		const user = userEvent.setup();
		renderEditor();
		await tick();
		expect(seatTally()).toBe(6);

		await user.click(screen.getByTestId('adjust-mode-toggle'));
		await user.click(cell('1-2'));
		await user.click(screen.getByRole('button', { name: 'Remove seat' }));
		await tick();

		expect(screen.queryByTestId('adjust-inspector-title')).toBeNull();
		expect(seatTally()).toBe(5);
		expect(cell('1-2').textContent?.trim()).toBe('');
	});

	it('the per-row "+" appends a seat at that row’s end', async () => {
		const user = userEvent.setup();
		renderEditor();
		await tick();

		await user.click(screen.getByLabelText('Add a seat to row A'));
		await tick();
		// Row A held A1..A3, so the new seat is A4.
		expect(cell('0-3').textContent?.trim()).toBe('A4');
		expect(seatTally()).toBe(7);
		// The row "+" works outside adjust mode too, and does NOT open the
		// inspector there (that panel only exists while the mode is on).
		expect(screen.queryByTestId('adjust-inspector-title')).toBeNull();
	});

	it('adding a seat inside adjust mode selects it for the inspector', async () => {
		const user = userEvent.setup();
		renderEditor();
		await tick();

		await user.click(screen.getByTestId('adjust-mode-toggle'));
		await user.click(screen.getByLabelText('Add a seat to row B'));
		await tick();
		expect(screen.getByTestId('adjust-inspector-title').textContent).toContain('B4');
	});

	it('appending past the last column grows the grid by one column', async () => {
		const user = userEvent.setup();
		renderEditor();
		await tick();
		const columns = screen.getByLabelText('Columns') as HTMLInputElement;
		await user.clear(columns);
		await user.type(columns, '3');
		await tick();
		expect(document.querySelectorAll('[data-cell="0-3"]')).toHaveLength(0);

		await user.click(screen.getByLabelText('Add a seat to row A'));
		await tick();
		expect(columns.value).toBe('4');
		expect(cell('0-3').textContent?.trim()).toBe('A4');
	});

	it('"add anywhere" drops the seat into the nearest row, where it was clicked', async () => {
		const user = userEvent.setup();
		const { onPersist } = renderEditor();
		await tick();

		await user.click(screen.getByTestId('adjust-mode-toggle'));
		await user.click(screen.getByTestId('adjust-add-seat-toggle'));
		await tick();
		await user.click(screen.getByTestId('seat-grid-add-anywhere'));
		await tick();

		// jsdom has no layout, so the click resolves to the canvas origin — row A.
		// What matters is that a seat was appended to a real row and carries a
		// nudge that moves it off its lattice slot.
		expect(seatTally()).toBe(7);
		await save(user);
		const recipe = savedRecipe(onPersist) as { seatNudges: Array<{ row: number; seat: number }> };
		expect(recipe.seatNudges).toHaveLength(1);
		expect(recipe.seatNudges[0]).toMatchObject({ row: 0, seat: 3 });
	});
});

describe('SeatGridEditor — undo/redo', () => {
	it('starts with both actions disabled', async () => {
		renderEditor();
		await tick();
		expect(screen.getByTestId('seat-grid-undo')).toBeDisabled();
		expect(screen.getByTestId('seat-grid-redo')).toBeDisabled();
	});

	it('undo restores a toggled-off cell, and redo removes it again', async () => {
		const user = userEvent.setup();
		renderEditor();
		await tick();

		// Normal mode: clicking a seat selects it; clicking an EMPTY cell adds one.
		await user.click(cell('0-4'));
		await tick();
		expect(screen.getByTestId('seat-grid-undo')).toBeEnabled();

		await user.click(screen.getByTestId('seat-grid-undo'));
		await tick();
		expect(cell('0-4').textContent?.trim()).toBe('');

		await user.click(screen.getByTestId('seat-grid-redo'));
		await tick();
		expect(cell('0-4').textContent?.trim()).toBe('A5');
	});

	it('undo restores a NUDGE, putting the seat back on its lattice position', async () => {
		const user = userEvent.setup();
		const { onPersist } = renderEditor();
		await tick();

		await user.click(screen.getByTestId('adjust-mode-toggle'));
		cell('0-1').focus();
		const home = cell('0-1').style.left;
		await user.keyboard('{Shift>}{ArrowRight}{/Shift}');
		await tick();
		expect(cell('0-1').style.left).not.toBe(home);

		await user.click(screen.getByTestId('seat-grid-undo'));
		await tick();
		expect(cell('0-1').style.left).toBe(home);

		await save(user);
		expect(savedRecipe(onPersist)).toBeUndefined();
	});

	it('Cmd+Z undoes, Cmd+Shift+Z redoes, from anywhere in the editor', async () => {
		const user = userEvent.setup();
		renderEditor();
		await tick();

		await user.click(cell('0-4'));
		await tick();
		await user.keyboard('{Meta>}z{/Meta}');
		await tick();
		expect(cell('0-4').textContent?.trim()).toBe('');

		await user.keyboard('{Meta>}{Shift>}z{/Shift}{/Meta}');
		await tick();
		expect(cell('0-4').textContent?.trim()).toBe('A5');
	});

	it('leaves Cmd+Z alone while a form field has focus (native text undo)', async () => {
		const user = userEvent.setup();
		renderEditor();
		await tick();

		await user.click(cell('0-4'));
		await tick();
		const rows = screen.getByLabelText('Rows');
		rows.focus();
		await user.keyboard('{Meta>}z{/Meta}');
		await tick();

		// The seat is still there: the editor kept its hands off the keystroke.
		expect(cell('0-4').textContent?.trim()).toBe('A5');
	});
});

describe('SeatGridEditor — a removed seat leaves no nudge behind', () => {
	it('"Remove seat" forgets the nudge, so a seat added back starts at home', async () => {
		const user = userEvent.setup();
		const { onPersist } = renderEditor();
		await tick();

		await user.click(screen.getByTestId('adjust-mode-toggle'));
		cell('0-2').focus();
		await user.keyboard('{Shift>}{ArrowRight}{ArrowRight}{/Shift}');
		await tick();
		const nudged = cell('0-2').style.left;

		await user.click(cell('0-2'));
		await user.click(screen.getByRole('button', { name: 'Remove seat' }));
		await tick();

		// Add it straight back at the same address: it must land on the lattice,
		// not two half-pitches to the right of it.
		await user.click(screen.getByLabelText('Add a seat to row A'));
		await tick();
		expect(cell('0-2').textContent?.trim()).toBe('A3');
		expect(cell('0-2').style.left).not.toBe(nudged);

		await save(user);
		expect(savedRecipe(onPersist)).toBeUndefined();
	});

	it('"Delete Selected" forgets the nudges of every seat it removes', async () => {
		const user = userEvent.setup();
		const { onPersist } = renderEditor();
		await tick();

		await user.click(screen.getByTestId('adjust-mode-toggle'));
		cell('1-1').focus();
		await user.keyboard('{ArrowDown}');
		await tick();

		// Back to normal mode to use the bulk selection actions.
		await user.click(screen.getByTestId('adjust-mode-toggle'));
		await user.click(cell('1-1'));
		await user.click(screen.getByRole('button', { name: 'Delete Selected' }));
		await tick();
		await save(user);

		expect(savedRecipe(onPersist)).toBeUndefined();
	});

	it('regenerating the grid drops every nudge with it', async () => {
		const user = userEvent.setup();
		const { onPersist } = renderEditor();
		await tick();

		await user.click(screen.getByTestId('adjust-mode-toggle'));
		cell('0-0').focus();
		await user.keyboard('{ArrowRight}');
		await tick();

		await user.click(screen.getByRole('button', { name: 'Empty Grid' }));
		await tick();
		await user.click(screen.getByRole('button', { name: 'Fill All' }));
		await tick();
		await save(user);

		expect(savedRecipe(onPersist)).toBeUndefined();
	});

	it('an add-anywhere drop is measured from the seat’s LATTICE home', async () => {
		const user = userEvent.setup();
		const { onPersist } = renderEditor();
		await tick();

		await user.click(screen.getByTestId('adjust-mode-toggle'));
		// Push A4 far to the right, then delete it — the classic resurrection trap.
		await user.click(screen.getByLabelText('Add a seat to row A'));
		await tick();
		cell('0-3').focus();
		await user.keyboard('{Shift>}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{/Shift}');
		await user.click(screen.getByRole('button', { name: 'Remove seat' }));
		await tick();

		// Drop a new seat at the same address via add-anywhere. jsdom has no
		// layout, so the click resolves to the canvas origin: the nudge must be
		// the (negative) delta from A4's own home — not that minus a stale +2.
		await user.click(screen.getByTestId('adjust-add-seat-toggle'));
		await user.click(screen.getByTestId('seat-grid-add-anywhere'));
		await tick();
		await save(user);

		const recipe = savedRecipe(onPersist) as { seatNudges: Array<{ dx?: number }> };
		expect(recipe.seatNudges).toHaveLength(1);
		// A4's home is x = 3; the click resolved to x = -0.5, so dx = -3.5. A
		// leftover +2 would have made it -5.5.
		expect(recipe.seatNudges[0].dx).toBeCloseTo(-3.5, 5);
	});
});

describe('SeatGridEditor — row order flips the rank space, not the room', () => {
	it('a nudged seat keeps its delta when the row order is inverted', async () => {
		const user = userEvent.setup();
		const { onPersist } = renderEditor();
		await tick();

		await user.click(screen.getByTestId('adjust-mode-toggle'));
		cell('1-0').focus();
		await user.keyboard('{Shift>}{ArrowRight}{/Shift}');
		await tick();
		const nudgedLeft = cell('1-0').style.left;
		const neighbourLeft = cell('0-0').style.left;

		const rowOrder = screen.getByLabelText('Row Order');
		await user.selectOptions(rowOrder, 'bottom');
		await tick();

		// Same physical seat, same physical position — inverting relabels, it
		// does not move the room.
		expect(cell('1-0').style.left).toBe(nudgedLeft);
		expect(cell('0-0').style.left).toBe(neighbourLeft);

		await save(user);
		// …and the recipe now addresses that seat by its NEW rank (row B was
		// rank 1 of 2 rows, and is rank 0 once the order is inverted).
		expect(savedRecipe(onPersist)).toMatchObject({
			seatNudges: [{ row: 0, seat: 0, dx: 0.5 }]
		});
	});

	it('undo after an inversion restores the recipe exactly once', async () => {
		const user = userEvent.setup();
		const { onPersist } = renderEditor();
		await tick();

		await user.click(screen.getByTestId('adjust-mode-toggle'));
		cell('1-0').focus();
		await user.keyboard('{Shift>}{ArrowRight}{/Shift}');
		await tick();

		await user.selectOptions(screen.getByLabelText('Row Order'), 'bottom');
		await tick();
		await user.click(screen.getByTestId('seat-grid-undo'));
		await tick();
		await save(user);

		// Back to the pre-inversion state: rank 1, not mirrored twice.
		expect(savedRecipe(onPersist)).toMatchObject({
			seatNudges: [{ row: 1, seat: 0, dx: 0.5 }]
		});
	});
});

// The buyer never receives the rowLayout recipe, so a save mirrors its
// rotations into `metadata.seatRotations`, keyed by SEAT LABEL. The mirror is
// sparse: nothing rotated ⇒ `null` ⇒ the page REMOVES the key.
describe('SeatGridEditor — buyer-facing rotation mirror', () => {
	const savedRotations = (onPersist: ReturnType<typeof vi.fn>) => {
		const [, metadata] = onPersist.mock.calls.at(-1) ?? [];
		return (metadata as { seatRotations?: Record<string, number> | null } | undefined)
			?.seatRotations;
	};

	async function rotateSelected(user: ReturnType<typeof userEvent.setup>, degrees: string) {
		const rot = screen.getByLabelText('Rotation (degrees)') as HTMLInputElement;
		await user.clear(rot);
		await user.type(rot, degrees);
		await tick();
	}

	it('mirrors a rotated seat under its LABEL while the recipe keeps the rank', async () => {
		const user = userEvent.setup();
		const { onPersist } = renderEditor();
		await tick();

		await user.click(screen.getByTestId('adjust-mode-toggle'));
		await user.click(cell('1-2'));
		await rotateSelected(user, '30');
		await save(user);

		// Recipe: rank 1 (row B), adjacency 2. Mirror: the seat's label.
		expect(savedRecipe(onPersist)).toMatchObject({ seatNudges: [{ row: 1, seat: 2, rot: 30 }] });
		expect(savedRotations(onPersist)).toEqual({ B3: 30 });
	});

	it('resolves rank-addressed nudges to the right label under an inverted row order', async () => {
		const user = userEvent.setup();
		const { onPersist } = renderEditor();
		await tick();

		await user.click(screen.getByTestId('adjust-mode-toggle'));
		await user.click(cell('0-0'));
		await rotateSelected(user, '45');
		await user.selectOptions(screen.getByLabelText('Row Order'), 'bottom');
		await tick();
		await save(user);

		// Row A is rank 1 once inverted — and it is STILL seat A1 that turned.
		expect(savedRecipe(onPersist)).toMatchObject({ seatNudges: [{ row: 1, seat: 0, rot: 45 }] });
		expect(savedRotations(onPersist)).toEqual({ A1: 45 });
	});

	it('normalizes the mirrored angle exactly like the recipe does', async () => {
		const user = userEvent.setup();
		const { onPersist } = renderEditor();
		await tick();

		await user.click(screen.getByTestId('adjust-mode-toggle'));
		await user.click(cell('0-1'));
		await rotateSelected(user, '200');
		await save(user);

		expect(savedRecipe(onPersist)).toMatchObject({ seatNudges: [{ row: 0, seat: 1, rot: -160 }] });
		expect(savedRotations(onPersist)).toEqual({ A2: -160 });
	});

	it('skips seats nudged without rotation, and removes the key when none is rotated', async () => {
		const user = userEvent.setup();
		const { onPersist } = renderEditor();
		await tick();

		await user.click(screen.getByTestId('adjust-mode-toggle'));
		cell('0-1').focus();
		await user.keyboard('{ArrowRight}');
		await save(user);

		// A position nudge is not a rotation: the recipe carries it, the mirror
		// stays empty and the key is removed (`null`).
		expect(savedRecipe(onPersist)).toMatchObject({ seatNudges: [{ row: 0, seat: 1, dx: 0.1 }] });
		expect(savedRotations(onPersist)).toBeNull();
	});

	it('drops the mirror entry again when the rotation is zeroed', async () => {
		const user = userEvent.setup();
		const { onPersist } = renderEditor();
		await tick();

		await user.click(screen.getByTestId('adjust-mode-toggle'));
		await user.click(cell('1-1'));
		await rotateSelected(user, '90');
		await save(user);
		expect(savedRotations(onPersist)).toEqual({ B2: 90 });

		await user.clear(screen.getByLabelText('Rotation (degrees)'));
		await tick();
		await save(user);
		expect(savedRotations(onPersist)).toBeNull();
	});

	it('drops the mirror entry when the rotated seat is removed', async () => {
		const user = userEvent.setup();
		const { onPersist } = renderEditor();
		await tick();

		await user.click(screen.getByTestId('adjust-mode-toggle'));
		await user.click(cell('1-1'));
		await rotateSelected(user, '90');
		await user.click(screen.getByRole('button', { name: 'Remove seat' }));
		await save(user);

		expect(savedRotations(onPersist)).toBeNull();
	});

	it('a plain grid saves no mirror at all', async () => {
		const user = userEvent.setup();
		const { onPersist } = renderEditor();
		await tick();

		await save(user);
		expect(savedRecipe(onPersist)).toBeUndefined();
		expect(savedRotations(onPersist)).toBeNull();
	});

	it('leaves the stored mirror ALONE when an unreadable recipe rides through untouched', async () => {
		const user = userEvent.setup();
		const onPersist = vi.fn();
		renderEditor(onPersist, {
			// A newer build's recipe this one cannot parse: it is written back
			// verbatim, so its mirror — which we cannot re-derive — must not be
			// touched either (the key is OMITTED, not null).
			rowLayout: { version: 99, kind: 'rows', futureKnob: 3 },
			seatRotations: { A1: 90 }
		});
		await tick();

		await save(user);
		const [, metadata] = onPersist.mock.calls.at(-1) ?? [];
		expect(metadata as Record<string, unknown>).toMatchObject({
			rowLayout: { version: 99, kind: 'rows', futureKnob: 3 }
		});
		expect('seatRotations' in (metadata as Record<string, unknown>)).toBe(false);
	});
});
