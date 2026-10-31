import { describe, it, expect } from 'vitest';
import {
	SCHEME_COUNTRY,
	SCHEME_EXEMPTION_NOTES,
	TAX_NUMBER_EXAMPLES,
	isTaxNumberValid,
	resolveOrgCountry,
	schemeBlockers,
	schemeCountry,
	schemeExemptionNote,
	schemeForCountry,
	schemeRequiresVatId,
	taxNumberDigits,
	vatRateIsPositive
} from './small-business';

describe('scheme <-> country', () => {
	it('maps both ways', () => {
		expect(SCHEME_COUNTRY).toEqual({ de_19: 'DE', at_6_1_27: 'AT' });
		expect(schemeForCountry('DE')).toBe('de_19');
		expect(schemeForCountry(' at ')).toBe('at_6_1_27');
		expect(schemeForCountry('IT')).toBeNull();
		expect(schemeForCountry('')).toBeNull();
		expect(schemeForCountry(undefined)).toBeNull();
		expect(schemeCountry('de_19')).toBe('DE');
		expect(schemeCountry('none')).toBe('');
	});
	it('only DE requires a validated VAT ID', () => {
		expect(schemeRequiresVatId('de_19')).toBe(true);
		expect(schemeRequiresVatId('at_6_1_27')).toBe(false);
		expect(schemeRequiresVatId('none')).toBe(false);
	});
	it('carries the verbatim statutory notes', () => {
		expect(schemeExemptionNote('de_19')).toBe(
			'Steuerbefreit gemäß § 19 UStG (Kleinunternehmerregelung)'
		);
		expect(SCHEME_EXEMPTION_NOTES.at_6_1_27).toBe(
			'Umsatzsteuerbefreit – Kleinunternehmer gem. § 6 Abs. 1 Z 27 UStG'
		);
		expect(schemeExemptionNote('none')).toBe('');
	});
});

describe('tax number', () => {
	it('strips separators and whitespace', () => {
		expect(taxNumberDigits(' 12/345/67890 ')).toBe('1234567890');
		expect(taxNumberDigits('12-345.6789')).toBe('123456789');
	});
	it('validates DE lengths 10, 11 and 13 only', () => {
		expect(isTaxNumberValid('DE', '12/345/67890')).toBe(true);
		expect(isTaxNumberValid('DE', '123/456/78901')).toBe(true);
		expect(isTaxNumberValid('DE', '1121081508150')).toBe(true);
		expect(isTaxNumberValid('DE', '123456789012')).toBe(false);
		expect(isTaxNumberValid('DE', '123456789')).toBe(false);
	});
	it('validates AT as 9 digits', () => {
		expect(isTaxNumberValid('AT', '12-345/6789')).toBe(true);
		expect(isTaxNumberValid('AT', '12-345/67890')).toBe(false);
	});
	it('rejects blank, letters, unknown countries and non-ASCII digits', () => {
		expect(isTaxNumberValid('DE', '')).toBe(false);
		expect(isTaxNumberValid('DE', '  ')).toBe(false);
		expect(isTaxNumberValid('DE', '12/345/6789A')).toBe(false);
		expect(isTaxNumberValid('IT', '1234567890')).toBe(false);
		expect(isTaxNumberValid('DE', '١٢٣٤٥٦٧٨٩٠')).toBe(false);
		expect(isTaxNumberValid('AT', '١٢٣٤٥٦٧٨٩')).toBe(false);
	});
	it('examples are themselves valid', () => {
		expect(isTaxNumberValid('DE', TAX_NUMBER_EXAMPLES.DE)).toBe(true);
		expect(isTaxNumberValid('AT', TAX_NUMBER_EXAMPLES.AT)).toBe(true);
	});
});

describe('resolveOrgCountry', () => {
	it('prefers the VAT country, then the VAT ID prefix, billing country, fallback', () => {
		expect(resolveOrgCountry({ vatCountryCode: 'at', vatId: 'DE123' })).toBe('AT');
		expect(resolveOrgCountry({ vatCountryCode: '', vatId: 'de123456789' })).toBe('DE');
		expect(resolveOrgCountry({ vatId: '12345', billingCountryCode: 'at' })).toBe('AT');
		expect(resolveOrgCountry({ vatId: '', billingCountryCode: '', fallback: 'de' })).toBe('DE');
		expect(resolveOrgCountry({})).toBe('');
	});
});

describe('vatRateIsPositive', () => {
	it('parses decimals', () => {
		expect(vatRateIsPositive('19.00')).toBe(true);
		expect(vatRateIsPositive('0.00')).toBe(false);
		expect(vatRateIsPositive(null)).toBe(false);
		expect(vatRateIsPositive('')).toBe(false);
		expect(vatRateIsPositive(7)).toBe(true);
	});
});

describe('schemeBlockers', () => {
	const ok = {
		scheme: 'de_19' as const,
		country: 'DE',
		vatIdValidated: true,
		taxNumber: '',
		vatRate: '0.00',
		vatRateZeroConfirmed: false
	};
	it('is empty for a valid DE setup (tax number optional)', () => {
		expect(schemeBlockers(ok)).toEqual([]);
	});
	it('is always empty when turning the scheme off', () => {
		expect(schemeBlockers({ ...ok, scheme: 'none', country: 'IT', vatRate: '19' })).toEqual([]);
	});
	it('flags a wrong country', () => {
		expect(schemeBlockers({ ...ok, country: 'AT' })).toContain('wrong_country');
		expect(schemeBlockers({ ...ok, country: '' })).toContain('wrong_country');
	});
	it('requires a validated VAT ID for DE only', () => {
		expect(schemeBlockers({ ...ok, vatIdValidated: false })).toEqual(['vat_id_not_validated']);
		const at = { ...ok, scheme: 'at_6_1_27' as const, country: 'AT', taxNumber: '12-345/6789' };
		expect(schemeBlockers({ ...at, vatIdValidated: false })).toEqual([]);
	});
	it('requires a tax number for AT and validates it when given', () => {
		const at = { ...ok, scheme: 'at_6_1_27' as const, country: 'AT', vatIdValidated: false };
		expect(schemeBlockers(at)).toEqual(['tax_number_required']);
		expect(schemeBlockers({ ...at, taxNumber: '123' })).toEqual(['tax_number_invalid']);
		expect(schemeBlockers({ ...ok, taxNumber: '123' })).toEqual(['tax_number_invalid']);
	});
	it('does not require a tax number for AT when the VAT ID is validated', () => {
		const at = { ...ok, scheme: 'at_6_1_27' as const, country: 'AT', vatIdValidated: true };
		expect(schemeBlockers(at)).toEqual([]);
		expect(schemeBlockers({ ...at, taxNumber: '123' })).toEqual(['tax_number_invalid']);
	});
	it('needs a confirmed zero rate when the default is positive', () => {
		expect(schemeBlockers({ ...ok, vatRate: '19.00' })).toEqual(['vat_rate_not_zero']);
		expect(schemeBlockers({ ...ok, vatRate: '19.00', vatRateZeroConfirmed: true })).toEqual([]);
	});
});
