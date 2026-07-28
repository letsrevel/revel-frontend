import { describe, it, expect } from 'vitest';
import { partialRefundAmount, getPaymentStatusConfig } from './SubscriptionPaymentsShared';
import type { PaymentStatus } from '$lib/api/generated/types.gen';

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

describe('getPaymentStatusConfig', () => {
	it('covers every payment status with a distinct tint', () => {
		const statuses: PaymentStatus[] = ['pending', 'succeeded', 'failed', 'refunded'];
		const classNames = statuses.map((s) => getPaymentStatusConfig(s).className);
		expect(classNames.every(Boolean)).toBe(true);
		expect(new Set(classNames).size).toBe(statuses.length);
	});
});
