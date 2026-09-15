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
	const hoursInput = () => screen.getByLabelText('Time before event') as HTMLInputElement;
	const unitTrigger = () => screen.getByLabelText('Time before event unit');
	const summary = () => screen.getByRole('list').textContent?.trim();

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

	it('shows a cleared-and-blurred amount as 0 in the unit on screen', async () => {
		const user = userEvent.setup();
		render(RefundPolicyEditor, { props: { value: null, onChange: vi.fn() } });

		await user.click(screen.getByRole('button', { name: 'Add another bracket' }));
		await user.clear(hoursInput());
		await user.tab();

		expect(hoursInput().value).toBe('0');
		expect(unitTrigger()).toHaveTextContent('Days');
		expect(summary()).toBe('≥ 0h before → 100% refund');
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
