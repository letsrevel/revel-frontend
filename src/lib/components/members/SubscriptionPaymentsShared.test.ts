import { describe, it, expect } from 'vitest';
import {
	partialRefundAmount,
	getPaymentStatusConfig,
	platformFeeBreakdown,
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
	// The backend leaves `platform_fee` untouched on refund, so `netToOrganizer`
	// is pre-refund by construction. The flag exists so the surfaces can say so
	// instead of contradicting the refund annotation they already render.
	it('flags a partially refunded payment without netting the refund out', () => {
		const fee = platformFeeBreakdown(feePayment({ refund_amount: '4.00' }));

		expect(fee?.hasRefund).toBe(true);
		expect(fee?.netToOrganizer).toBe(8.2);
	});

	it('flags a fully refunded payment too — the status alone would hide it here', () => {
		expect(platformFeeBreakdown(feePayment({ refund_amount: '10.00' }))?.hasRefund).toBe(true);
	});

	it('does not flag a payment that was never refunded', () => {
		expect(platformFeeBreakdown(feePayment({ refund_amount: null }))?.hasRefund).toBe(false);
		expect(platformFeeBreakdown(feePayment({ refund_amount: undefined }))?.hasRefund).toBe(false);
		expect(platformFeeBreakdown(feePayment({ refund_amount: '0.00' }))?.hasRefund).toBe(false);
		expect(platformFeeBreakdown(feePayment({ refund_amount: 'nope' }))?.hasRefund).toBe(false);
	});
});

describe('getPaymentStatusConfig', () => {
	it('covers every payment status with a distinct tint', () => {
		const statuses: PaymentStatus[] = ['pending', 'succeeded', 'failed', 'refunded'];
		const classNames = statuses.map((s) => getPaymentStatusConfig(s).className);
		expect(classNames.every(Boolean)).toBe(true);
		expect(new Set(classNames).size).toBe(statuses.length);
	});
});
