import { render, screen, within } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import PaymentsTable from './PaymentsTable.svelte';
import type { MembershipPaymentSchema } from '$lib/api/generated/types.gen';

function makePayment(overrides: Partial<MembershipPaymentSchema> = {}): MembershipPaymentSchema {
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
		refund_amount: null,
		refunded_at: null,
		stripe_refund_id: null,
		// Default to the offline/failed shape the backend documents: no fee was
		// taken, so the breakdown must stay off unless a test opts in.
		platform_fee: '0.00',
		platform_fee_net: null,
		platform_fee_vat: null,
		platform_fee_vat_rate: null,
		platform_fee_reverse_charge: false,
		...overrides
	} as MembershipPaymentSchema;
}

/** A Stripe charge that actually paid a fee: 10.00 gross, 1.80 fee (1.50 + 20% VAT). */
function withFee(overrides: Partial<MembershipPaymentSchema> = {}): MembershipPaymentSchema {
	return makePayment({
		amount: '10.00',
		platform_fee: '1.80',
		platform_fee_net: '1.50',
		platform_fee_vat: '0.30',
		platform_fee_vat_rate: '20.00',
		platform_fee_reverse_charge: false,
		...overrides
	});
}

function renderTable(payments: MembershipPaymentSchema[], isOnlinePlan = false) {
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

describe('PaymentsTable partial-refund annotation', () => {
	// BE #774 note 2: a partial Stripe refund keeps `status = 'succeeded'`, so
	// without this annotation the refund is invisible to the organizer.
	it('annotates the amount when only part of the payment was refunded', () => {
		renderTable([makePayment({ amount: '10.00', refund_amount: '4.00', status: 'succeeded' })]);

		expect(screen.getByText('(4.00 EUR refunded)')).toBeInTheDocument();
	});

	it('leaves a fully refunded payment to the status column', () => {
		renderTable([makePayment({ amount: '10.00', refund_amount: '10.00', status: 'refunded' })]);

		expect(screen.queryByText(/refunded\)/)).not.toBeInTheDocument();
	});

	it('shows no annotation for a payment that was never refunded', () => {
		renderTable([makePayment({ amount: '10.00', refund_amount: null })]);

		expect(screen.queryByText(/refunded\)/)).not.toBeInTheDocument();
	});

	it('treats a zero refund amount as never refunded', () => {
		renderTable([makePayment({ amount: '10.00', refund_amount: '0.00' })]);

		expect(screen.queryByText(/refunded\)/)).not.toBeInTheDocument();
	});
});

describe('PaymentsTable platform-fee breakdown', () => {
	// BE a8b6b727 exposes the fee decomposition on the two STAFF schemas so an
	// organizer can reconcile a Stripe payout line. Every field is optional and
	// nullable, so the block has to be fully gated.
	it('suppresses the whole block for an offline payment whose fee is a literal zero', () => {
		renderTable([makePayment({ platform_fee: '0.00' })]);

		expect(screen.queryByText('Platform fee')).not.toBeInTheDocument();
		expect(screen.queryByText('Net to you')).not.toBeInTheDocument();
		expect(screen.queryByText('—')).not.toBeInTheDocument();
	});

	it('suppresses the block for a row written before the backend added the fields', () => {
		renderTable([makePayment({ platform_fee: undefined })]);

		expect(screen.queryByText('Platform fee')).not.toBeInTheDocument();
		expect(screen.queryByText(/NaN|undefined/)).not.toBeInTheDocument();
	});

	it('shows the fee as a deduction and the organizer net as the bottom line', () => {
		renderTable([withFee()]);

		expect(screen.getByText('Platform fee')).toBeInTheDocument();
		expect(screen.getByText('-€1.80')).toBeInTheDocument();
		expect(screen.getByText('Net to you')).toBeInTheDocument();
		expect(screen.getByText('€8.20')).toBeInTheDocument();
	});

	// The trap: `platform_fee_net` (1.50) is the FEE excluding VAT, NOT what the
	// organizer nets (8.20). Both figures are on the row, under distinct labels.
	it('keeps "Fee excl. VAT" distinct from "Net to you"', () => {
		renderTable([withFee()]);

		const feeExclVat = screen.getByText('Fee excl. VAT').closest('div');
		expect(within(feeExclVat as HTMLElement).getByText('€1.50')).toBeInTheDocument();

		const netToYou = screen.getByText('Net to you').closest('div');
		expect(within(netToYou as HTMLElement).getByText('€8.20')).toBeInTheDocument();
	});

	it('labels the fee VAT with its recorded rate', () => {
		renderTable([withFee()]);

		expect(screen.getByText('VAT on fee (20.00%)')).toBeInTheDocument();
		expect(screen.getByText('€0.30')).toBeInTheDocument();
	});

	it('omits the VAT lines entirely when the backend recorded no decomposition', () => {
		renderTable([
			withFee({ platform_fee_net: null, platform_fee_vat: null, platform_fee_vat_rate: null })
		]);

		expect(screen.getByText('Platform fee')).toBeInTheDocument();
		expect(screen.queryByText('Fee excl. VAT')).not.toBeInTheDocument();
		expect(screen.queryByText(/VAT on fee/)).not.toBeInTheDocument();
	});

	it('replaces the VAT line with a reverse-charge note for EU B2B cross-border', () => {
		renderTable([
			withFee({
				platform_fee: '1.50',
				platform_fee_net: '1.50',
				platform_fee_vat: '0.00',
				platform_fee_vat_rate: '0.00',
				platform_fee_reverse_charge: true
			})
		]);

		expect(screen.getByText('Reverse charge')).toBeInTheDocument();
		expect(screen.getByText('Yes (EU B2B) — you self-assess the VAT')).toBeInTheDocument();
		expect(screen.queryByText(/VAT on fee/)).not.toBeInTheDocument();
	});
});

describe('PaymentsTable fee/refund interaction', () => {
	// The backend leaves `platform_fee` untouched on refund and a correct
	// post-refund net is not derivable here, so the net is annotated as
	// pre-refund rather than silently contradicting the refund annotation.
	it('flags the net as pre-refund on a partially refunded payment', () => {
		renderTable([withFee({ refund_amount: '4.00', status: 'succeeded' })]);

		expect(screen.getByText('(4.00 EUR refunded)')).toBeInTheDocument();
		expect(screen.getByText(/Net shown before the refund/)).toBeInTheDocument();
	});

	it('flags the net as pre-refund on a fully refunded payment too', () => {
		renderTable([withFee({ refund_amount: '10.00', status: 'refunded' })]);

		expect(screen.getByText(/Net shown before the refund/)).toBeInTheDocument();
	});

	it('shows no refund caveat when nothing was refunded', () => {
		renderTable([withFee()]);

		expect(screen.queryByText(/Net shown before the refund/)).not.toBeInTheDocument();
	});

	it('shows no refund caveat when there is no fee block at all', () => {
		renderTable([makePayment({ refund_amount: '4.00', platform_fee: '0.00' })]);

		expect(screen.getByText('(4.00 EUR refunded)')).toBeInTheDocument();
		expect(screen.queryByText(/Net shown before the refund/)).not.toBeInTheDocument();
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
