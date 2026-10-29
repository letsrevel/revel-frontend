import { describe, it, expect } from 'vitest';
import {
	buildBillingInfoPayload,
	isAddressBlank,
	legacyAddressForPayload,
	missingFieldLabel,
	missingFieldLabels
} from './einvoice';
import { emptyPostalAddress } from './postal-address';

const addr = {
	line1: ' Main St 1 ',
	line2: '',
	postalCode: '10115',
	city: 'Berlin',
	subdivision: '',
	countryCode: 'DE'
};

describe('missing-field labels', () => {
	it('maps every known value to a human label', () => {
		expect(missingFieldLabel('billing_address_line1')).toBe('Street and number');
		expect(missingFieldLabel('billing_postal_code')).toBe('Postal code');
		expect(missingFieldLabel('billing_city')).toBe('City');
		expect(missingFieldLabel('billing_country_code')).toBe('Country');
		expect(missingFieldLabel('billing_name')).toBe('Billing name');
		expect(missingFieldLabel('vat_id')).toMatch(/VIES/);
		expect(missingFieldLabel('vat_exemption_reason')).toMatch(/exemption reason/);
	});
	it('falls back to the raw string for unknown values', () => {
		expect(missingFieldLabels(['billing_city', 'something_new'])).toEqual([
			'City',
			'something_new'
		]);
		expect(missingFieldLabels(undefined)).toEqual([]);
	});
});

describe('legacy address handling', () => {
	it('keeps the existing legacy text when the structured address is empty', () => {
		expect(isAddressBlank(emptyPostalAddress())).toBe(true);
		expect(legacyAddressForPayload(emptyPostalAddress(), 'Old St 5, Rome')).toBe('Old St 5, Rome');
	});
	it('composes the legacy text from a structured address', () => {
		expect(legacyAddressForPayload(addr, 'Old')).toBe('Main St 1\n10115 Berlin\nGermany');
	});
});

describe('buildBillingInfoPayload', () => {
	const base = {
		countryCode: 'DE',
		vatRate: '19',
		billingName: 'ACME',
		billingEmail: 'a@b.c',
		vatExemptionReason: '  Art. 132(1)(n)  ',
		address: addr,
		existingLegacyAddress: 'Old'
	};
	it('sends composed legacy text, structured fields and a trimmed exemption reason', () => {
		const body = buildBillingInfoPayload(base);
		expect(body.billing_address).toBe('Main St 1\n10115 Berlin\nGermany');
		expect(body.billing_address_line1).toBe('Main St 1');
		expect(body.billing_country_code).toBe('DE');
		expect(body.vat_exemption_reason).toBe('Art. 132(1)(n)');
		expect(body.vat_rate).toBe(19);
	});
	it('does not clobber legacy text when the structured form is empty', () => {
		const body = buildBillingInfoPayload({ ...base, address: emptyPostalAddress() });
		expect(body.billing_address).toBe('Old');
		expect(body.billing_address_line1).toBe('');
	});
});
