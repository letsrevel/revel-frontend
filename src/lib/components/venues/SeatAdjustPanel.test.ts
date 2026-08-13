import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { SeatAdjustState, type NudgePatch } from './seat-adjust-state.svelte';
import SeatAdjustPanel from './SeatAdjustPanel.svelte';

function harness(options: { active?: boolean; selected?: boolean; nudge?: NudgePatch } = {}) {
	const adjust = new SeatAdjustState();
	if (options.active ?? true) adjust.setActive(true);
	const onNudgeChange = vi.fn();
	const onResetSeat = vi.fn();
	const onRemoveSeat = vi.fn();
	const result = render(SeatAdjustPanel, {
		adjust,
		selectedLabel: (options.selected ?? true) ? 'B3' : null,
		nudge: options.nudge ?? null,
		onNudgeChange,
		onResetSeat,
		onRemoveSeat
	});
	return { adjust, onNudgeChange, onResetSeat, onRemoveSeat, ...result };
}

describe('SeatAdjustPanel — the mode toggle', () => {
	it('announces its state with aria-pressed and flips the mode', async () => {
		const user = userEvent.setup();
		const { adjust, getByTestId } = harness({ active: false });
		const toggle = getByTestId('adjust-mode-toggle');
		expect(toggle).toHaveAttribute('aria-pressed', 'false');

		await user.click(toggle);
		expect(adjust.active).toBe(true);
		expect(getByTestId('adjust-mode-toggle')).toHaveAttribute('aria-pressed', 'true');
	});

	it('hides the sub-controls and the inspector while the mode is off', () => {
		const { queryByTestId } = harness({ active: false });
		expect(queryByTestId('adjust-add-seat-toggle')).toBeNull();
		expect(queryByTestId('adjust-inspector-title')).toBeNull();
	});

	it('arms and disarms "add seat" without leaving the mode', async () => {
		const user = userEvent.setup();
		const { adjust, getByTestId } = harness();
		const addToggle = getByTestId('adjust-add-seat-toggle');
		expect(addToggle).toHaveAttribute('aria-pressed', 'false');

		await user.click(addToggle);
		expect(adjust.addArmed).toBe(true);
		await user.click(getByTestId('adjust-add-seat-toggle'));
		expect(adjust.addArmed).toBe(false);
		expect(adjust.active).toBe(true);
	});
});

describe('SeatAdjustPanel — the seat inspector', () => {
	it('prompts for a selection when there is none', () => {
		const { getByText, queryByTestId } = harness({ selected: false });
		expect(getByText('Select a seat on the grid to fine-tune it.')).toBeTruthy();
		expect(queryByTestId('adjust-inspector-title')).toBeNull();
	});

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

	it('describes which way the rotation points (0 = notch up, toward the stage side)', () => {
		const { getByLabelText, container } = harness();
		const describedBy = getByLabelText('Rotation (degrees)').getAttribute('aria-describedby');
		const help = container.querySelector(`#${describedBy}`)?.textContent;
		expect(help).toContain('0°');
		expect(help).toContain('clockwise');
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
