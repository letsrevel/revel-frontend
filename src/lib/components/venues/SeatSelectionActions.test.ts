import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { tick } from 'svelte';
import { SeatAdjustState } from './seat-adjust-state.svelte';
import SeatSelectionActions from './SeatSelectionActions.svelte';

function harness(options: { count?: number; canPaint?: boolean; adjust?: SeatAdjustState } = {}) {
	const adjust = options.adjust ?? new SeatAdjustState();
	const onToggleAccessible = vi.fn();
	const onToggleObstructed = vi.fn();
	const onPaint = vi.fn();
	const onDelete = vi.fn();
	const onClear = vi.fn();
	const result = render(SeatSelectionActions, {
		adjust,
		count: options.count ?? 0,
		canPaint: options.canPaint ?? false,
		onToggleAccessible,
		onToggleObstructed,
		onPaint,
		onDelete,
		onClear
	});
	return { adjust, onToggleAccessible, onToggleObstructed, onPaint, onDelete, onClear, ...result };
}

describe('SeatSelectionActions — the persistent toolbar', () => {
	it('always renders the adjust toggle, even with nothing selected', () => {
		const { getByTestId } = harness({ count: 0 });
		expect(getByTestId('adjust-mode-toggle')).toBeInTheDocument();
	});

	it('shows just the adjust toggle when idle (no selection, mode off)', () => {
		const { getByTestId, queryByText, queryByRole } = harness({ count: 0 });
		expect(getByTestId('adjust-mode-toggle')).toBeInTheDocument();
		expect(queryByText(/seats? selected/i)).toBeNull();
		expect(queryByRole('button', { name: 'Delete Selected' })).toBeNull();
	});

	it('flips the mode and announces it with aria-pressed', async () => {
		const user = userEvent.setup();
		const { adjust, getByTestId } = harness();
		const toggle = getByTestId('adjust-mode-toggle');
		expect(toggle).toHaveAttribute('aria-pressed', 'false');

		await user.click(toggle);
		expect(adjust.active).toBe(true);
		expect(getByTestId('adjust-mode-toggle')).toHaveAttribute('aria-pressed', 'true');
	});

	it('the adjust toggle comes before Toggle Accessible in DOM order', () => {
		const { getByTestId, getByRole } = harness({ count: 2 });
		const toggle = getByTestId('adjust-mode-toggle');
		const accessible = getByRole('button', { name: 'Toggle Accessible' });
		expect(
			toggle.compareDocumentPosition(accessible) & Node.DOCUMENT_POSITION_FOLLOWING
		).toBeTruthy();
	});

	it('shows the selection-dependent controls once a selection exists, mode off', () => {
		const { getByText, getByRole } = harness({ count: 3 });
		expect(getByText('3 seats selected')).toBeTruthy();
		expect(getByRole('button', { name: 'Toggle Accessible' })).toBeInTheDocument();
		expect(getByRole('button', { name: 'Toggle Obstructed' })).toBeInTheDocument();
		expect(getByRole('button', { name: 'Delete Selected' })).toBeInTheDocument();
		expect(getByRole('button', { name: 'Clear Selection' })).toBeInTheDocument();
	});

	it('shows the paint-apply button only when a paint chip is armed', async () => {
		const adjust = new SeatAdjustState();
		const onToggleAccessible = vi.fn();
		const onToggleObstructed = vi.fn();
		const onPaint = vi.fn();
		const onDelete = vi.fn();
		const onClear = vi.fn();
		const { queryByRole, rerender } = render(SeatSelectionActions, {
			adjust,
			count: 1,
			canPaint: false,
			onToggleAccessible,
			onToggleObstructed,
			onPaint,
			onDelete,
			onClear
		});
		expect(queryByRole('button', { name: 'Apply price to selected' })).toBeNull();

		await rerender({
			adjust,
			count: 1,
			canPaint: true,
			onToggleAccessible,
			onToggleObstructed,
			onPaint,
			onDelete,
			onClear
		});
		expect(queryByRole('button', { name: 'Apply price to selected' })).toBeInTheDocument();
	});

	it('hides the selection-dependent controls while adjust mode is on, even with a leftover selection', async () => {
		const adjust = new SeatAdjustState();
		const { queryByText, queryByRole } = harness({ count: 2, adjust });
		expect(queryByText('2 seats selected')).toBeTruthy();

		adjust.setActive(true);
		await tick();

		expect(queryByText(/seats? selected/i)).toBeNull();
		expect(queryByRole('button', { name: 'Delete Selected' })).toBeNull();
	});

	it('shows the "Add seat" sub-toggle only while adjust mode is on', async () => {
		const user = userEvent.setup();
		const { getByTestId, queryByTestId } = harness();
		expect(queryByTestId('adjust-add-seat-toggle')).toBeNull();

		await user.click(getByTestId('adjust-mode-toggle'));
		const addToggle = getByTestId('adjust-add-seat-toggle');
		expect(addToggle).toHaveAttribute('aria-pressed', 'false');

		await user.click(addToggle);
		expect(addToggle).toHaveAttribute('aria-pressed', 'true');
	});

	it('invokes the selection callbacks', async () => {
		const user = userEvent.setup();
		const { onToggleAccessible, onToggleObstructed, onDelete, onClear, getByRole } = harness({
			count: 1
		});
		await user.click(getByRole('button', { name: 'Toggle Accessible' }));
		expect(onToggleAccessible).toHaveBeenCalledTimes(1);
		await user.click(getByRole('button', { name: 'Toggle Obstructed' }));
		expect(onToggleObstructed).toHaveBeenCalledTimes(1);
		await user.click(getByRole('button', { name: 'Delete Selected' }));
		expect(onDelete).toHaveBeenCalledTimes(1);
		await user.click(getByRole('button', { name: 'Clear Selection' }));
		expect(onClear).toHaveBeenCalledTimes(1);
	});
});
