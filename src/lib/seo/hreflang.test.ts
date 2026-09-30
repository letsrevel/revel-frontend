import { describe, it, expect } from 'vitest';
import { landingPageHreflang } from '$lib/seo/hreflang';

describe('landingPageHreflang', () => {
	it('emits en at root, every other locale under its prefix, x-default = en', () => {
		const result = landingPageHreflang('https://letsrevel.io', 'eventbrite-alternative');
		expect(result).toEqual([
			{ lang: 'en', href: 'https://letsrevel.io/eventbrite-alternative' },
			{ lang: 'de', href: 'https://letsrevel.io/de/eventbrite-alternative' },
			{ lang: 'it', href: 'https://letsrevel.io/it/eventbrite-alternative' },
			{ lang: 'fr', href: 'https://letsrevel.io/fr/eventbrite-alternative' },
			{ lang: 'es', href: 'https://letsrevel.io/es/eventbrite-alternative' },
			{ lang: 'pt', href: 'https://letsrevel.io/pt/eventbrite-alternative' },
			{ lang: 'x-default', href: 'https://letsrevel.io/eventbrite-alternative' }
		]);
	});
});
