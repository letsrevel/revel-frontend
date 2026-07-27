import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import type { ComponentProps } from 'svelte';
import PlanFormModal from './PlanFormModal.svelte';
import { focusSettled } from '$lib/test-utils/focus';

const orgConnected = { id: 'o1', slug: 'o', is_stripe_connected: true } as never;
const orgNotConnected = { id: 'o1', slug: 'o', is_stripe_connected: false } as never;

/**
 * Render the modal and wait for bits-ui's dialog auto-focus to land (see
 * `focusSettled`). Losing that race leaves the `required` name field empty,
 * which makes jsdom skip form submission entirely: `onSave` is never called and
 * no script-side validation error renders — exactly how this file flaked.
 */
async function renderModal(props: ComponentProps<typeof PlanFormModal>) {
	const result = render(PlanFormModal, { props });
	await focusSettled();
	return result;
}

describe('PlanFormModal payment method', () => {
	it('disables the online option when the org has no Stripe account', () => {
		render(PlanFormModal, {
			props: {
				plan: null,
				open: true,
				onClose: vi.fn(),
				onSave: vi.fn(),
				organization: orgNotConnected
			}
		});
		const online = screen.getByRole('radio', { name: /online/i });
		expect(online).toBeDisabled();
	});

	it('submits payment_method, sales pause and cap on create', async () => {
		const user = userEvent.setup();
		const onSave = vi.fn();
		await renderModal({
			plan: null,
			open: true,
			onClose: vi.fn(),
			onSave,
			organization: orgConnected
		});
		await user.type(screen.getByLabelText(/name/i), 'Monthly');
		await user.click(screen.getByRole('radio', { name: /online/i }));
		await user.type(screen.getByLabelText(/maximum subscriptions/i), '20');
		await user.click(screen.getByRole('button', { name: /create/i }));
		expect(onSave).toHaveBeenCalledWith(
			expect.objectContaining({
				payment_method: 'online',
				max_subscriptions: 20,
				sales_status: 'open'
			})
		);
	});

	// Svelte writes `null` into a `type="number"` binding when the field is
	// cleared; `Number(null)` is 0, which would cap the plan at zero seats and
	// leave it permanently "sold out".
	it('sends max_subscriptions: null when the cap is typed then cleared', async () => {
		const user = userEvent.setup();
		const onSave = vi.fn();
		await renderModal({
			plan: null,
			open: true,
			onClose: vi.fn(),
			onSave,
			organization: orgConnected
		});
		await user.type(screen.getByLabelText(/name/i), 'Monthly');
		const cap = screen.getByLabelText(/maximum subscriptions/i);
		await user.type(cap, '20');
		await user.clear(cap);
		await user.click(screen.getByRole('button', { name: /create/i }));
		expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ max_subscriptions: null }));
	});

	// `min="1"` on the input is the first line of defence and stops this in a real
	// browser, so the attribute is dropped here to reach the script-side guard —
	// the one that still has to hold if the markup ever changes.
	it('rejects a cap of 0 instead of saving a sold-out plan', async () => {
		const user = userEvent.setup();
		const onSave = vi.fn();
		await renderModal({
			plan: null,
			open: true,
			onClose: vi.fn(),
			onSave,
			organization: orgConnected
		});
		await user.type(screen.getByLabelText(/name/i), 'Monthly');
		const cap = screen.getByLabelText(/maximum subscriptions/i);
		cap.removeAttribute('min');
		await user.type(cap, '0');
		await user.click(screen.getByRole('button', { name: /create/i }));
		expect(onSave).not.toHaveBeenCalled();
		expect(screen.getByText(/must be 1 or more/i)).toBeInTheDocument();
	});

	it('shows payment method as read-only when editing', () => {
		const plan = {
			id: 'p1',
			tier_id: 't1',
			tier_name: 'Gold',
			name: 'Monthly',
			price: '10.00',
			currency: 'EUR',
			period_unit: 'month',
			period_count: 1,
			is_active: true,
			payment_method: 'online',
			sales_status: 'open',
			max_subscriptions: null,
			active_subscription_count: 3,
			description: null
		} as never;
		render(PlanFormModal, {
			props: { plan, open: true, onClose: vi.fn(), onSave: vi.fn(), organization: orgConnected }
		});
		expect(screen.queryByRole('radio', { name: /online/i })).toBeNull();
		expect(screen.getByText(/archive and recreate/i)).toBeInTheDocument();
	});
});
