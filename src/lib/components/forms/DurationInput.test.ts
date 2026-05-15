import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import userEvent from '@testing-library/user-event';
import DurationInput from './DurationInput.svelte';

/**
 * Notes on testing strategy:
 *
 * - Always pass `id` to get a stable, deterministic input ID. Without it, the
 *   component generates a random ID (`duration-<random>`), which breaks
 *   `getByLabelText` (label's `for` won't match the input `id`).
 *
 * - Binding tests (typing → stored value, chip click → null) are verified
 *   through the DOM: we assert the visible `input.value` after user actions.
 *   The conversion correctness (toStorage/fromStorage) is covered by the
 *   dedicated unit-test suite (Task 2). Here we only verify component wiring.
 *
 * - The Select trigger rendered by shadcn-svelte/bits-ui also has role="button"
 *   in some environments, so chip queries use `{ name: 'No limit' }` to stay
 *   specific.
 */

describe('DurationInput', () => {
	// ─── 1. Renders label and number input ───────────────────────────────────
	it('renders label and number input', () => {
		render(DurationInput, {
			props: {
				id: 'dur-1',
				value: null,
				storageUnit: 'days',
				defaultUnit: 'days',
				label: 'Validity'
			}
		});
		expect(screen.getByLabelText('Validity')).toBeInTheDocument();
	});

	// ─── 2. Chip visible when emptyLabel + emptyValue are both provided ───────
	it('renders chip when emptyLabel and emptyValue are both provided', () => {
		render(DurationInput, {
			props: {
				id: 'dur-2',
				value: null,
				storageUnit: 'days',
				defaultUnit: 'days',
				emptyValue: null,
				emptyLabel: 'No limit',
				label: 'Validity'
			}
		});
		expect(screen.getByRole('button', { name: 'No limit' })).toBeInTheDocument();
	});

	// ─── 3. Chip hidden when emptyLabel is omitted ───────────────────────────
	it('does NOT render chip when emptyLabel is omitted', () => {
		render(DurationInput, {
			props: {
				id: 'dur-3',
				value: 24,
				storageUnit: 'hours',
				defaultUnit: 'days',
				label: 'Hours before event'
			}
		});
		expect(screen.queryByRole('button', { name: /no limit/i })).not.toBeInTheDocument();
	});

	// ─── 4. fromStorage: picks largest whole unit (24 h → 1 day) ─────────────
	it('displays largest whole unit on load (24 hours → 1 day)', () => {
		render(DurationInput, {
			props: {
				id: 'dur-4',
				value: 24,
				storageUnit: 'hours',
				defaultUnit: 'hours',
				label: 'Cancel deadline'
			}
		});
		const input = screen.getByLabelText('Cancel deadline') as HTMLInputElement;
		expect(input.value).toBe('1');
	});

	// ─── 5. fromStorage: falls back when no larger unit divides evenly ────────
	it('keeps fractional storage as smaller unit (60 hours → 60 hours)', () => {
		render(DurationInput, {
			props: {
				id: 'dur-5',
				value: 60,
				storageUnit: 'hours',
				defaultUnit: 'days',
				label: 'Cancel deadline'
			}
		});
		const input = screen.getByLabelText('Cancel deadline') as HTMLInputElement;
		expect(input.value).toBe('60');
	});

	// ─── 6. Typing a number updates the displayed value ──────────────────────
	it('typing a number into the input updates the displayed value', async () => {
		const user = userEvent.setup();
		render(DurationInput, {
			props: {
				id: 'dur-6',
				value: null,
				storageUnit: 'days',
				defaultUnit: 'days',
				label: 'Validity'
			}
		});
		const input = screen.getByLabelText('Validity') as HTMLInputElement;
		await user.clear(input);
		await user.type(input, '7');
		expect(input.value).toBe('7');
	});

	// ─── 7. Clearing the number input resets display to empty ────────────────
	it('clearing the number input empties the displayed value', async () => {
		const user = userEvent.setup();
		render(DurationInput, {
			props: {
				id: 'dur-7',
				value: 7,
				storageUnit: 'days',
				defaultUnit: 'days',
				label: 'Validity'
			}
		});
		const input = screen.getByLabelText('Validity') as HTMLInputElement;
		await user.clear(input);
		expect(input.value).toBe('');
	});

	// ─── 8. Chip click clears the displayed value ─────────────────────────────
	it('clicking the chip clears the input', async () => {
		const user = userEvent.setup();
		// Use value=5 with storageUnit='days': fromStorage(5, 'days') → {amount:5, unit:'days'}
		// (5 days does not divide evenly into weeks/months/years, so it stays as days).
		render(DurationInput, {
			props: {
				id: 'dur-8',
				value: 5,
				storageUnit: 'days',
				defaultUnit: 'days',
				emptyValue: null,
				emptyLabel: 'No limit',
				label: 'Validity'
			}
		});
		const input = screen.getByLabelText('Validity') as HTMLInputElement;
		expect(input.value).toBe('5');

		const chip = screen.getByRole('button', { name: 'No limit' });
		await user.click(chip);

		expect(input.value).toBe('');
	});

	// ─── 9. Chip aria-pressed reflects empty state ────────────────────────────
	it('chip aria-pressed is true when value is empty (null)', () => {
		render(DurationInput, {
			props: {
				id: 'dur-9a',
				value: null,
				storageUnit: 'days',
				defaultUnit: 'days',
				emptyValue: null,
				emptyLabel: 'No limit',
				label: 'Validity'
			}
		});
		expect(screen.getByRole('button', { name: 'No limit' })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
	});

	it('chip aria-pressed is false when value is set', () => {
		render(DurationInput, {
			props: {
				id: 'dur-9b',
				value: 7,
				storageUnit: 'days',
				defaultUnit: 'days',
				emptyValue: null,
				emptyLabel: 'No limit',
				label: 'Validity'
			}
		});
		expect(screen.getByRole('button', { name: 'No limit' })).toHaveAttribute(
			'aria-pressed',
			'false'
		);
	});

	// ─── 10. disabled prop disables both inner controls and the chip ──────────
	it('disabled prop disables both the number input and the chip', () => {
		render(DurationInput, {
			props: {
				id: 'dur-10',
				value: 7,
				storageUnit: 'days',
				defaultUnit: 'days',
				emptyValue: null,
				emptyLabel: 'No limit',
				label: 'Validity',
				disabled: true
			}
		});
		expect(screen.getByLabelText('Validity')).toBeDisabled();
		expect(screen.getByRole('button', { name: 'No limit' })).toBeDisabled();
	});

	// ─── Bonus: helpText renders ──────────────────────────────────────────────
	it('renders helpText when provided', () => {
		render(DurationInput, {
			props: {
				id: 'dur-11',
				value: null,
				storageUnit: 'days',
				defaultUnit: 'days',
				label: 'Validity',
				helpText: 'How long the ticket is valid after purchase'
			}
		});
		expect(screen.getByText('How long the ticket is valid after purchase')).toBeInTheDocument();
	});

	// ─── Bonus: required indicator ────────────────────────────────────────────
	it('shows required indicator when required is true', () => {
		render(DurationInput, {
			props: {
				id: 'dur-12',
				value: null,
				storageUnit: 'days',
				defaultUnit: 'days',
				label: 'Validity',
				required: true
			}
		});
		// The asterisk is rendered inside the label wrapper
		const label = screen.getByText('Validity').closest('label');
		expect(label?.textContent).toContain('*');
	});
});
