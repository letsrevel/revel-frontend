import { SITE_NAME } from '../constants';

export interface WebSiteJsonLd {
	'@context': 'https://schema.org';
	'@type': 'WebSite';
	name: string;
	url: string;
	description?: string;
	potentialAction?: {
		'@type': 'SearchAction';
		target: { '@type': 'EntryPoint'; urlTemplate: string };
		'query-input': string;
	};
}

export function generateWebSiteJsonLd(origin: string): WebSiteJsonLd {
	return {
		'@context': 'https://schema.org',
		'@type': 'WebSite',
		name: SITE_NAME,
		url: origin,
		description:
			'Community-focused event management platform. Discover events, connect with organizers, and create unforgettable experiences.',
		potentialAction: {
			'@type': 'SearchAction',
			target: {
				'@type': 'EntryPoint',
				urlTemplate: `${origin}/events?search={search_term_string}`
			},
			'query-input': 'required name=search_term_string'
		}
	};
}
