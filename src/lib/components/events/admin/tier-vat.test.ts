import { describe, it, expect } from 'vitest';
import {
	effectiveVatRate,
	isPaidOnline,
	orgVatContextFrom,
	vatExemptionRequired,
	vatExemptionVisible,
	type OrgVatContext
} from './tier-vat';

const org = (o: Partial<OrgVatContext> = {}): OrgVatContext => ({
	vatRate: '0',
	invoicingMode: 'auto',
	exemptionReason: '',
	...o
});
const online = {
	paymentMethod: 'online',
	priceType: 'fixed',
	price: '10',
	pwycMin: '1',
	pwycMax: ''
};

describe('orgVatContextFrom', () => {
	it('reads the admin fields', () => {
		expect(
			orgVatContextFrom({ vat_rate: '19.00', invoicing_mode: 'hybrid', vat_exemption_reason: 'x' })
		).toEqual({ vatRate: '19.00', invoicingMode: 'hybrid', exemptionReason: 'x' });
	});
	it('is null without an invoicing mode', () => {
		expect(orgVatContextFrom({ name: 'x' })).toBeNull();
		expect(orgVatContextFrom(null)).toBeNull();
	});
});

describe('effectiveVatRate', () => {
	it('prefers the override, even 0', () => {
		expect(effectiveVatRate('0', org({ vatRate: '20' }))).toBe(0);
		expect(effectiveVatRate('7,5', org())).toBe(7.5);
	});
	it('falls back to the org default, then null', () => {
		expect(effectiveVatRate('', org({ vatRate: '20' }))).toBe(20);
		expect(effectiveVatRate('', org({ vatRate: null }))).toBeNull();
		expect(effectiveVatRate('', null)).toBeNull();
	});
});

describe('vatExemptionVisible', () => {
	it('shows for paid tiers at 0% effective rate', () => {
		expect(vatExemptionVisible('online', '', org())).toBe(true);
		expect(vatExemptionVisible('offline', '0', org({ vatRate: '20' }))).toBe(true);
	});
	it('hides for free tiers and non-zero rates', () => {
		expect(vatExemptionVisible('free', '0', org())).toBe(false);
		expect(vatExemptionVisible('online', '', org({ vatRate: '20' }))).toBe(false);
		expect(vatExemptionVisible('online', '20', org())).toBe(false);
	});
	it('without org context only an explicit 0 override shows it', () => {
		expect(vatExemptionVisible('online', '0', null)).toBe(true);
		expect(vatExemptionVisible('online', '', null)).toBe(false);
		expect(vatExemptionVisible('online', '19', null)).toBe(false);
	});
});

describe('isPaidOnline', () => {
	it('needs online and a positive amount', () => {
		expect(isPaidOnline(online)).toBe(true);
		expect(isPaidOnline({ ...online, price: '0' })).toBe(false);
		expect(isPaidOnline({ ...online, paymentMethod: 'offline' })).toBe(false);
	});
	it('handles PWYC bounds and category prices', () => {
		const p = { ...online, priceType: 'pwyc', price: '0' };
		expect(isPaidOnline({ ...p, pwycMin: '0', pwycMax: '' })).toBe(false);
		expect(isPaidOnline({ ...p, pwycMin: '0', pwycMax: '5' })).toBe(true);
		expect(isPaidOnline({ ...online, price: '0', categoryPrices: ['', '12.5'] })).toBe(true);
	});
});

describe('vatExemptionRequired', () => {
	it('is required when all conditions hold', () => {
		expect(vatExemptionRequired(online, '', org())).toBe(true);
	});
	it('is not required when the org has a default reason', () => {
		expect(vatExemptionRequired(online, '', org({ exemptionReason: ' §4 ' }))).toBe(false);
	});
	it('treats a blank org reason as missing', () => {
		expect(vatExemptionRequired(online, '', org({ exemptionReason: '   ' }))).toBe(true);
	});
	it('is not required when invoicing is off, rate is non-zero, or not paid online', () => {
		expect(vatExemptionRequired(online, '', org({ invoicingMode: 'none' }))).toBe(false);
		expect(vatExemptionRequired(online, '19', org())).toBe(false);
		expect(vatExemptionRequired({ ...online, paymentMethod: 'offline' }, '', org())).toBe(false);
	});
	it('is never required without org context', () => {
		expect(vatExemptionRequired(online, '0', null)).toBe(false);
	});
});
