import { describe, it, expect } from 'vitest';
import {
	defaultEmbedConfig,
	embedIframeSnippet,
	embedIframeUrl,
	embedPagePath,
	embedScriptSnippet,
	parseTagsInput,
	supportsListFilters,
	type EmbedBuilderConfig
} from './snippet';
import { parseEmbedListFilters, parseEmbedTheme } from './params';

const ORIGIN = 'https://letsrevel.io';

function config(overrides: Partial<EmbedBuilderConfig> = {}): EmbedBuilderConfig {
	return { ...defaultEmbedConfig('acme'), ...overrides };
}

describe('embedPagePath', () => {
	it('points a list embed at the organization', () => {
		expect(embedPagePath(config())).toBe('/embed/acme');
	});

	it('points event and series embeds at their sub-routes', () => {
		expect(embedPagePath(config({ kind: 'event', resourceSlug: 'summer-party' }))).toBe(
			'/embed/acme/event/summer-party'
		);
		expect(embedPagePath(config({ kind: 'series', resourceSlug: 'monthly' }))).toBe(
			'/embed/acme/series/monthly'
		);
	});

	it('falls back to the list while no resource is picked yet', () => {
		expect(embedPagePath(config({ kind: 'event', resourceSlug: null }))).toBe('/embed/acme');
	});

	it('encodes slugs', () => {
		expect(embedPagePath(config({ orgSlug: 'a b/c' }))).toBe('/embed/a%20b%2Fc');
	});
});

describe('embedIframeUrl', () => {
	it('emits no query string for a default configuration', () => {
		expect(embedIframeUrl(ORIGIN, config())).toBe('https://letsrevel.io/embed/acme');
	});

	it('emits only the parameters that differ from the defaults', () => {
		const url = new URL(
			embedIframeUrl(
				ORIGIN,
				config({
					theme: 'dark',
					lang: 'it',
					pageSize: 12,
					includePast: true,
					orderBy: '-start',
					tags: ['music', 'queer']
				})
			)
		);

		expect(url.searchParams.get('theme')).toBe('dark');
		expect(url.searchParams.get('lang')).toBe('it');
		expect(url.searchParams.get('page_size')).toBe('12');
		expect(url.searchParams.get('include_past')).toBe('true');
		expect(url.searchParams.get('order_by')).toBe('-start');
		expect(url.searchParams.get('tags')).toBe('music,queer');
	});

	it('omits list filters for a single-event embed, which cannot use them', () => {
		const url = new URL(
			embedIframeUrl(
				ORIGIN,
				config({ kind: 'event', resourceSlug: 'summer-party', pageSize: 12, includePast: true })
			)
		);

		expect(url.searchParams.has('page_size')).toBe(false);
		expect(url.searchParams.has('include_past')).toBe(false);
	});

	it('clamps page size to what the embed surface accepts', () => {
		const tooBig = new URL(embedIframeUrl(ORIGIN, config({ pageSize: 500 })));
		expect(tooBig.searchParams.get('page_size')).toBe('24');

		const tooSmall = new URL(embedIframeUrl(ORIGIN, config({ pageSize: 0 })));
		expect(tooSmall.searchParams.get('page_size')).toBe('1');
	});

	// The whole point of the builder is that what it shows and what it copies are
	// read back identically by the routes that serve the embed.
	it('round-trips through the parsers the embed routes use', () => {
		const built = new URL(
			embedIframeUrl(
				ORIGIN,
				config({ theme: 'light', pageSize: 9, includePast: true, orderBy: '-start', tags: ['art'] })
			)
		);
		const filters = parseEmbedListFilters(built.searchParams);

		expect(parseEmbedTheme(built.searchParams.get('theme'))).toBe('light');
		expect(filters.pageSize).toBe(9);
		expect(filters.includePast).toBe(true);
		expect(filters.orderBy).toBe('-start');
		expect(filters.tags).toEqual(['art']);
	});
});

describe('embedScriptSnippet', () => {
	it('produces a minimal loader tag for a default configuration', () => {
		expect(embedScriptSnippet(ORIGIN, config())).toBe(
			`<script\n  src="https://letsrevel.io/embed-v1.js"\n  data-revel-org="acme"\n  async\n></script>`
		);
	});

	it('names the resource with the attribute matching the target kind', () => {
		expect(
			embedScriptSnippet(ORIGIN, config({ kind: 'event', resourceSlug: 'summer-party' }))
		).toContain('data-revel-event="summer-party"');
		expect(
			embedScriptSnippet(ORIGIN, config({ kind: 'series', resourceSlug: 'monthly' }))
		).toContain('data-revel-series="monthly"');
	});

	it('pins the height only when auto-resize is turned off', () => {
		expect(embedScriptSnippet(ORIGIN, config())).not.toContain('data-revel-height');

		const pinned = embedScriptSnippet(ORIGIN, config({ autoResize: false, height: 640 }));
		expect(pinned).toContain('data-revel-height="640"');
		expect(pinned).toContain('data-revel-resize="false"');
	});

	it('clamps an out-of-range height', () => {
		expect(embedScriptSnippet(ORIGIN, config({ autoResize: false, height: 99999 }))).toContain(
			'data-revel-height="2000"'
		);
	});

	it('escapes a title before it lands in a third-party page', () => {
		const snippet = embedScriptSnippet(ORIGIN, config({ title: 'Ann"s <events> & more' }));
		expect(snippet).toContain('data-revel-title="Ann&quot;s &lt;events&gt; &amp; more"');
	});
});

describe('embedIframeSnippet', () => {
	it('always carries a concrete height, since a bare iframe cannot resize itself', () => {
		expect(embedIframeSnippet(ORIGIN, config())).toContain('height="820"');
		expect(embedIframeSnippet(ORIGIN, config({ kind: 'event', resourceSlug: 'x' }))).toContain(
			'height="460"'
		);
		expect(embedIframeSnippet(ORIGIN, config({ autoResize: false, height: 500 }))).toContain(
			'height="500"'
		);
	});

	it('embeds the same URL the preview renders', () => {
		const cfg = config({ theme: 'dark', tags: ['music'] });
		expect(embedIframeSnippet(ORIGIN, cfg)).toContain(
			`src="${embedIframeUrl(ORIGIN, cfg).replace(/&/g, '&amp;')}"`
		);
	});
});

describe('parseTagsInput', () => {
	it('splits on commas and newlines and drops blanks', () => {
		expect(parseTagsInput(' music, ,queer\n  art \n\n')).toEqual(['music', 'queer', 'art']);
	});

	it('returns an empty list for empty input', () => {
		expect(parseTagsInput('   ')).toEqual([]);
	});
});

describe('supportsListFilters', () => {
	it('covers the surfaces that forward filters to the API', () => {
		expect(supportsListFilters('list')).toBe(true);
		expect(supportsListFilters('series')).toBe(true);
		expect(supportsListFilters('event')).toBe(false);
	});
});
