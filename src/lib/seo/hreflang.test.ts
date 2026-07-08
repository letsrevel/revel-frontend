import { describe, it, expect } from 'vitest';
import { sameUrlHreflang, landingPageHreflang } from '$lib/seo/hreflang';

describe('sameUrlHreflang', () => {
	it('returns en/de/it/fr/x-default all pointing to the same absolute URL', () => {
		const result = sameUrlHreflang('https://letsrevel.io/events');
		expect(result).toEqual([
			{ lang: 'en', href: 'https://letsrevel.io/events' },
			{ lang: 'de', href: 'https://letsrevel.io/events' },
			{ lang: 'it', href: 'https://letsrevel.io/events' },
			{ lang: 'fr', href: 'https://letsrevel.io/events' },
			{ lang: 'x-default', href: 'https://letsrevel.io/events' }
		]);
	});
});

describe('landingPageHreflang', () => {
	it('emits en at root, de/it/fr under their prefixes, x-default = en', () => {
		const result = landingPageHreflang('https://letsrevel.io', 'eventbrite-alternative');
		expect(result).toEqual([
			{ lang: 'en', href: 'https://letsrevel.io/eventbrite-alternative' },
			{ lang: 'de', href: 'https://letsrevel.io/de/eventbrite-alternative' },
			{ lang: 'it', href: 'https://letsrevel.io/it/eventbrite-alternative' },
			{ lang: 'fr', href: 'https://letsrevel.io/fr/eventbrite-alternative' },
			{ lang: 'x-default', href: 'https://letsrevel.io/eventbrite-alternative' }
		]);
	});
});
