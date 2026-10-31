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
	it('labels the small-business fields', () => {
		expect(missingFieldLabel('small_business_scheme')).toMatch(/small-business scheme/);
		expect(missingFieldLabel('tax_registration_number')).toMatch(/Steuernummer/);
	});
	it('makes the VAT ID label country- and scheme-aware', () => {
		expect(missingFieldLabel('vat_id', { country: 'AT', scheme: 'none' })).toMatch(
			/Kleinunternehmer, a small-business scheme declaration with your Steuernummer/
		);
		expect(missingFieldLabel('vat_id', { country: 'AT', scheme: 'at_6_1_27' })).toMatch(/VIES/);
		expect(missingFieldLabel('vat_id', { country: 'DE', scheme: 'none' })).toMatch(
			/also required under § 19 UStG|Also required under § 19 UStG/i
		);
		expect(missingFieldLabel('vat_id', { country: 'DE', scheme: 'de_19' })).toMatch(/USt-IdNr/);
		expect(missingFieldLabel('vat_id', { country: 'IT', scheme: 'none' })).toBe(
			missingFieldLabel('vat_id')
		);
		expect(missingFieldLabels(['vat_id'], { country: 'DE' })[0]).toMatch(/USt-IdNr/);
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
	it('always names the country in English, whatever the UI locale', async () => {
		// The persisted text must not flip language with the editor's locale.
		const { composeLegacyAddress } = await import('./postal-address');
		expect(composeLegacyAddress(addr, 'de')).toContain('Deutschland');
		expect(legacyAddressForPayload(addr, '')).toContain('Germany');
		expect(legacyAddressForPayload(addr, '')).not.toContain('Deutschland');
	});
	it('clears the legacy text when a saved structured address is blanked entirely', () => {
		expect(legacyAddressForPayload(emptyPostalAddress(), 'Old', addr)).toBe('');
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
	it('sends billing_address "" when a saved structured address is blanked', () => {
		const body = buildBillingInfoPayload({
			...base,
			address: emptyPostalAddress(),
			savedAddress: addr
		});
		expect(body.billing_address).toBe('');
		expect(body.billing_address_line1).toBe('');
	});

	describe('vat_rate / vat_exemption_reason (zero-rate guard trigger)', () => {
		const saved = {
			...base,
			vatRate: '0.00',
			vatExemptionReason: '',
			savedVatRate: '0.00',
			savedExemptionReason: ''
		};
		it('omits both keys when unchanged, so an address-only save passes the BE guard', () => {
			const body = buildBillingInfoPayload(saved);
			expect(body).not.toHaveProperty('vat_rate');
			expect(body).not.toHaveProperty('vat_exemption_reason');
			expect(body.billing_name).toBe('ACME');
			expect(body.billing_city).toBe('Berlin');
			expect(body.vat_country_code).toBe('DE');
		});
		it('compares normalised values (numeric rate, trimmed reason)', () => {
			const body = buildBillingInfoPayload({
				...saved,
				vatRate: '0',
				vatExemptionReason: '  ',
				savedExemptionReason: ' '
			});
			expect(body).not.toHaveProperty('vat_rate');
			expect(body).not.toHaveProperty('vat_exemption_reason');
		});
		it('includes each key only when it changed', () => {
			const rate = buildBillingInfoPayload({ ...saved, vatRate: '19' });
			expect(rate.vat_rate).toBe(19);
			expect(rate).not.toHaveProperty('vat_exemption_reason');
			const reason = buildBillingInfoPayload({ ...saved, vatExemptionReason: ' Art. 8 ' });
			expect(reason.vat_exemption_reason).toBe('Art. 8');
			expect(reason).not.toHaveProperty('vat_rate');
			const cleared = buildBillingInfoPayload({ ...saved, vatRate: '' });
			expect(cleared.vat_rate).toBeNull();
		});
	});
});
