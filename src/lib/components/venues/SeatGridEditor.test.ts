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

function renderEditor(onPersist = vi.fn()) {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false, gcTime: 0 } }
	});
	render(QueryClientTestWrapper, {
		props: {
			client,
			component: SeatGridEditor,
			componentProps: {
				existingSeats: EXISTING,
				sectorMetadata: null,
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
