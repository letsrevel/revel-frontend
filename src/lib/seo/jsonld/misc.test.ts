import { describe, it, expect } from 'vitest';
import { generateBreadcrumbJsonLd } from '$lib/seo/jsonld/breadcrumb';
import { generateItemListJsonLd } from '$lib/seo/jsonld/itemlist';
import { generateWebSiteJsonLd } from '$lib/seo/jsonld/website';

describe('breadcrumb jsonld', () => {
	it('numbers items 1..n with the right shape', () => {
		const ld = generateBreadcrumbJsonLd([
			{ name: 'Home', url: '/' },
			{ name: 'Events', url: '/events' }
		]);
		expect(ld['@type']).toBe('BreadcrumbList');
		expect(ld.itemListElement).toHaveLength(2);
		expect(ld.itemListElement[0]).toMatchObject({
			'@type': 'ListItem',
			position: 1,
			name: 'Home',
			item: '/'
		});
		expect(ld.itemListElement[1].position).toBe(2);
	});
});

describe('itemlist jsonld', () => {
	it('returns ItemList with numberOfItems set', () => {
		const ld = generateItemListJsonLd(
			[
				{ name: 'A', url: '/a' },
				{ name: 'B', url: '/b' }
			],
			'My list'
		);
		expect(ld['@type']).toBe('ItemList');
		expect(ld.numberOfItems).toBe(2);
		expect(ld.name).toBe('My list');
	});
});

describe('website jsonld', () => {
	it('emits SearchAction with proper urlTemplate', () => {
		const ld = generateWebSiteJsonLd('https://letsrevel.io');
		expect(ld['@type']).toBe('WebSite');
		expect(ld.potentialAction?.target.urlTemplate).toBe(
			'https://letsrevel.io/events?search={search_term_string}'
		);
	});
});
