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

/** Replace the price the form starts at (`0.00`) with `value`. */
async function setPrice(user: ReturnType<typeof userEvent.setup>, value: string): Promise<void> {
	const price = screen.getByLabelText(/^price$/i);
	await user.clear(price);
	await user.type(price, value);
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
		// An online plan may not be priced 0 (`validate_plan_shape`), and the form
		// starts at 0.00 — so a real price is part of the minimum valid input.
		await setPrice(user, '10');
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

/**
 * The three shape rules `events.utils.subscription_plan_rules.validate_plan_shape`
 * enforces: FREE ⇒ price 0 AND lifetime; ONLINE ⇒ price > 0 AND not lifetime;
 * OFFLINE ⇒ anything. The form has to make the invalid combinations unreachable
 * *and* refuse them if they are reached anyway — a form that submits something
 * the backend can only 400 is a form that lies about what it accepts.
 */
describe('PlanFormModal free and lifetime plans', () => {
	function makeFreePlan(overrides: Record<string, unknown> = {}) {
		return {
			id: 'p1',
			tier_id: 't1',
			tier_name: 'Gold',
			name: 'Supporter',
			price: '0.00',
			currency: 'EUR',
			period_unit: 'lifetime',
			period_count: 1,
			is_active: true,
			payment_method: 'free',
			sales_status: 'open',
			max_subscriptions: null,
			active_subscription_count: 0,
			description: null,
			...overrides
		} as never;
	}

	// A FREE plan needs no Stripe account: there is no product, price or session.
	it('offers Free even when the organization has no Stripe account', () => {
		render(PlanFormModal, {
			props: {
				plan: null,
				open: true,
				onClose: vi.fn(),
				onSave: vi.fn(),
				organization: orgNotConnected
			}
		});
		expect(screen.getByRole('radio', { name: /free/i })).toBeEnabled();
	});

	it('locks price and period to 0/lifetime when Free is chosen, and says why', async () => {
		const user = userEvent.setup();
		await renderModal({
			plan: null,
			open: true,
			onClose: vi.fn(),
			onSave: vi.fn(),
			organization: orgConnected
		});

		await user.click(screen.getByRole('radio', { name: /free/i }));

		const price = screen.getByLabelText(/^price$/i);
		const period = screen.getByLabelText(/^period$/i);
		expect(price).toBeDisabled();
		expect(price).toHaveValue(0);
		expect(period).toBeDisabled();
		expect(period).toHaveValue('lifetime');
		// The reason a disabled control is disabled has to reach a screen reader,
		// not just the greyed-out pixels.
		const explanation = screen.getByText(/always priced 0 and always last a lifetime/i);
		expect(price).toHaveAttribute('aria-describedby', explanation.id);
		expect(period).toHaveAttribute('aria-describedby', explanation.id);
	});

	it('creates a free plan priced 0 on a lifetime period', async () => {
		const user = userEvent.setup();
		const onSave = vi.fn();
		await renderModal({
			plan: null,
			open: true,
			onClose: vi.fn(),
			onSave,
			organization: orgConnected
		});

		await user.type(screen.getByLabelText(/name/i), 'Supporter');
		await user.click(screen.getByRole('radio', { name: /free/i }));
		await user.click(screen.getByRole('button', { name: /create/i }));

		expect(onSave).toHaveBeenCalledWith(
			expect.objectContaining({
				payment_method: 'free',
				price: '0.00',
				period_unit: 'lifetime',
				period_count: 1
			})
		);
	});

	// `period_count` describes a renewal frequency, and a lifetime plan has none.
	it('withdraws the period count for a lifetime plan and explains the absence', async () => {
		const user = userEvent.setup();
		await renderModal({
			plan: null,
			open: true,
			onClose: vi.fn(),
			onSave: vi.fn(),
			organization: orgConnected
		});
		expect(screen.getByLabelText(/^every$/i)).toBeInTheDocument();

		await user.selectOptions(screen.getByLabelText(/^period$/i), 'lifetime');

		expect(screen.queryByLabelText(/^every$/i)).toBeNull();
		expect(screen.getByText(/never renews, so there's no billing frequency/i)).toBeInTheDocument();
	});

	// Stripe bills monthly or yearly; the backend refuses a lifetime online plan.
	it('does not offer lifetime for an online plan', async () => {
		const user = userEvent.setup();
		await renderModal({
			plan: null,
			open: true,
			onClose: vi.fn(),
			onSave: vi.fn(),
			organization: orgConnected
		});

		expect(screen.getByRole('option', { name: /lifetime/i })).toBeInTheDocument();
		await user.click(screen.getByRole('radio', { name: /online/i }));

		expect(screen.queryByRole('option', { name: /lifetime/i })).toBeNull();
	});

	// Switching Offline→Online with lifetime already picked is the one way to hold
	// a combination the Online option itself never offers.
	it('falls back to a monthly period when a lifetime plan is switched to online', async () => {
		const user = userEvent.setup();
		const onSave = vi.fn();
		await renderModal({
			plan: null,
			open: true,
			onClose: vi.fn(),
			onSave,
			organization: orgConnected
		});

		await user.type(screen.getByLabelText(/name/i), 'Annual');
		await user.selectOptions(screen.getByLabelText(/^period$/i), 'lifetime');
		await user.click(screen.getByRole('radio', { name: /online/i }));
		await setPrice(user, '10');
		await user.click(screen.getByRole('button', { name: /create/i }));

		expect(onSave).toHaveBeenCalledWith(
			expect.objectContaining({ payment_method: 'online', period_unit: 'month' })
		);
	});

	// The backend's own rule: an online plan priced 0 would create a Stripe Price
	// of zero. The remedy is a free plan, which the message names.
	it('refuses a zero-priced online plan and points at the free option', async () => {
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
		await user.click(screen.getByRole('button', { name: /create/i }));

		expect(onSave).not.toHaveBeenCalled();
		expect(screen.getByText(/must be priced above 0/i)).toBeInTheDocument();
	});

	// `payment_method` is not patchable, so an edit is judged against the plan's
	// own method — and a free plan's locked fields stay locked.
	it('keeps a free plan locked when editing it', () => {
		render(PlanFormModal, {
			props: {
				plan: makeFreePlan(),
				open: true,
				onClose: vi.fn(),
				onSave: vi.fn(),
				organization: orgConnected
			}
		});

		expect(screen.getByText('Free — members join at no cost')).toBeInTheDocument();
		expect(screen.getByLabelText(/^price$/i)).toBeDisabled();
		expect(screen.getByLabelText(/^period$/i)).toBeDisabled();
		expect(screen.queryByLabelText(/^every$/i)).toBeNull();
	});

	// Before #724 the picker offered only month/year, so an externally created
	// lifetime plan opened this form with a blank period.
	it('shows the lifetime period when editing an offline lifetime plan', () => {
		render(PlanFormModal, {
			props: {
				plan: makeFreePlan({ payment_method: 'offline', price: '50.00' }),
				open: true,
				onClose: vi.fn(),
				onSave: vi.fn(),
				organization: orgConnected
			}
		});

		const period = screen.getByLabelText(/^period$/i);
		expect(period).toHaveValue('lifetime');
		expect(period).toBeEnabled();
		expect(screen.getByLabelText(/^price$/i)).toBeEnabled();
	});
});
