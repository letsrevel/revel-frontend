import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import RefundPolicyEditor from './RefundPolicyEditor.svelte';

/**
 * Regression cover for #935: the unit shown in a bracket's picker must be the
 * unit the typed number is interpreted in. Clearing the amount used to round-trip
 * the value through the parent as `0`, which made DurationInput re-pick the unit
 * (hours) while the label still read Days.
 */
describe('RefundPolicyEditor', () => {
	const hoursInput = (): HTMLInputElement =>
		screen.getByLabelText('Time before event') as HTMLInputElement;
	const unitTrigger = (): HTMLElement => screen.getByLabelText('Time before event unit');
	const summary = (): string | undefined => screen.getByRole('list').textContent?.trim();

	it('seeds a fresh bracket as 3 days', async () => {
		const user = userEvent.setup();
		render(RefundPolicyEditor, { props: { value: null, onChange: vi.fn() } });

		await user.click(screen.getByRole('button', { name: 'Add another bracket' }));

		expect(hoursInput().value).toBe('3');
		expect(unitTrigger()).toHaveTextContent('Days');
		expect(summary()).toBe('≥ 72h before → 100% refund');
	});

	it('interprets a retyped amount in the unit still shown in the picker (#935)', async () => {
		const user = userEvent.setup();
		const onChange = vi.fn();
		render(RefundPolicyEditor, { props: { value: null, onChange } });

		await user.click(screen.getByRole('button', { name: 'Add another bracket' }));
		await user.clear(hoursInput());

		// Clearing the amount must not rewrite the unit under the user.
		expect(unitTrigger()).toHaveTextContent('Days');

		await user.type(hoursInput(), '7');

		expect(unitTrigger()).toHaveTextContent('Days');
		expect(summary()).toBe('≥ 168h before → 100% refund');
		expect(onChange.mock.calls.at(-1)?.[0]).toEqual({
			tiers: [{ hours_before_event: 168, refund_percentage: '100' }]
		});
	});

	it('restores the committed amount when the field is emptied and abandoned', async () => {
		const user = userEvent.setup();
		render(RefundPolicyEditor, { props: { value: null, onChange: vi.fn() } });

		await user.click(screen.getByRole('button', { name: 'Add another bracket' }));
		await user.clear(hoursInput());
		await user.tab();

		// A bracket has no "empty" state — this editor passes no emptyValue — so an
		// emptied field is half-typed, not a request to save a 0-hour bracket.
		expect(hoursInput().value).toBe('3');
		expect(unitTrigger()).toHaveTextContent('Days');
		expect(summary()).toBe('≥ 72h before → 100% refund');
	});

	it('commits nothing on blur when the settled amount is already committed', async () => {
		const user = userEvent.setup();
		const onChange = vi.fn();
		render(RefundPolicyEditor, { props: { value: null, onChange } });

		await user.click(screen.getByRole('button', { name: 'Add another bracket' }));
		await user.clear(hoursInput());
		await user.type(hoursInput(), '3');

		// The edit landed back on the value already committed, so releasing the
		// buffer has nothing to write — writing it anyway marks the form dirty for
		// an edit that changed nothing.
		const before = onChange.mock.calls.length;
		await user.tab();

		expect(onChange.mock.calls.length).toBe(before);
	});

	it('keeps each bracket row with its own data when one is removed', async () => {
		const user = userEvent.setup();
		render(RefundPolicyEditor, {
			props: {
				value: {
					tiers: [
						{ hours_before_event: 72, refund_percentage: '100' },
						{ hours_before_event: 24, refund_percentage: '50' },
						{ hours_before_event: 12, refund_percentage: '25' }
					]
				},
				onChange: vi.fn()
			}
		});

		const rowText = () =>
			(screen.getAllByLabelText('Time before event') as HTMLInputElement[]).map(
				(input, i) =>
					`${input.value} ${screen.getAllByLabelText('Time before event unit')[i].textContent?.trim()}`
			);
		expect(rowText()).toEqual(['3 Days', '1 Days', '12 Hours']);

		await user.click(screen.getAllByRole('button', { name: 'Remove bracket' })[0]);

		expect(rowText()).toEqual(['1 Days', '12 Hours']);
	});

	it('renders an existing policy with the largest whole unit', () => {
		render(RefundPolicyEditor, {
			props: {
				value: { tiers: [{ hours_before_event: 168, refund_percentage: '50' }] },
				onChange: vi.fn()
			}
		});

		expect(hoursInput().value).toBe('1');
		expect(unitTrigger()).toHaveTextContent('Weeks');
	});
});
