import { describe, it, expect } from 'vitest';
import { estimateNetPayout, platformFeeInfoFrom } from './fees';

/** Narrow a nullable result, failing the test when it is null. */
function requireValue<T>(value: T | null): T {
	if (value === null) throw new Error('expected a non-null value');
	return value;
}

describe('estimateNetPayout', () => {
	it('computes stripe fee, platform fee and net for a €20 ticket', () => {
		const result = requireValue(
			estimateNetPayout({
				price: 20,
				platformFeePercent: 1.5,
				platformFeeFixed: 0.25
			})
		);
		// 20 * 1.5% + 0.25 = 0.55 each
		expect(result.stripeFee).toBeCloseTo(0.55, 10);
		expect(result.platformFee).toBeCloseTo(0.55, 10);
		expect(result.platformFeeVat).toBe(0);
		expect(result.net).toBeCloseTo(18.9, 10);
	});

	it('adds VAT on the platform fee only, never on the stripe fee', () => {
		const result = requireValue(
			estimateNetPayout({
				price: 20,
				platformFeePercent: 1.5,
				platformFeeFixed: 0.25,
				platformFeeVatRate: 20
			})
		);
		expect(result.platformFeeVat).toBeCloseTo(0.11, 10);
		expect(result.stripeFee).toBeCloseTo(0.55, 10);
		expect(result.net).toBeCloseTo(18.79, 10);
	});

	it('clamps the net at zero when fees exceed the price', () => {
		const result = requireValue(
			estimateNetPayout({
				price: 0.3,
				platformFeePercent: 1.5,
				platformFeeFixed: 0.25,
				platformFeeVatRate: 20
			})
		);
		expect(result.net).toBe(0);
	});

	it.each([0, -5, NaN, Infinity])('returns null for non-positive price %p', (price) => {
		expect(
			estimateNetPayout({ price, platformFeePercent: 1.5, platformFeeFixed: 0.25 })
		).toBeNull();
	});
});

describe('platformFeeInfoFrom', () => {
	// The admin org schema serializes decimals as strings.
	const org = { platform_fee_percent: '1.50', platform_fee_fixed: '0.25' };

	it('parses the string decimal fee fields', () => {
		expect(platformFeeInfoFrom(org)).toEqual({ percent: 1.5, fixed: 0.25, vatRate: 0 });
	});

	it('feature-detects platform_fee_vat_rate when the backend exposes it', () => {
		expect(platformFeeInfoFrom({ ...org, platform_fee_vat_rate: '20.00' })).toEqual({
			percent: 1.5,
			fixed: 0.25,
			vatRate: 20
		});
	});

	it('treats a zero/negative/absent vat rate as 0 (reverse charge or not exposed)', () => {
		for (const rate of ['0.00', '-1', 'nope']) {
			const info = requireValue(platformFeeInfoFrom({ ...org, platform_fee_vat_rate: rate }));
			expect(info.vatRate).toBe(0);
		}
	});

	it.each([
		null,
		undefined,
		'string',
		{},
		{ platform_fee_percent: '1.5' },
		{ platform_fee_percent: 'x', platform_fee_fixed: '0.25' },
		{ platform_fee_percent: '-1', platform_fee_fixed: '0.25' }
	])('returns null when fee fields are missing or invalid: %p', (input) => {
		expect(platformFeeInfoFrom(input)).toBeNull();
	});
});
