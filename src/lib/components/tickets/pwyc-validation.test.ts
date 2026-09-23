import { describe, it, expect } from 'vitest';
import { pwycBounds, pwycErrorMessage } from './pwyc-validation';
import { formatMoney } from '$lib/utils/format';

describe('pwycBounds', () => {
	it('falls back min to price when pwyc_min is absent', () => {
		expect(pwycBounds({ price: '25.00', pwyc_min: undefined, pwyc_max: null })).toEqual({
			minAmount: 25,
			maxAmount: null
		});
	});
	it('uses pwyc_min over price when present', () => {
		expect(pwycBounds({ price: '25.00', pwyc_min: '5.00', pwyc_max: null })).toEqual({
			minAmount: 5,
			maxAmount: null
		});
	});
	it('defaults min to 1 when both pwyc_min and price are unparsable', () => {
		expect(pwycBounds({ price: 'not-a-number', pwyc_min: undefined, pwyc_max: null })).toEqual({
			minAmount: 1,
			maxAmount: null
		});
	});
	it('parses pwyc_max when present, null when absent', () => {
		expect(pwycBounds({ price: '25.00', pwyc_min: '5.00', pwyc_max: '100.00' })).toEqual({
			minAmount: 5,
			maxAmount: 100
		});
		expect(pwycBounds({ price: '25.00', pwyc_min: '5.00', pwyc_max: null })).toEqual({
			minAmount: 5,
			maxAmount: null
		});
		expect(pwycBounds({ price: '25.00', pwyc_min: '5.00', pwyc_max: undefined })).toEqual({
			minAmount: 5,
			maxAmount: null
		});
	});
	it('treats an unparsable pwyc_max as absent (null)', () => {
		expect(pwycBounds({ price: '25.00', pwyc_min: '5.00', pwyc_max: 'not-a-number' })).toEqual({
			minAmount: 5,
			maxAmount: null
		});
	});
});

describe('pwycErrorMessage', () => {
	it('formats the bound with the locale-aware money formatter (#949)', () => {
		const min = pwycErrorMessage('below_min', 'EUR', 5, 50);
		expect(min).toBe(`Minimum amount is ${formatMoney(5, 'EUR')}`);
		expect(min).toBe('Minimum amount is €5.00');
		expect(pwycErrorMessage('above_max', 'EUR', 5, 50)).toBe(
			`Maximum amount is ${formatMoney(50, 'EUR')}`
		);
	});

	it('never falls back to the hand-rolled "EUR 5.00" template', () => {
		expect(pwycErrorMessage('below_min', 'EUR', 5, null)).not.toMatch(/EUR 5\.00/);
	});
});
