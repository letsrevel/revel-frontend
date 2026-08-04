import { describe, it, expect } from 'vitest';
import {
	partialRefundAmount,
	platformFeeBreakdown,
	canRefundLedgerPayment,
	type PlatformFeePayment
} from './SubscriptionPaymentsShared';
import type { PaymentStatus } from '$lib/api/generated/types.gen';

function feePayment(overrides: Partial<PlatformFeePayment> = {}): PlatformFeePayment {
	return {
		amount: '10.00',
		refund_amount: null,
		platform_fee: '1.80',
		platform_fee_net: '1.50',
		platform_fee_vat: '0.30',
		platform_fee_vat_rate: '20.00',
		platform_fee_reverse_charge: false,
		...overrides
	};
}

describe('partialRefundAmount', () => {
	it('returns null when nothing was refunded', () => {
		expect(partialRefundAmount({ amount: '10.00', refund_amount: null })).toBeNull();
		expect(partialRefundAmount({ amount: '10.00', refund_amount: undefined })).toBeNull();
		expect(partialRefundAmount({ amount: '10.00', refund_amount: '0.00' })).toBeNull();
	});

	// The whole point of the annotation: a partial refund leaves the row's status
	// at 'succeeded', so the amount is the only place it can surface.
	it('returns the refunded amount when it is strictly less than the charge', () => {
		expect(partialRefundAmount({ amount: '10.00', refund_amount: '4.00' })).toBe('4.00');
	});

	it('returns null for a full refund (the status already says so)', () => {
		expect(partialRefundAmount({ amount: '10.00', refund_amount: '10.00' })).toBeNull();
	});

	// Amounts are decimal STRINGS: a lexicographic comparison would call
	// "9.00" > "10.00" and mislabel a partial refund as a full one.
	it('compares numerically, not lexicographically', () => {
		expect(partialRefundAmount({ amount: '10.00', refund_amount: '9.00' })).toBe('9.00');
	});

	it('returns null when either side is not a finite number', () => {
		expect(partialRefundAmount({ amount: '10.00', refund_amount: 'nope' })).toBeNull();
		expect(partialRefundAmount({ amount: 'nope', refund_amount: '4.00' })).toBeNull();
	});
});

describe('platformFeeBreakdown suppression', () => {
	// The whole block is hidden whenever no fee actually changed hands. Offline
	// payments are the dominant row type on the org-wide ledger, so a 0.00
	// breakdown on each of them would be noise, not information.
	it('returns null for an offline/failed payment whose fee is a literal zero', () => {
		expect(
			platformFeeBreakdown(
				feePayment({
					platform_fee: '0.00',
					platform_fee_net: null,
					platform_fee_vat: null,
					platform_fee_vat_rate: null
				})
			)
		).toBeNull();
	});

	it('returns null for a row written before the backend added the fee columns', () => {
		expect(platformFeeBreakdown(feePayment({ platform_fee: undefined }))).toBeNull();
	});

	it('returns null when the fee is explicitly absent or unparseable', () => {
		expect(platformFeeBreakdown(feePayment({ platform_fee: '' }))).toBeNull();
		expect(platformFeeBreakdown(feePayment({ platform_fee: 'nope' }))).toBeNull();
	});

	it('returns null when the gross amount cannot be parsed, so no net is derivable', () => {
		expect(platformFeeBreakdown(feePayment({ amount: 'nope' }))).toBeNull();
	});

	it('never returns a negative fee block', () => {
		expect(platformFeeBreakdown(feePayment({ platform_fee: '-1.00' }))).toBeNull();
	});
});

describe('platformFeeBreakdown decomposition', () => {
	it('splits gross into fee and net to the organizer', () => {
		const fee = platformFeeBreakdown(feePayment());

		expect(fee).not.toBeNull();
		expect(fee?.feeGross).toBe(1.8);
		expect(fee?.netToOrganizer).toBe(8.2);
	});

	// `platform_fee_net` is the FEE excluding VAT — the platform's own revenue —
	// and must never be mistaken for what the organizer nets. These are 1.50 and
	// 8.20 on the same row precisely so a regression here is visible.
	it('keeps the fee-excluding-VAT figure distinct from the organizer net', () => {
		const fee = platformFeeBreakdown(feePayment());

		expect(fee?.feeExclVat).toBe('1.50');
		expect(fee?.netToOrganizer).toBe(8.2);
	});

	it('passes the VAT decomposition through untouched', () => {
		const fee = platformFeeBreakdown(feePayment());

		expect(fee?.feeVat).toBe('0.30');
		expect(fee?.feeVatRate).toBe('20.00');
		expect(fee?.reverseCharge).toBe(false);
	});

	it('reports reverse charge, where the whole fee is net and no VAT was taken', () => {
		const fee = platformFeeBreakdown(
			feePayment({
				platform_fee: '1.50',
				platform_fee_net: '1.50',
				platform_fee_vat: '0.00',
				platform_fee_vat_rate: '0.00',
				platform_fee_reverse_charge: true
			})
		);

		expect(fee?.reverseCharge).toBe(true);
		expect(fee?.netToOrganizer).toBe(8.5);
	});

	it('normalises a missing VAT decomposition to null rather than undefined', () => {
		const fee = platformFeeBreakdown(
			feePayment({
				platform_fee_net: null,
				platform_fee_vat: undefined,
				platform_fee_vat_rate: undefined,
				platform_fee_reverse_charge: undefined
			})
		);

		expect(fee?.feeExclVat).toBeNull();
		expect(fee?.feeVat).toBeNull();
		expect(fee?.feeVatRate).toBeNull();
		expect(fee?.reverseCharge).toBe(false);
	});

	// Amounts are decimal STRINGS; naive float subtraction leaks artefacts like
	// 8.199999999999999 into the UI on some currency/fee combinations.
	it('subtracts numerically without leaking binary-float noise', () => {
		expect(
			platformFeeBreakdown(feePayment({ amount: '9.99', platform_fee: '0.15' }))?.netToOrganizer
		).toBe(9.84);
		expect(
			platformFeeBreakdown(feePayment({ amount: '100.10', platform_fee: '1.80' }))?.netToOrganizer
		).toBe(98.3);
	});

	it('works for a zero-decimal currency amount', () => {
		const fee = platformFeeBreakdown(feePayment({ amount: '1000', platform_fee: '18' }));

		expect(fee?.netToOrganizer).toBe(982);
	});
});

describe('platformFeeBreakdown refund interaction', () => {
	// The backend keeps the platform fee whatever happens afterwards (it never
	// sets `refund_application_fee`), so a refund is paid entirely out of the
	// organizer's remainder: net = amount - fee - refund.
	it('nets a partial refund out of the organizer share, not out of the fee', () => {
		const fee = platformFeeBreakdown(feePayment({ refund_amount: '4.00' }));

		expect(fee?.hasRefund).toBe(true);
		expect(fee?.refundAmount).toBe(4);
		// The fee line is untouched: it still describes the original charge.
		expect(fee?.feeGross).toBe(1.8);
		// 10.00 - 1.80 - 4.00. Two subtractions, so the float noise is doubled.
		expect(fee?.netToOrganizer).toBe(4.2);
	});

	// The organizer handed back the whole gross but Revel kept its fee, so the
	// row genuinely cost them the fee. Rendered as such — never clamped to zero.
	it('goes negative by exactly the fee on a full refund', () => {
		const fee = platformFeeBreakdown(feePayment({ refund_amount: '10.00' }));

		expect(fee?.hasRefund).toBe(true);
		expect(fee?.refundAmount).toBe(10);
		expect(fee?.netToOrganizer).toBe(-1.8);
	});

	it('leaves an unrefunded payment at gross minus fee, with no refund line', () => {
		const fee = platformFeeBreakdown(feePayment());

		expect(fee?.hasRefund).toBe(false);
		expect(fee?.refundAmount).toBeNull();
		expect(fee?.netToOrganizer).toBe(8.2);
	});

	it('treats absent, zero and unparseable refunds alike — no deduction at all', () => {
		for (const refund_amount of [null, undefined, '0.00', 'nope']) {
			const fee = platformFeeBreakdown(feePayment({ refund_amount }));
			expect(fee?.hasRefund).toBe(false);
			expect(fee?.refundAmount).toBeNull();
			expect(fee?.netToOrganizer).toBe(8.2);
		}
	});

	// Decimal STRINGS again: a lexicographic or concatenating slip here would put
	// a wildly wrong figure on a money surface.
	it('subtracts the refund numerically, without float noise', () => {
		expect(
			platformFeeBreakdown(
				feePayment({ amount: '9.99', platform_fee: '0.15', refund_amount: '3.33' })
			)?.netToOrganizer
		).toBe(6.51);
		expect(
			platformFeeBreakdown(feePayment({ amount: '1000', platform_fee: '18', refund_amount: '250' }))
				?.netToOrganizer
		).toBe(732);
	});

	// Over-refunding is not something the backend should produce, but if it ever
	// did the honest answer is a bigger negative, not a clamp.
	it('does not clamp a refund larger than the charge', () => {
		expect(
			platformFeeBreakdown(feePayment({ amount: '10.00', refund_amount: '12.00' }))?.netToOrganizer
		).toBe(-3.8);
	});
});

describe('canRefundLedgerPayment', () => {
	// The backend 400s a refund on an ONLINE payment, so the ledger must never
	// render the control there; and only a SUCCEEDED payment has anything to
	// give back.
	it('allows a refund on a succeeded OFFLINE payment', () => {
		expect(canRefundLedgerPayment({ status: 'succeeded', payment_method: 'offline' })).toBe(true);
	});

	it('refuses a succeeded ONLINE payment — that one must go through Stripe', () => {
		expect(canRefundLedgerPayment({ status: 'succeeded', payment_method: 'online' })).toBe(false);
	});

	it('refuses every non-succeeded status, OFFLINE or not', () => {
		const statuses: PaymentStatus[] = ['pending', 'failed', 'refunded'];
		for (const status of statuses) {
			expect(canRefundLedgerPayment({ status, payment_method: 'offline' })).toBe(false);
			expect(canRefundLedgerPayment({ status, payment_method: 'online' })).toBe(false);
		}
	});
});
