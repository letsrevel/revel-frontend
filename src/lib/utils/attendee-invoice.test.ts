import { describe, it, expect } from 'vitest';
import { buildDraftBuyerUpdate, buyerAddressText, exemptionEntries } from './attendee-invoice';
import { emptyPostalAddress } from './postal-address';

describe('buyerAddressText', () => {
	it('prints the structured block when a street is set', () => {
		const text = buyerAddressText({
			buyer_address: 'legacy',
			buyer_address_line1: 'Main St 1',
			buyer_postal_code: '10115',
			buyer_city: 'Berlin',
			buyer_country_code: 'GR'
		});
		expect(text).toBe('Main St 1\n10115 Berlin\nGreece');
	});
	it('falls back to the legacy text', () => {
		expect(buyerAddressText({ buyer_address: 'legacy', buyer_address_line1: '' })).toBe('legacy');
	});
});

describe('exemptionEntries', () => {
	it('lists category, text and code, skipping empties', () => {
		expect(
			exemptionEntries({ E: { text: 'Exempt', code: 'VATEX-EU-132' }, AE: { text: '', code: '' } })
		).toEqual([{ category: 'E', text: 'Exempt', code: 'VATEX-EU-132' }]);
		expect(exemptionEntries({})).toEqual([]);
	});
});

describe('buildDraftBuyerUpdate', () => {
	it('adds the six buyer_* fields', () => {
		const body = buildDraftBuyerUpdate({
			name: 'A',
			email: '',
			vatId: '',
			vatCountry: '',
			legacyAddress: '',
			address: { ...emptyPostalAddress(), line1: 'X 1', countryCode: 'EL' }
		});
		expect(body.buyer_email).toBeNull();
		expect(body.buyer_address_line1).toBe('X 1');
		expect(body.buyer_country_code).toBe('GR');
		expect(body.buyer_city).toBe('');
	});
});
