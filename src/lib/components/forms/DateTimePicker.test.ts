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

	it('confirms the value and prevents form submission on Enter (#446)', () => {
		render(DateTimePicker, {
			props: {
				label: 'Start Time'
			}
		});

		const input = screen.getByLabelText('Start Time') as HTMLInputElement;
		input.focus();
		expect(document.activeElement).toBe(input);

		const event = new KeyboardEvent('keydown', {
			key: 'Enter',
			bubbles: true,
			cancelable: true
		});
		// dispatchEvent returns false when a handler called preventDefault on a cancelable event.
		const notPrevented = input.dispatchEvent(event);

		expect(notPrevented).toBe(false); // Enter was intercepted (no implicit form submit)
		expect(document.activeElement).not.toBe(input); // field was blurred (value committed)
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

	it('shows an unambiguous textual readback of the selected value (#508)', () => {
		render(DateTimePicker, {
			props: { label: 'Start Time', value: '2025-10-20T14:30:00' }
		});
		const readback = screen.getByText(/Oct 20, 2025/);
		expect(readback).toBeInTheDocument();
		expect(readback.textContent).not.toMatch(/10\/20/); // never numeric month/day
	});

	it('renders no readback when no value is selected (#508)', () => {
		render(DateTimePicker, { props: { label: 'Start Time' } });
		expect(screen.queryByText(/Selected:/)).not.toBeInTheDocument();
	});
});
