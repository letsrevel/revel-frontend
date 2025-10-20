import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import DateTimePicker from './DateTimePicker.svelte';

describe('DateTimePicker', () => {
	it('renders with label', () => {
		render(DateTimePicker, {
			props: {
				label: 'Event Start Time'
			}
		});

		expect(screen.getByLabelText('Event Start Time')).toBeInTheDocument();
	});

	it('shows required indicator when required', () => {
		render(DateTimePicker, {
			props: {
				label: 'Start Time',
				required: true
			}
		});

		const label = screen.getByText('Start Time').parentElement;
		expect(label?.textContent).toContain('*');
	});

	it('displays error message', () => {
		render(DateTimePicker, {
			props: {
				label: 'Start Time',
				error: 'Start time is required'
			}
		});

		expect(screen.getByRole('alert')).toHaveTextContent('Start time is required');
	});

	it('accepts initial value', () => {
		const initialValue = '2025-10-20T14:30:00';

		render(DateTimePicker, {
			props: {
				value: initialValue,
				label: 'Start Time'
			}
		});

		const input = screen.getByLabelText('Start Time') as HTMLInputElement;
		// Should be formatted to datetime-local format (without seconds)
		expect(input.value).toBe('2025-10-20T14:30');
	});

	it('calls onValueChange when value changes', async () => {
		const user = userEvent.setup();
		const handleChange = vi.fn();

		render(DateTimePicker, {
			props: {
				label: 'Start Time',
				onValueChange: handleChange
			}
		});

		const input = screen.getByLabelText('Start Time') as HTMLInputElement;
		await user.clear(input);
		await user.type(input, '2025-10-20T14:30');

		expect(handleChange).toHaveBeenCalled();
	});

	it('respects disabled state', () => {
		render(DateTimePicker, {
			props: {
				label: 'Start Time',
				disabled: true
			}
		});

		const input = screen.getByLabelText('Start Time') as HTMLInputElement;
		expect(input).toBeDisabled();
	});

	it('sets aria-invalid when error is present', () => {
		render(DateTimePicker, {
			props: {
				label: 'Start Time',
				error: 'Invalid date'
			}
		});

		const input = screen.getByLabelText('Start Time') as HTMLInputElement;
		expect(input).toHaveAttribute('aria-invalid', 'true');
	});

	it('supports min and max constraints', () => {
		const min = '2025-10-20T10:00:00';
		const max = '2025-10-20T18:00:00';

		render(DateTimePicker, {
			props: {
				label: 'Start Time',
				min,
				max
			}
		});

		const input = screen.getByLabelText('Start Time') as HTMLInputElement;
		expect(input.min).toBe('2025-10-20T10:00');
		expect(input.max).toBe('2025-10-20T18:00');
	});

	it('is keyboard accessible', () => {
		render(DateTimePicker, {
			props: {
				label: 'Start Time'
			}
		});

		const input = screen.getByLabelText('Start Time');
		expect(input).toBeInstanceOf(HTMLInputElement);
		expect(input.getAttribute('type')).toBe('datetime-local');
	});
});
