import { describe, it, expect } from 'vitest';
import {
	parseEmbedTheme,
	parseEmbedTags,
	parseEmbedListFilters,
	sanitizeUtmContent
} from './params';
import { EMBED_DEFAULT_PAGE_SIZE, EMBED_MAX_PAGE_SIZE, isEmbedPath } from './constants';

const params = (query: string): URLSearchParams => new URLSearchParams(query);

describe('isEmbedPath', () => {
	it('matches the embed surface and nothing adjacent to it', () => {
		expect(isEmbedPath('/embed')).toBe(true);
		expect(isEmbedPath('/embed/acme')).toBe(true);
		expect(isEmbedPath('/embed/acme/event/party')).toBe(true);

		expect(isEmbedPath('/')).toBe(false);
		expect(isEmbedPath('/events')).toBe(false);
		// A route that merely starts with the same letters must not be relaxed.
		expect(isEmbedPath('/embedded-tools')).toBe(false);
	});
});

describe('parseEmbedTheme', () => {
	it('accepts the three known themes', () => {
		expect(parseEmbedTheme('light')).toBe('light');
		expect(parseEmbedTheme('dark')).toBe('dark');
		expect(parseEmbedTheme('auto')).toBe('auto');
	});

	it('falls back to auto for anything else', () => {
		expect(parseEmbedTheme(null)).toBe('auto');
		expect(parseEmbedTheme('')).toBe('auto');
		expect(parseEmbedTheme('DARK')).toBe('auto');
		expect(parseEmbedTheme('neon')).toBe('auto');
	});
});

describe('sanitizeUtmContent', () => {
	it('keeps hostname-shaped values', () => {
		expect(sanitizeUtmContent('example.com')).toBe('example.com');
		expect(sanitizeUtmContent('sub.example.co.uk')).toBe('sub.example.co.uk');
		expect(sanitizeUtmContent('localhost:5173')).toBe('localhost:5173');
	});

	it('rejects anything that could escape an attribute or a URL', () => {
		expect(sanitizeUtmContent('"><script>')).toBeNull();
		expect(sanitizeUtmContent('a b')).toBeNull();
		expect(sanitizeUtmContent('example.com/path?x=1')).toBeNull();
		expect(sanitizeUtmContent(null)).toBeNull();
		expect(sanitizeUtmContent('')).toBeNull();
	});
});

describe('parseEmbedTags', () => {
	it('reads repeated params', () => {
		expect(parseEmbedTags(params('tags=music&tags=queer'))).toEqual(['music', 'queer']);
	});

	it('reads a single comma-separated param (what the loader emits)', () => {
		expect(parseEmbedTags(params('tags=music,queer'))).toEqual(['music', 'queer']);
	});

	it('trims and drops empties, and returns null when nothing is left', () => {
		expect(parseEmbedTags(params('tags=%20music%20,,'))).toEqual(['music']);
		expect(parseEmbedTags(params('tags='))).toBeNull();
		expect(parseEmbedTags(params(''))).toBeNull();
	});
});

describe('parseEmbedListFilters', () => {
	it('defaults everything when no filters are given', () => {
		expect(parseEmbedListFilters(params(''))).toEqual({
			tags: null,
			cityId: null,
			eventType: null,
			eventSeries: null,
			includePast: false,
			orderBy: 'start',
			pageSize: EMBED_DEFAULT_PAGE_SIZE
		});
	});

	it('reads the discovery filters', () => {
		const filters = parseEmbedListFilters(
			params(
				'tags=music&city_id=42&event_type=public&event_series=abc&include_past=true&order_by=-start&page_size=10'
			)
		);
		expect(filters).toEqual({
			tags: ['music'],
			cityId: 42,
			eventType: 'public',
			eventSeries: 'abc',
			includePast: true,
			orderBy: '-start',
			pageSize: 10
		});
	});

	it('clamps page_size so a third-party page cannot amplify our API load', () => {
		expect(parseEmbedListFilters(params('page_size=1000')).pageSize).toBe(EMBED_MAX_PAGE_SIZE);
		expect(parseEmbedListFilters(params('page_size=0')).pageSize).toBe(EMBED_DEFAULT_PAGE_SIZE);
		expect(parseEmbedListFilters(params('page_size=-5')).pageSize).toBe(EMBED_DEFAULT_PAGE_SIZE);
		expect(parseEmbedListFilters(params('page_size=abc')).pageSize).toBe(EMBED_DEFAULT_PAGE_SIZE);
	});

	it('rejects unknown enum members rather than forwarding them', () => {
		expect(parseEmbedListFilters(params('event_type=secret')).eventType).toBeNull();
		expect(parseEmbedListFilters(params('order_by=distance')).orderBy).toBe('start');
	});

	it('only shows past events on an explicit opt-in', () => {
		expect(parseEmbedListFilters(params('include_past=1')).includePast).toBe(true);
		expect(parseEmbedListFilters(params('include_past=yes')).includePast).toBe(true);
		expect(parseEmbedListFilters(params('include_past=maybe')).includePast).toBe(false);
		expect(parseEmbedListFilters(params('include_past=false')).includePast).toBe(false);
	});

	it('drops a non-positive city id instead of sending it', () => {
		expect(parseEmbedListFilters(params('city_id=0')).cityId).toBeNull();
		expect(parseEmbedListFilters(params('city_id=-1')).cityId).toBeNull();
		expect(parseEmbedListFilters(params('city_id=1.5')).cityId).toBeNull();
	});
});
