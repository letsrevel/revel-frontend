import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { tick } from 'svelte';
import { SeatAdjustState } from './seat-adjust-state.svelte';
import SeatSelectionActions from './SeatSelectionActions.svelte';

function harness(
	options: {
		count?: number;
		canPaint?: boolean;
		adjust?: SeatAdjustState;
		selectedLabel?: string | null;
		nudge?: { dx?: number; dy?: number; rot?: number } | null;
	} = {}
) {
	const adjust = options.adjust ?? new SeatAdjustState();
	const onToggleAccessible = vi.fn();
	const onToggleObstructed = vi.fn();
	const onPaint = vi.fn();
	const onDelete = vi.fn();
	const onClear = vi.fn();
	const onNudgeChange = vi.fn();
	const onResetSeat = vi.fn();
	const onRemoveSeat = vi.fn();
	const result = render(SeatSelectionActions, {
		adjust,
		count: options.count ?? 0,
		canPaint: options.canPaint ?? false,
		onToggleAccessible,
		onToggleObstructed,
		onPaint,
		onDelete,
		onClear,
		selectedLabel: options.selectedLabel ?? null,
		nudge: options.nudge ?? null,
		onNudgeChange,
		onResetSeat,
		onRemoveSeat
	});
	return {
		adjust,
		onToggleAccessible,
		onToggleObstructed,
		onPaint,
		onDelete,
		onClear,
		onNudgeChange,
		onResetSeat,
		onRemoveSeat,
		...result
	};
}

describe('SeatSelectionActions — the persistent, fixed-height toolbar', () => {
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

	it('renders a single top-level element — everything is ONE bar, never a second row', () => {
		const { container } = harness({
			adjust: (() => {
				const a = new SeatAdjustState();
				a.setActive(true);
				return a;
			})(),
			selectedLabel: 'B3'
		});
		// The component's whole output is one wrapper: toggle, add-seat toggle,
		// and the inline inspector all live inside it — no sibling card below.
		expect(container.children).toHaveLength(1);
	});

	it('pins a minimum height on the bar so no state can shrink it below the others', () => {
		const { container } = harness();
		expect(container.firstElementChild?.className).toMatch(/min-h-/);
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
		const onNudgeChange = vi.fn();
		const onResetSeat = vi.fn();
		const onRemoveSeat = vi.fn();
		const baseProps = {
			adjust,
			count: 1,
			onToggleAccessible,
			onToggleObstructed,
			onPaint,
			onDelete,
			onClear,
			selectedLabel: null,
			nudge: null,
			onNudgeChange,
			onResetSeat,
			onRemoveSeat
		};
		const { queryByRole, rerender } = render(SeatSelectionActions, {
			...baseProps,
			canPaint: false
		});
		expect(queryByRole('button', { name: 'Apply price to selected' })).toBeNull();

		await rerender({ ...baseProps, canPaint: true });
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

/** Adjust-mode-on state, so the inline inspector segment renders. */
function activeAdjust(): SeatAdjustState {
	const adjust = new SeatAdjustState();
	adjust.setActive(true);
	return adjust;
}

describe('SeatSelectionActions — the inline single-seat inspector', () => {
	it('does not render while nothing is selected, even in adjust mode', () => {
		const { queryByTestId } = harness({ adjust: activeAdjust(), selectedLabel: null });
		expect(queryByTestId('adjust-inspector-title')).toBeNull();
	});

	it('does not render outside adjust mode, even if a label is passed', () => {
		const { queryByTestId } = harness({ selectedLabel: 'B3' });
		expect(queryByTestId('adjust-inspector-title')).toBeNull();
	});

	it('names the selected seat and shows its stored nudge', () => {
		const { getByTestId, getByLabelText } = harness({
			adjust: activeAdjust(),
			selectedLabel: 'B3',
			nudge: { dx: 1.5, dy: -0.5, rot: 45 }
		});
		expect(getByTestId('adjust-inspector-title').textContent).toContain('B3');
		expect((getByLabelText('Move sideways (seats)') as HTMLInputElement).value).toBe('1.5');
		expect((getByLabelText('Move back (rows)') as HTMLInputElement).value).toBe('-0.5');
		expect((getByLabelText('Rotation (degrees)') as HTMLInputElement).value).toBe('45');
	});

	it('shows zeros for a seat with no nudge at all', () => {
		const { getByLabelText } = harness({ adjust: activeAdjust(), selectedLabel: 'B3' });
		expect((getByLabelText('Move sideways (seats)') as HTMLInputElement).value).toBe('0');
		expect((getByLabelText('Rotation (degrees)') as HTMLInputElement).value).toBe('0');
	});

	it('writes each field independently as it is typed', async () => {
		const user = userEvent.setup();
		const { onNudgeChange, getByLabelText } = harness({
			adjust: activeAdjust(),
			selectedLabel: 'B3'
		});
		await user.clear(getByLabelText('Move sideways (seats)'));
		await user.type(getByLabelText('Move sideways (seats)'), '2');
		expect(onNudgeChange).toHaveBeenLastCalledWith({ dx: 2 });

		await user.clear(getByLabelText('Rotation (degrees)'));
		await user.type(getByLabelText('Rotation (degrees)'), '90');
		expect(onNudgeChange).toHaveBeenLastCalledWith({ rot: 90 });
	});

	it('clamps an out-of-range typed offset at the input boundary', async () => {
		const user = userEvent.setup();
		const { onNudgeChange, getByLabelText } = harness({
			adjust: activeAdjust(),
			selectedLabel: 'B3'
		});
		await user.clear(getByLabelText('Move back (rows)'));
		await user.type(getByLabelText('Move back (rows)'), '999');
		expect(onNudgeChange).toHaveBeenLastCalledWith({ dy: 20 });
	});

	it('reads an emptied field as zero rather than NaN', async () => {
		const user = userEvent.setup();
		const { onNudgeChange, getByLabelText } = harness({
			adjust: activeAdjust(),
			selectedLabel: 'B3',
			nudge: { dx: 3 }
		});
		await user.clear(getByLabelText('Move sideways (seats)'));
		expect(onNudgeChange).toHaveBeenLastCalledWith({ dx: 0 });
	});

	it('describes the rotation contract for screen readers without a visible caption', () => {
		const { getByLabelText, container } = harness({
			adjust: activeAdjust(),
			selectedLabel: 'B3'
		});
		const rot = getByLabelText('Rotation (degrees)');
		const describedBy = rot.getAttribute('aria-describedby');
		const help = container.querySelector(`#${describedBy}`);
		expect(help?.textContent).toContain('0°');
		expect(help?.textContent).toContain('clockwise');
		expect(help?.textContent).toContain('does not follow the stage');
		// sr-only: present for AT, but must not add visible height to the bar.
		expect(help?.className).toContain('sr-only');
	});

	it('says out loud (for screen readers) that a seat cannot change row', () => {
		const { container } = harness({ adjust: activeAdjust(), selectedLabel: 'B3' });
		const note = [...container.querySelectorAll('.sr-only')].find((el) =>
			/keeps its row/i.test(el.textContent ?? '')
		);
		expect(note).toBeTruthy();
	});

	it('offers reset and remove for the selected seat', async () => {
		const user = userEvent.setup();
		const { onResetSeat, onRemoveSeat, getByRole } = harness({
			adjust: activeAdjust(),
			selectedLabel: 'B3'
		});
		await user.click(getByRole('button', { name: 'Reset seat' }));
		expect(onResetSeat).toHaveBeenCalledTimes(1);
		await user.click(getByRole('button', { name: 'Remove seat' }));
		expect(onRemoveSeat).toHaveBeenCalledTimes(1);
	});

	it('the inspector fields sit AFTER the adjust toggle in the same bar, not a separate element', () => {
		const { getByTestId, container } = harness({ adjust: activeAdjust(), selectedLabel: 'B3' });
		const toggle = getByTestId('adjust-mode-toggle');
		const title = getByTestId('adjust-inspector-title');
		expect(toggle.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
		// Same single top-level bar element contains both.
		expect(container.children).toHaveLength(1);
		expect(container.firstElementChild?.contains(toggle)).toBe(true);
		expect(container.firstElementChild?.contains(title)).toBe(true);
	});
});
