import { describe, it, expect } from 'vitest';
import { LANGS, X_DEFAULT, SITE_NAME, TWITTER_SITE, OG_LOCALE } from '$lib/seo/constants';

describe('seo constants', () => {
	it('exports the three supported languages', () => {
		expect(LANGS).toEqual(['en', 'de', 'it']);
	});

	it('maps each lang to an OG locale', () => {
		expect(OG_LOCALE).toEqual({ en: 'en_US', de: 'de_DE', it: 'it_IT' });
	});

	it('defines x-default sentinel', () => {
		expect(X_DEFAULT).toBe('x-default');
	});

	it('defines site name and twitter handle', () => {
		expect(SITE_NAME).toBe('Revel');
		expect(TWITTER_SITE).toBe('@letsrevel');
	});
});
