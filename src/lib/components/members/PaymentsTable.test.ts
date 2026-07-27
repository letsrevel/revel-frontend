import { render, screen, within } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import PaymentsTable from './PaymentsTable.svelte';
import type { PaymentSchema2 } from '$lib/api/generated/types.gen';

function makePayment(overrides: Partial<PaymentSchema2> = {}): PaymentSchema2 {
	return {
		id: 'pay-1',
		subscription_id: 'sub-1',
		status: 'succeeded',
		amount: '10.00',
		currency: 'EUR',
		notes: '',
		period_start: '2026-08-01T00:00:00Z',
		period_end: '2026-09-01T00:00:00Z',
		occurred_at: '2026-08-01T00:00:00Z',
		created_at: '2026-08-01T00:00:00Z',
		recorded_by_id: null,
		recorded_by_name: null,
		stripe_dashboard_url: null,
		stripe_invoice_id: null,
		stripe_payment_intent_id: null,
		...overrides
	} as PaymentSchema2;
}

function renderTable(payments: PaymentSchema2[], isOnlinePlan = false) {
	return render(PaymentsTable, {
		props: { payments, isOnlinePlan, onRefund: vi.fn() }
	});
}

describe('PaymentsTable Stripe dashboard link', () => {
	// BE #774 fix 2: `stripe_dashboard_url` is non-null only for Stripe-backed
	// rows. OFFLINE payments must not get a dead/disabled stub.
	it('links the payment to its Stripe Dashboard page when a URL is present', () => {
		renderTable(
			[
				makePayment({
					stripe_dashboard_url: 'https://dashboard.stripe.com/test/payments/pi_123'
				})
			],
			true
		);

		const link = screen.getByRole('link', { name: 'View on Stripe' });
		expect(link).toHaveAttribute('href', 'https://dashboard.stripe.com/test/payments/pi_123');
		expect(link).toHaveAttribute('target', '_blank');
		expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
		expect(link).toHaveAttribute('rel', expect.stringContaining('noreferrer'));
	});

	it('renders no Stripe affordance at all for a payment without a dashboard URL', () => {
		renderTable([makePayment({ stripe_dashboard_url: null })]);

		// Queried by text rather than by role: `Button` silently degrades from <a>
		// to <button> when `href` is nullish, so a role-scoped negative would pass
		// while a dead, un-navigable "View on Stripe" stub sat in the row.
		expect(screen.queryByText('View on Stripe')).not.toBeInTheDocument();
	});

	it('links only the rows that carry a URL when a plan mixes both', () => {
		renderTable(
			[
				makePayment({ id: 'pay-1', stripe_dashboard_url: null }),
				makePayment({
					id: 'pay-2',
					stripe_dashboard_url: 'https://dashboard.stripe.com/test/invoices/in_9'
				})
			],
			true
		);

		const links = screen.getAllByRole('link', { name: 'View on Stripe' });
		expect(links).toHaveLength(1);
		expect(links[0]).toHaveAttribute('href', 'https://dashboard.stripe.com/test/invoices/in_9');
		// No degraded <button> stub on the URL-less row either.
		expect(screen.getAllByText('View on Stripe')).toHaveLength(1);
	});
});

describe('PaymentsTable refund gating', () => {
	// BE #774 fix 1: the refund endpoint now 400s for payments on ONLINE plans,
	// so the control must not render at all (a dead button is worse than none).
	it('offers Refund for a succeeded payment on an OFFLINE plan', () => {
		renderTable([makePayment({ status: 'succeeded' })], false);

		expect(screen.getByRole('button', { name: 'Refund' })).toBeInTheDocument();
	});

	it('hides Refund for a succeeded payment on an ONLINE plan', () => {
		renderTable([makePayment({ status: 'succeeded' })], true);

		expect(screen.queryByRole('button', { name: 'Refund' })).not.toBeInTheDocument();
	});

	it('points organizers at Stripe instead of the hidden Refund control', () => {
		renderTable(
			[
				makePayment({
					status: 'succeeded',
					stripe_dashboard_url: 'https://dashboard.stripe.com/test/payments/pi_123'
				})
			],
			true
		);

		expect(screen.getByText(/Stripe Dashboard/i)).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'View on Stripe' })).toBeInTheDocument();
	});

	it('keeps the online-refund note out of the way for OFFLINE plans', () => {
		renderTable([makePayment({ status: 'succeeded' })], false);

		expect(screen.queryByText(/Stripe Dashboard/i)).not.toBeInTheDocument();
	});

	it('still hides Refund for a non-succeeded payment on an OFFLINE plan', () => {
		renderTable([makePayment({ status: 'refunded' })], false);

		expect(screen.queryByRole('button', { name: 'Refund' })).not.toBeInTheDocument();
	});

	it('scopes the refund control to the succeeded row', () => {
		renderTable(
			[makePayment({ id: 'pay-1', status: 'refunded' }), makePayment({ id: 'pay-2' })],
			false
		);

		const rows = screen.getAllByRole('row').slice(1); // drop the header row
		expect(within(rows[0]).queryByRole('button', { name: 'Refund' })).not.toBeInTheDocument();
		expect(within(rows[1]).getByRole('button', { name: 'Refund' })).toBeInTheDocument();
	});
});
