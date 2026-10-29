import { describe, it, expect } from 'vitest';
import {
	ISO_COUNTRY_CODES,
	composeLegacyAddress,
	countryDisplayName,
	countryFromVatId,
	emptyPostalAddress,
	isPostalAddressComplete,
	missingRequiredFields,
	normalizeCountryCode,
	readPostalAddress,
	toBillingFields,
	toBuyerFields
} from './postal-address';

const full = {
	line1: ' Via Roma 1 ',
	line2: '',
	postalCode: '00100',
	city: 'Roma',
	subdivision: 'RM',
	countryCode: 'it'
};

describe('postal-address', () => {
	it('emptyPostalAddress is all blank', () => {
		expect(Object.values(emptyPostalAddress()).every((v) => v === '')).toBe(true);
	});

	it('readPostalAddress maps prefixed keys and nulls to blank', () => {
		const a = readPostalAddress(
			{ buyer_address_line1: 'X', buyer_city: null, buyer_country_code: 'DE' },
			'buyer_'
		);
		expect(a).toEqual({ ...emptyPostalAddress(), line1: 'X', countryCode: 'DE' });
		expect(readPostalAddress(null, 'billing_')).toEqual(emptyPostalAddress());
		expect(readPostalAddress({ billing_postal_code: '1010' }, 'billing_').postalCode).toBe('1010');
	});

	it('toBillingFields / toBuyerFields trim and normalise the country', () => {
		expect(toBillingFields(full)).toEqual({
			billing_address_line1: 'Via Roma 1',
			billing_address_line2: '',
			billing_postal_code: '00100',
			billing_city: 'Roma',
			billing_subdivision: 'RM',
			billing_country_code: 'IT'
		});
		expect(toBuyerFields({ ...full, countryCode: 'el' }).buyer_country_code).toBe('GR');
		expect(toBuyerFields(full).buyer_address_line1).toBe('Via Roma 1');
	});

	it('normalizeCountryCode', () => {
		expect(normalizeCountryCode(' el ')).toBe('GR');
		expect(normalizeCountryCode('de')).toBe('DE');
	});

	it('countryFromVatId', () => {
		expect(countryFromVatId('ATU12345678')).toBe('AT');
		expect(countryFromVatId('el123456789')).toBe('GR');
		expect(countryFromVatId('XI123456789')).toBe('GB');
		expect(countryFromVatId('ZZ123')).toBe('');
		expect(countryFromVatId('1')).toBe('');
	});

	it('missingRequiredFields / isPostalAddressComplete', () => {
		expect(missingRequiredFields(emptyPostalAddress())).toEqual([
			'line1',
			'postalCode',
			'city',
			'countryCode'
		]);
		expect(missingRequiredFields({ ...full, city: '  ' })).toEqual(['city']);
		expect(isPostalAddressComplete(full)).toBe(true);
		expect(isPostalAddressComplete(emptyPostalAddress())).toBe(false);
	});

	it('ISO_COUNTRY_CODES uses GR, has no duplicates', () => {
		expect(ISO_COUNTRY_CODES).toContain('GR');
		expect(ISO_COUNTRY_CODES).not.toContain('EL');
		expect(new Set(ISO_COUNTRY_CODES).size).toBe(ISO_COUNTRY_CODES.length);
		expect(ISO_COUNTRY_CODES.every((c) => /^[A-Z]{2}$/.test(c))).toBe(true);
	});

	it('countryDisplayName localises and falls back', () => {
		expect(countryDisplayName('DE', 'en-US')).toBe('Germany');
		expect(countryDisplayName('DE', 'de-DE')).toBe('Deutschland');
		expect(countryDisplayName('EL', 'en-US')).toBe('Greece');
		expect(countryDisplayName('', 'en-US')).toBe('');
		expect(countryDisplayName('!!', 'en-US')).toBe('!!');
	});

	it('composeLegacyAddress omits blank parts', () => {
		expect(composeLegacyAddress(full, 'en-US')).toBe('Via Roma 1\n00100 Roma\nRM\nItaly');
		expect(composeLegacyAddress(emptyPostalAddress(), 'en-US')).toBe('');
		expect(
			composeLegacyAddress({ ...emptyPostalAddress(), city: 'Wien', countryCode: 'AT' }, 'en-US')
		).toBe('Wien\nAustria');
	});
});
