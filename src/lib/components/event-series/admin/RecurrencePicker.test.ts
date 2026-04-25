import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import RecurrencePicker from './RecurrencePicker.svelte';
import type { RecurrenceRuleCreate } from '$lib/types/recurrence';

type Rule = Partial<RecurrenceRuleCreate>;

function mount(initial: Rule = { frequency: 'weekly', interval: 1, weekdays: [] }) {
	const onChange = vi.fn();
	const { rerender } = render(RecurrencePicker, {
		props: { rule: initial, onChange }
	});
	return { onChange, rerender };
}

describe('RecurrencePicker — frequency segmented control', () => {
	it('renders all four frequency options', () => {
		mount();
		expect(screen.getByRole('radio', { name: 'Daily' })).toBeInTheDocument();
		expect(screen.getByRole('radio', { name: 'Weekly' })).toBeInTheDocument();
		expect(screen.getByRole('radio', { name: 'Monthly' })).toBeInTheDocument();
		expect(screen.getByRole('radio', { name: 'Yearly' })).toBeInTheDocument();
	});

	it('marks the current frequency as aria-checked', () => {
		mount({ frequency: 'monthly', interval: 1 });
		expect(screen.getByRole('radio', { name: 'Monthly' })).toHaveAttribute('aria-checked', 'true');
		expect(screen.getByRole('radio', { name: 'Weekly' })).toHaveAttribute('aria-checked', 'false');
	});

	it('clears conditional fields when switching frequency', async () => {
		const user = userEvent.setup();
		const { onChange } = mount({
			frequency: 'weekly',
			interval: 1,
			weekdays: [0, 2]
		});
		await user.click(screen.getByRole('radio', { name: 'Daily' }));
		const payload = onChange.mock.calls.at(-1)?.[0];
		expect(payload.frequency).toBe('daily');
		expect(payload.weekdays).toBeUndefined();
		expect(payload.monthly_type).toBeUndefined();
		expect(payload.day_of_month).toBeUndefined();
		expect(payload.nth_weekday).toBeUndefined();
		expect(payload.weekday).toBeUndefined();
	});

	it('presets monthly_type=day when switching to monthly', async () => {
		const user = userEvent.setup();
		const { onChange } = mount({ frequency: 'weekly', interval: 1 });
		await user.click(screen.getByRole('radio', { name: 'Monthly' }));
		expect(onChange.mock.calls.at(-1)?.[0]).toMatchObject({
			frequency: 'monthly',
			monthly_type: 'day'
		});
	});
});

describe('RecurrencePicker — weekly weekday multiselect', () => {
	it('renders 7 weekday toggles when frequency=weekly', () => {
		mount({ frequency: 'weekly', interval: 1 });
		expect(screen.getByRole('button', { name: 'Monday' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Sunday' })).toBeInTheDocument();
	});

	it('toggles a weekday on click and emits sorted weekdays', async () => {
		const user = userEvent.setup();
		const { onChange } = mount({ frequency: 'weekly', interval: 1, weekdays: [2] });
		await user.click(screen.getByRole('button', { name: 'Monday' })); // 0
		const emitted = onChange.mock.calls.at(-1)?.[0];
		expect(emitted.weekdays).toEqual([0, 2]);
	});

	it('deselects a weekday already in the set', async () => {
		const user = userEvent.setup();
		const { onChange } = mount({ frequency: 'weekly', interval: 1, weekdays: [0, 2] });
		await user.click(screen.getByRole('button', { name: 'Wednesday' })); // 2
		expect(onChange.mock.calls.at(-1)?.[0].weekdays).toEqual([0]);
	});

	it('sets aria-pressed on selected weekday toggles', () => {
		mount({ frequency: 'weekly', interval: 1, weekdays: [1, 3] });
		expect(screen.getByRole('button', { name: 'Tuesday' })).toHaveAttribute('aria-pressed', 'true');
		expect(screen.getByRole('button', { name: 'Monday' })).toHaveAttribute('aria-pressed', 'false');
	});
});

describe('RecurrencePicker — monthly sub-modes', () => {
	it('shows day-of-month input in day mode', () => {
		mount({ frequency: 'monthly', interval: 1, monthly_type: 'day' });
		expect(screen.getByLabelText('Day of month')).toBeInTheDocument();
	});

	it('shows ordinal + weekday selects in weekday mode', () => {
		mount({ frequency: 'monthly', interval: 1, monthly_type: 'weekday' });
		expect(screen.getByLabelText('Position')).toBeInTheDocument();
		expect(screen.getByLabelText('Weekday')).toBeInTheDocument();
	});

	it('clears day-mode fields when switching to weekday mode', async () => {
		const user = userEvent.setup();
		const { onChange } = mount({
			frequency: 'monthly',
			interval: 1,
			monthly_type: 'day',
			day_of_month: 15
		});
		await user.click(screen.getByRole('radio', { name: 'Nth weekday' }));
		const payload = onChange.mock.calls.at(-1)?.[0];
		expect(payload.monthly_type).toBe('weekday');
		expect(payload.day_of_month).toBeUndefined();
	});

	it('clamps day_of_month input to 1..31', async () => {
		const user = userEvent.setup();
		const { onChange } = mount({
			frequency: 'monthly',
			interval: 1,
			monthly_type: 'day'
		});
		const input = screen.getByLabelText('Day of month') as HTMLInputElement;
		await user.clear(input);
		await user.type(input, '99');
		// Every keystroke produces a patch; the final one should clamp to 31.
		const last = onChange.mock.calls.at(-1)?.[0];
		expect(last.day_of_month).toBe(31);
	});
});

describe('RecurrencePicker — boundary radios', () => {
	it('defaults to "none" when neither until nor count set', () => {
		mount({ frequency: 'daily', interval: 1 });
		// RadioGroup from bits-ui renders the items with name attribute
		const noneLabel = screen.getByText('Never');
		expect(noneLabel).toBeInTheDocument();
	});

	it('clears count when switching to until', async () => {
		const user = userEvent.setup();
		const { onChange } = mount({
			frequency: 'daily',
			interval: 1,
			count: 10
		});
		await user.click(screen.getByLabelText('On date'));
		const payload = onChange.mock.calls.at(-1)?.[0];
		expect(payload.count).toBeNull();
	});

	it('clears until when switching to count', async () => {
		const user = userEvent.setup();
		const { onChange } = mount({
			frequency: 'daily',
			interval: 1,
			until: '2027-01-01T00:00:00.000Z'
		});
		await user.click(screen.getByLabelText('After N occurrences'));
		const payload = onChange.mock.calls.at(-1)?.[0];
		expect(payload.until).toBeNull();
	});

	it('clears both when switching back to none', async () => {
		const user = userEvent.setup();
		const { onChange } = mount({
			frequency: 'daily',
			interval: 1,
			count: 10
		});
		await user.click(screen.getByLabelText('Never'));
		const payload = onChange.mock.calls.at(-1)?.[0];
		expect(payload.count).toBeNull();
		expect(payload.until).toBeNull();
	});
});

describe('RecurrencePicker — validation errors', () => {
	it('renders weekday validation message when provided', () => {
		render(RecurrencePicker, {
			props: {
				rule: { frequency: 'weekly', interval: 1, weekdays: [] },
				onChange: vi.fn(),
				validationErrors: { weekdays: 'Pick at least one weekday.' }
			}
		});
		expect(screen.getByText('Pick at least one weekday.')).toBeInTheDocument();
	});

	it('renders boundary mutex message when provided', () => {
		render(RecurrencePicker, {
			props: {
				rule: { frequency: 'daily', interval: 1 },
				onChange: vi.fn(),
				validationErrors: {
					boundary: 'Pick either an end date or a number of occurrences — not both.'
				}
			}
		});
		expect(
			screen.getByText('Pick either an end date or a number of occurrences — not both.')
		).toBeInTheDocument();
	});
});
