import { describe, it, expect } from 'vitest';
import {
	changedZeroRuleFields,
	effectiveVatRate,
	exemptionLikelyCause,
	exemptionReasonForPayload,
	omitUnchangedZeroRuleFields,
	schemeAdjustedOverride,
	isPaidOnline,
	orgVatContextFrom,
	vatExemptionRequired,
	vatExemptionVisible,
	zeroRuleRechecked,
	type OrgVatContext
} from './tier-vat';

const org = (o: Partial<OrgVatContext> = {}): OrgVatContext => ({
	vatRate: '0',
	invoicingMode: 'auto',
	exemptionReason: '',
	smallBusiness: false,
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
		).toEqual({
			vatRate: '19.00',
			invoicingMode: 'hybrid',
			exemptionReason: 'x',
			smallBusiness: false
		});
	});
	it('reads the small-business scheme defensively', () => {
		const base = { invoicing_mode: 'none' };
		expect(orgVatContextFrom({ ...base, small_business_scheme: 'de_19' })?.smallBusiness).toBe(
			true
		);
		expect(orgVatContextFrom({ ...base, small_business_scheme: 'none' })?.smallBusiness).toBe(
			false
		);
		expect(orgVatContextFrom({ ...base })?.smallBusiness).toBe(false);
		expect(orgVatContextFrom({ ...base, small_business_scheme: 3 })?.smallBusiness).toBe(false);
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

describe('legacy 0% tier edit carve-out', () => {
	const tier = {
		payment_method: 'online',
		price_type: 'fixed',
		price: '10.00',
		pwyc_min: null,
		pwyc_max: null,
		vat_rate: '0.00',
		vat_exemption_reason: ''
	} as unknown as Parameters<typeof changedZeroRuleFields>[0];
	const same = {
		paymentMethod: 'online',
		priceType: 'fixed',
		price: '10',
		pwycMin: '1',
		pwycMax: '',
		vatRateOverride: '0',
		vatExemptionReason: ''
	};

	it('re-checks on create, on a resume of a paused tier, and when category prices are sent', () => {
		expect(zeroRuleRechecked(null, same, false, false)).toBe(true);
		expect(zeroRuleRechecked(tier, same, false, false)).toBe(false);
		const paused = { ...tier, sales_paused: true } as typeof tier;
		expect(zeroRuleRechecked(paused, same, false, false)).toBe(true);
		expect(zeroRuleRechecked(paused, same, true, false)).toBe(false);
		expect(zeroRuleRechecked(tier, same, true, false)).toBe(false);
		expect(zeroRuleRechecked(tier, same, false, true)).toBe(true);
		expect(zeroRuleRechecked(tier, { ...same, price: '12' }, false, false)).toBe(true);
	});

	it('reports nothing changed for a plain rename (values compared numerically)', () => {
		expect(changedZeroRuleFields(tier, same)).toEqual([]);
	});
	it('reports the rule fields that changed', () => {
		expect(changedZeroRuleFields(tier, { ...same, price: '12' })).toEqual(['price']);
		expect(changedZeroRuleFields(tier, { ...same, vatExemptionReason: ' x ' })).toEqual([
			'vat_exemption_reason'
		]);
		expect(changedZeroRuleFields(tier, { ...same, vatRateOverride: '' })).toEqual(['vat_rate']);
	});
	it('strips unchanged rule keys from the payload, keeping other fields', () => {
		const payload: Record<string, unknown> = {
			name: 'Renamed',
			payment_method: 'online',
			price_type: 'fixed',
			price: '10',
			vat_rate: 0,
			vat_exemption_reason: ''
		};
		omitUnchangedZeroRuleFields(tier, payload, { ...same, price: '12' });
		expect(payload).toEqual({ name: 'Renamed', price: '10' });
		const rename: Record<string, unknown> = { name: 'R', price: '10', vat_rate: 0 };
		omitUnchangedZeroRuleFields(tier, rename, same);
		expect(rename).toEqual({ name: 'R' });
	});
});

describe('exemptionLikelyCause', () => {
	const paid = {
		paymentMethod: 'online',
		priceType: 'fixed',
		price: '10',
		pwycMin: '',
		pwycMax: '',
		vatRateOverride: '',
		vatExemptionReason: ''
	};
	const v = (o: Partial<typeof paid> = {}) => ({ ...paid, ...o });
	it('is true only under the conditions of vatExemptionRequired and no tier reason', () => {
		expect(exemptionLikelyCause(v(), org())).toBe(true);
		expect(
			exemptionLikelyCause(
				v({ vatRateOverride: '0', vatExemptionReason: '  ' }),
				org({ vatRate: '22' })
			)
		).toBe(true);
		expect(exemptionLikelyCause(v({ vatExemptionReason: 'Art. 8' }), org())).toBe(false);
		expect(exemptionLikelyCause(v(), org({ exemptionReason: 'Default' }))).toBe(false);
		expect(exemptionLikelyCause(v(), org({ vatRate: '22' }))).toBe(false);
		expect(exemptionLikelyCause(v(), null)).toBe(false);
	});
	it('is false when invoicing is off or the tier is not paid online', () => {
		expect(exemptionLikelyCause(v(), org({ invoicingMode: 'none' }))).toBe(false);
		expect(exemptionLikelyCause(v({ paymentMethod: 'offline' }), org())).toBe(false);
		expect(exemptionLikelyCause(v({ price: '0' }), org())).toBe(false);
	});
});

describe('exemptionReasonForPayload', () => {
	it('drops the reason for free tiers and explicit non-zero overrides', () => {
		expect(exemptionReasonForPayload('free', '0', 'Art. 8')).toBe('');
		expect(exemptionReasonForPayload('online', '22', 'Art. 8')).toBe('');
	});
	it('keeps it for a zero override, or when only the org default hides the input', () => {
		expect(exemptionReasonForPayload('online', '0', ' Art. 8 ')).toBe('Art. 8');
		expect(exemptionReasonForPayload('online', '', 'Art. 8')).toBe('Art. 8');
	});
});

describe('schemeAdjustedOverride', () => {
	const scheme = org({ smallBusiness: true });
	it('clears a positive override under a scheme', () => {
		expect(schemeAdjustedOverride('19', scheme)).toBe('');
		expect(schemeAdjustedOverride('7,5', scheme)).toBe('');
	});
	it('keeps empty and zero overrides under a scheme', () => {
		expect(schemeAdjustedOverride('', scheme)).toBe('');
		expect(schemeAdjustedOverride('0', scheme)).toBe('0');
	});
	it('never touches the override without a scheme or org', () => {
		expect(schemeAdjustedOverride('19', org())).toBe('19');
		expect(schemeAdjustedOverride('19', null)).toBe('19');
	});
});
