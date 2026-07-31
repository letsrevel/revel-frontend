/**
 * Snippet generation for the organizer-facing embed builder.
 *
 * Issue #689 shipped the embed *surface* — the `/embed/*` routes, the
 * `embed-v1.js` loader and oEmbed — but nothing in the app ever told an
 * organizer how to use it: the only documentation was the comment block at the
 * top of `static/embed-v1.js`. This module is the other half: it turns a
 * builder configuration into the exact markup someone pastes into their own
 * website, and into the `/embed/*` URL that backs the live preview.
 *
 * Everything here is pure so the snippets can be unit tested without a browser,
 * and so the preview URL and the copied snippet are guaranteed to be built from
 * the same code path — a preview that disagrees with the snippet is worse than
 * no preview at all.
 *
 * NOTE: the snippet strings contain a literal `</script>` sequence, which is
 * why they live in a `.ts` module rather than inline in a Svelte component —
 * inside a component's `<script>` block that sequence would close the block.
 */

import {
	EMBED_DEFAULT_DIMENSIONS,
	EMBED_DEFAULT_PAGE_SIZE,
	EMBED_MAX_PAGE_SIZE,
	type EmbedTheme
} from './constants';

/**
 * Filename of the loader script served from `static/`.
 *
 * THE FILENAME IS THE VERSION (see the loader's own header): a breaking change
 * ships as `embed-v2.js`, and this constant moves with it.
 */
export const EMBED_LOADER_FILENAME = 'embed-v1.js';

/** Height the loader falls back to before the first auto-resize message. */
export const EMBED_FALLBACK_HEIGHT = 420;

/** Bounds for the manual height input, so the UI cannot produce silly markup. */
export const EMBED_MIN_HEIGHT = 200;
export const EMBED_MAX_HEIGHT = 2000;

/** What an embed points at. Mirrors the loader's org/event/series attributes. */
export type EmbedTargetKind = 'list' | 'event' | 'series';

/** Everything the builder UI collects. */
export interface EmbedBuilderConfig {
	kind: EmbedTargetKind;
	orgSlug: string;
	/** Event or series slug. Ignored (and irrelevant) when `kind` is `list`. */
	resourceSlug: string | null;
	theme: EmbedTheme;
	/** `null` follows the visitor's own language, like the rest of the app. */
	lang: string | null;
	/** Accessible name of the iframe. `null` keeps the loader's default. */
	title: string | null;
	/** Size the frame to its content via postMessage (loader snippet only). */
	autoResize: boolean;
	/** Fixed pixel height, used when `autoResize` is off. */
	height: number;
	// ── List filters. Honoured by the list AND series surfaces, ignored by a
	//    single-event embed, which has nothing to filter.
	pageSize: number;
	includePast: boolean;
	orderBy: 'start' | '-start';
	tags: string[];
}

/** A fresh configuration for an organization, matching every route default. */
export function defaultEmbedConfig(orgSlug: string): EmbedBuilderConfig {
	return {
		kind: 'list',
		orgSlug,
		resourceSlug: null,
		theme: 'auto',
		lang: null,
		title: null,
		autoResize: true,
		height: EMBED_FALLBACK_HEIGHT,
		pageSize: EMBED_DEFAULT_PAGE_SIZE,
		includePast: false,
		orderBy: 'start',
		tags: []
	};
}

/** Do list filters apply to this target? A single event has nothing to filter. */
export function supportsListFilters(kind: EmbedTargetKind): boolean {
	return kind === 'list' || kind === 'series';
}

/** Comma- or newline-separated free text → a clean tag list. */
export function parseTagsInput(raw: string): string[] {
	return raw
		.split(/[\n,]/)
		.map((tag) => tag.trim())
		.filter((tag) => tag.length > 0);
}

function clamp(value: number, min: number, max: number): number {
	if (!Number.isFinite(value)) return min;
	return Math.min(Math.max(Math.round(value), min), max);
}

/** Path of the `/embed/*` page a configuration renders. */
export function embedPagePath(config: EmbedBuilderConfig): string {
	const base = `/embed/${encodeURIComponent(config.orgSlug)}`;
	if (config.kind === 'list' || !config.resourceSlug) return base;
	const segment = config.kind === 'event' ? 'event' : 'series';
	return `${base}/${segment}/${encodeURIComponent(config.resourceSlug)}`;
}

/**
 * Absolute URL of the embed document.
 *
 * Only non-default parameters are emitted: a snippet full of values that merely
 * restate the defaults is harder to read and pins behaviour the organizer never
 * actually chose.
 */
export function embedIframeUrl(origin: string, config: EmbedBuilderConfig): string {
	const url = new URL(embedPagePath(config), origin);
	if (config.theme !== 'auto') url.searchParams.set('theme', config.theme);
	if (config.lang) url.searchParams.set('lang', config.lang);

	if (supportsListFilters(config.kind)) {
		const pageSize = clamp(config.pageSize, 1, EMBED_MAX_PAGE_SIZE);
		if (pageSize !== EMBED_DEFAULT_PAGE_SIZE) url.searchParams.set('page_size', String(pageSize));
		if (config.includePast) url.searchParams.set('include_past', 'true');
		if (config.orderBy === '-start') url.searchParams.set('order_by', '-start');
		if (config.tags.length > 0) url.searchParams.set('tags', config.tags.join(','));
	}

	return url.toString();
}

/** `data-*` attributes for the loader, in the order the loader reads them. */
function loaderAttributes(config: EmbedBuilderConfig): [string, string][] {
	const attributes: [string, string][] = [['data-revel-org', config.orgSlug]];

	if (config.kind === 'event' && config.resourceSlug) {
		attributes.push(['data-revel-event', config.resourceSlug]);
	} else if (config.kind === 'series' && config.resourceSlug) {
		attributes.push(['data-revel-series', config.resourceSlug]);
	}

	if (config.theme !== 'auto') attributes.push(['data-revel-theme', config.theme]);
	if (config.lang) attributes.push(['data-revel-lang', config.lang]);

	if (supportsListFilters(config.kind)) {
		if (config.tags.length > 0) attributes.push(['data-revel-tags', config.tags.join(',')]);
		if (config.includePast) attributes.push(['data-revel-include-past', 'true']);
		if (config.orderBy === '-start') attributes.push(['data-revel-order-by', '-start']);
		const pageSize = clamp(config.pageSize, 1, EMBED_MAX_PAGE_SIZE);
		if (pageSize !== EMBED_DEFAULT_PAGE_SIZE) {
			attributes.push(['data-revel-page-size', String(pageSize)]);
		}
	}

	if (!config.autoResize) {
		attributes.push([
			'data-revel-height',
			String(clamp(config.height, EMBED_MIN_HEIGHT, EMBED_MAX_HEIGHT))
		]);
		attributes.push(['data-revel-resize', 'false']);
	}

	if (config.title) attributes.push(['data-revel-title', config.title]);

	return attributes;
}

/**
 * Escape a value for an HTML double-quoted attribute.
 *
 * Slugs are tame, but the iframe title is free text an organizer types, and it
 * is pasted straight into someone else's page — so it gets escaped like any
 * other untrusted attribute value.
 */
function escapeAttribute(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

/** The recommended snippet: the loader script, which can auto-resize itself. */
export function embedScriptSnippet(origin: string, config: EmbedBuilderConfig): string {
	const src = new URL(`/${EMBED_LOADER_FILENAME}`, origin).toString();
	const lines = [
		`  src="${escapeAttribute(src)}"`,
		...loaderAttributes(config).map(([name, value]) => `  ${name}="${escapeAttribute(value)}"`),
		'  async'
	];
	return `<script\n${lines.join('\n')}\n></script>`;
}

/**
 * The no-JavaScript fallback, for CMSes that strip `<script>` tags.
 *
 * A bare iframe cannot receive the auto-resize message, so it always carries a
 * concrete height — the surface's advertised default when auto-resize is on.
 */
export function embedIframeSnippet(origin: string, config: EmbedBuilderConfig): string {
	const [width, defaultHeight] = EMBED_DEFAULT_DIMENSIONS[config.kind];
	const height = config.autoResize
		? defaultHeight
		: clamp(config.height, EMBED_MIN_HEIGHT, EMBED_MAX_HEIGHT);
	const title = config.title ?? 'Events on Revel';

	return [
		'<iframe',
		`  src="${escapeAttribute(embedIframeUrl(origin, config))}"`,
		`  title="${escapeAttribute(title)}"`,
		`  width="${width}"`,
		`  height="${height}"`,
		'  loading="lazy"',
		'  referrerpolicy="strict-origin-when-cross-origin"',
		'  style="width: 100%; max-width: 100%; border: 0;"',
		'></iframe>'
	].join('\n');
}
