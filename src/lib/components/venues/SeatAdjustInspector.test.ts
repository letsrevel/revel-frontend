import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import type { NudgePatch } from './seat-adjust-state.svelte';
import SeatAdjustInspector from './SeatAdjustInspector.svelte';

/**
 * The mode toggle and the "Add seat" sub-toggle live in `SeatSelectionActions`
 * now (see its own test file) — this component is the single-seat inspector
 * row only, and the caller (`SeatGridEditor`) mounts it exclusively when a
 * seat is selected. There is no "no selection" state to cover here.
 */
function harness(options: { nudge?: NudgePatch; selectedLabel?: string } = {}) {
	const onNudgeChange = vi.fn();
	const onResetSeat = vi.fn();
	const onRemoveSeat = vi.fn();
	const result = render(SeatAdjustInspector, {
		selectedLabel: options.selectedLabel ?? 'B3',
		nudge: options.nudge ?? null,
		onNudgeChange,
		onResetSeat,
		onRemoveSeat
	});
	return { onNudgeChange, onResetSeat, onRemoveSeat, ...result };
}

describe('SeatAdjustInspector', () => {
	it('names the selected seat and shows its stored nudge', () => {
		const { getByTestId, getByLabelText } = harness({ nudge: { dx: 1.5, dy: -0.5, rot: 45 } });
		expect(getByTestId('adjust-inspector-title').textContent).toContain('B3');
		expect((getByLabelText('Move sideways (seats)') as HTMLInputElement).value).toBe('1.5');
		expect((getByLabelText('Move back (rows)') as HTMLInputElement).value).toBe('-0.5');
		expect((getByLabelText('Rotation (degrees)') as HTMLInputElement).value).toBe('45');
	});

	it('shows zeros for a seat with no nudge at all', () => {
		const { getByLabelText } = harness();
		expect((getByLabelText('Move sideways (seats)') as HTMLInputElement).value).toBe('0');
		expect((getByLabelText('Rotation (degrees)') as HTMLInputElement).value).toBe('0');
	});

	it('writes each field independently as it is typed', async () => {
		const user = userEvent.setup();
		const { onNudgeChange, getByLabelText } = harness();
		await user.clear(getByLabelText('Move sideways (seats)'));
		await user.type(getByLabelText('Move sideways (seats)'), '2');
		expect(onNudgeChange).toHaveBeenLastCalledWith({ dx: 2 });

		await user.clear(getByLabelText('Rotation (degrees)'));
		await user.type(getByLabelText('Rotation (degrees)'), '90');
		expect(onNudgeChange).toHaveBeenLastCalledWith({ rot: 90 });
	});

	it('clamps an out-of-range typed offset at the input boundary', async () => {
		const user = userEvent.setup();
		const { onNudgeChange, getByLabelText } = harness();
		await user.clear(getByLabelText('Move back (rows)'));
		await user.type(getByLabelText('Move back (rows)'), '999');
		expect(onNudgeChange).toHaveBeenLastCalledWith({ dy: 20 });
	});

	it('reads an emptied field as zero rather than NaN', async () => {
		const user = userEvent.setup();
		const { onNudgeChange, getByLabelText } = harness({ nudge: { dx: 3 } });
		await user.clear(getByLabelText('Move sideways (seats)'));
		expect(onNudgeChange).toHaveBeenLastCalledWith({ dx: 0 });
	});

	it('describes the rotation contract without claiming it follows the stage', () => {
		const { getByLabelText, container } = harness();
		const describedBy = getByLabelText('Rotation (degrees)').getAttribute('aria-describedby');
		const help = container.querySelector(`#${describedBy}`)?.textContent;
		expect(help).toContain('0°');
		expect(help).toContain('clockwise');
		expect(help).toContain('does not follow the stage');
	});

	it('offers reset and remove for the selected seat', async () => {
		const user = userEvent.setup();
		const { onResetSeat, onRemoveSeat, getByRole } = harness();
		await user.click(getByRole('button', { name: 'Reset seat' }));
		expect(onResetSeat).toHaveBeenCalledTimes(1);
		await user.click(getByRole('button', { name: 'Remove seat' }));
		expect(onRemoveSeat).toHaveBeenCalledTimes(1);
	});

	it('says out loud that a seat cannot change row', () => {
		const { getByText } = harness();
		expect(getByText(/keeps its row/i)).toBeTruthy();
	});
});
