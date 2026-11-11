import { describe, it, expect } from 'vitest';
import { SUPPORTED_CURRENCY_CODES, currencyDisplayName, currencyOptions } from './currencies';

describe('currencyDisplayName', () => {
	it('localizes names by locale', () => {
		expect(currencyDisplayName('AUD', 'en')).toBe('Australian Dollar');
		expect(currencyDisplayName('AUD', 'de')).toBe('Australischer Dollar');
		expect(currencyDisplayName('AUD', 'it').toLowerCase()).toContain('dollaro australiano');
	});

	it('falls back to the code for invalid input', () => {
		expect(currencyDisplayName('!!', 'en')).toBe('!!');
	});
});

describe('currencyOptions', () => {
	it('covers the whole whitelist in order', () => {
		expect(currencyOptions('en').map((o) => o.value)).toEqual([...SUPPORTED_CURRENCY_CODES]);
		expect(SUPPORTED_CURRENCY_CODES).toHaveLength(30);
	});

	it('labels are "CODE · Name" with no em dash', () => {
		const en = currencyOptions('en');
		expect(en[0]).toEqual({ value: 'AUD', label: 'AUD · Australian Dollar' });
		expect(currencyOptions('de')[0].label).toBe('AUD · Australischer Dollar');
		for (const o of [...en, ...currencyOptions('de')]) expect(o.label).not.toContain('—');
	});
});
