/**
 * oEmbed (https://oembed.com) support.
 *
 * `GET /oembed?url=…` turns a public Revel page URL into a `rich` oEmbed
 * response whose `html` is an iframe pointing at the matching `/embed/*`
 * surface. Consumers (WordPress, Notion, Slack unfurlers, …) discover the
 * endpoint through the `<link rel="alternate" type="application/json+oembed">`
 * tag emitted by `$lib/seo/SeoHead.svelte`.
 *
 * Everything in this module is pure so the route handler stays a thin shell.
 */

import { EMBED_DEFAULT_DIMENSIONS, type EmbedMedium } from './constants';

export type OembedKind = 'event' | 'series' | 'list';

/**
 * oEmbed discovery URL for a page, for the
 * `<link rel="alternate" type="application/json+oembed">` tag.
 *
 * Built from origin + pathname rather than from the canonical URL, because the
 * canonical carries whatever query string the visitor arrived with (invitation
 * tokens, UTM tags) and none of that belongs in a URL we publish to third-party
 * consumers.
 */
export function oembedDiscoveryUrl(url: URL): string {
	const target = `${url.origin}${url.pathname}`;
	return `${url.origin}/oembed?url=${encodeURIComponent(target)}&format=json`;
}

export interface OembedTarget {
	kind: OembedKind;
	orgSlug: string;
	/** Event or series slug; absent for an organization (list) embed. */
	resourceSlug: string | null;
	/** Path of the `/embed/*` page that renders this target. */
	embedPath: string;
}

/**
 * Map a public Revel page URL onto an embed surface.
 *
 * Returns `null` for anything we do not embed — a foreign origin, an unknown
 * path shape, or a deeper sub-page such as a questionnaire. The caller turns
 * that into a 404, as the oEmbed spec requires for unsupported URLs.
 */
export function resolveOembedTarget(target: URL, siteOrigin: string): OembedTarget | null {
	if (target.origin !== siteOrigin) return null;

	const segments = target.pathname.split('/').filter(Boolean).map(decodeURIComponent);

	// /org/{org_slug} → organization event list
	if (segments.length === 2 && segments[0] === 'org') {
		const orgSlug = segments[1];
		return {
			kind: 'list',
			orgSlug,
			resourceSlug: null,
			embedPath: `/embed/${encodeURIComponent(orgSlug)}`
		};
	}

	if (segments[0] !== 'events') return null;

	// /events/{org_slug}/series/{series_slug}
	if (segments.length === 4 && segments[2] === 'series') {
		const [, orgSlug, , seriesSlug] = segments;
		return {
			kind: 'series',
			orgSlug,
			resourceSlug: seriesSlug,
			embedPath: `/embed/${encodeURIComponent(orgSlug)}/series/${encodeURIComponent(seriesSlug)}`
		};
	}

	// /events/{org_slug}/{event_slug}
	//
	// No need to exclude `series` here: a series URL always has four segments and
	// was already matched above, so a three-segment path is unambiguously an
	// event — including an event whose slug happens to be "series", which
	// `/events/{org}/series` really does route to.
	if (segments.length === 3) {
		const [, orgSlug, eventSlug] = segments;
		return {
			kind: 'event',
			orgSlug,
			resourceSlug: eventSlug,
			embedPath: `/embed/${encodeURIComponent(orgSlug)}/event/${encodeURIComponent(eventSlug)}`
		};
	}

	return null;
}

/**
 * Clamp the advertised iframe box to the consumer's `maxwidth`/`maxheight`.
 *
 * The height is scaled with the width so the card keeps its aspect ratio
 * instead of being cropped, then clamped again by `maxheight`.
 */
export function clampOembedSize(
	kind: OembedKind,
	maxWidth: number | null,
	maxHeight: number | null
): { width: number; height: number } {
	const [defaultWidth, defaultHeight] = EMBED_DEFAULT_DIMENSIONS[kind];

	const width = maxWidth !== null && maxWidth > 0 ? Math.min(defaultWidth, maxWidth) : defaultWidth;
	const scaled = Math.round(defaultHeight * (width / defaultWidth));
	const height = maxHeight !== null && maxHeight > 0 ? Math.min(scaled, maxHeight) : scaled;

	return { width, height: Math.max(height, 1) };
}

/** Positive-integer query parameter, or `null` when absent/absurd. */
export function parseOembedDimension(raw: string | null): number | null {
	if (raw === null || raw.trim() === '') return null;
	const parsed = Number(raw);
	if (!Number.isInteger(parsed) || parsed <= 0) return null;
	return Math.min(parsed, 5000);
}

/** Minimal HTML-attribute escaping for the `html` payload we hand to consumers. */
export function escapeHtmlAttribute(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

export interface OembedIframeInput {
	src: string;
	width: number;
	height: number;
	title: string;
}

/**
 * The `html` field of a `rich` oEmbed response.
 *
 * `max-width:100%` keeps the card usable when a consumer drops it into a
 * column narrower than the advertised width; `loading="lazy"` avoids paying
 * for embeds far below the fold.
 */
export function buildOembedIframeHtml({ src, width, height, title }: OembedIframeInput): string {
	return (
		`<iframe src="${escapeHtmlAttribute(src)}" width="${width}" height="${height}" ` +
		`title="${escapeHtmlAttribute(title)}" loading="lazy" frameborder="0" scrolling="no" ` +
		`style="border:0;max-width:100%;width:100%" referrerpolicy="strict-origin-when-cross-origin"></iframe>`
	);
}

/** `utm_medium` to stamp on links that originate from an oEmbed consumer. */
export const OEMBED_MEDIUM: EmbedMedium = 'oembed';
