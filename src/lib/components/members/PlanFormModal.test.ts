import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import PlanFormModal from './PlanFormModal.svelte';

const orgConnected = { id: 'o1', slug: 'o', is_stripe_connected: true } as never;
const orgNotConnected = { id: 'o1', slug: 'o', is_stripe_connected: false } as never;

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
		render(PlanFormModal, {
			props: { plan: null, open: true, onClose: vi.fn(), onSave, organization: orgConnected }
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
