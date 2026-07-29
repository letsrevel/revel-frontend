import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	buildOembedIframeHtml,
	clampOembedSize,
	parseOembedDimension,
	resolveOembedTarget,
	type OembedTarget
} from '$lib/embed/oembed';
import { EMBED_CACHE_CONTROL } from '$lib/embed/constants';
import { SITE_NAME } from '$lib/seo/constants';
import {
	eventpublicdetailsGetEventBySlugs,
	eventseriesGetEventSeriesBySlugs,
	organizationGetOrganization
} from '$lib/api';
import { getBackendUrl } from '$lib/utils/url';

/** oEmbed metadata for a target, or `null` when the resource does not exist. */
interface ResolvedResource {
	title: string;
	authorName: string;
	authorPath: string;
	thumbnailUrl: string | null;
}

async function describeTarget(
	target: OembedTarget,
	fetch: typeof globalThis.fetch
): Promise<ResolvedResource | null> {
	if (target.kind === 'event') {
		const { data } = await eventpublicdetailsGetEventBySlugs({
			fetch,
			path: { org_slug: target.orgSlug, event_slug: target.resourceSlug ?? '' }
		});
		if (!data) return null;
		return {
			title: data.name,
			authorName: data.organization.name,
			authorPath: `/org/${data.organization.slug}`,
			thumbnailUrl: getBackendUrl(data.cover_art_social_url ?? data.cover_art)
		};
	}

	if (target.kind === 'series') {
		const { data } = await eventseriesGetEventSeriesBySlugs({
			fetch,
			path: { org_slug: target.orgSlug, series_slug: target.resourceSlug ?? '' }
		});
		if (!data) return null;
		return {
			title: data.name,
			authorName: data.organization.name,
			authorPath: `/org/${data.organization.slug}`,
			thumbnailUrl: getBackendUrl(data.cover_art_social_url ?? data.cover_art)
		};
	}

	const { data } = await organizationGetOrganization({ fetch, path: { slug: target.orgSlug } });
	if (!data) return null;
	return {
		title: data.name,
		authorName: data.name,
		authorPath: `/org/${data.slug}`,
		thumbnailUrl: getBackendUrl(data.cover_art_social_url ?? data.cover_art)
	};
}

/**
 * oEmbed provider endpoint — https://oembed.com
 *
 * `GET /oembed?url=<public Revel page>&format=json[&maxwidth=&maxheight=]`
 *
 * Returns a `rich` response whose `html` is an iframe pointing at the matching
 * `/embed/*` page. Consumers find this endpoint through the
 * `<link rel="alternate" type="application/json+oembed">` tag that
 * `$lib/seo/SeoHead.svelte` emits on event, organization and series pages.
 *
 * Implemented as a `+server.ts` route for the same reason `feed.xml` is: it is
 * a public, cacheable, non-HTML representation of content we already render.
 */
export const GET: RequestHandler = async ({ url, fetch, setHeaders }) => {
	const rawTargetUrl = url.searchParams.get('url');
	if (!rawTargetUrl) {
		error(400, 'Missing required "url" parameter');
	}

	const format = url.searchParams.get('format');
	if (format !== null && format !== 'json') {
		// The spec asks for 501 when the requested format is not supported.
		error(501, 'Only the json format is supported');
	}

	let targetUrl: URL;
	try {
		targetUrl = new URL(rawTargetUrl);
	} catch {
		error(404, 'Unsupported URL');
	}

	const target = resolveOembedTarget(targetUrl, url.origin);
	if (!target) {
		error(404, 'Unsupported URL');
	}

	// Confirm the resource actually exists and is publicly visible. The lookup is
	// anonymous, so a private event yields the same 404 as a nonexistent one —
	// oEmbed must never become a probe for non-public content.
	const resource = await describeTarget(target, fetch);
	if (!resource) {
		error(404, 'Unsupported URL');
	}

	const { width, height } = clampOembedSize(
		target.kind,
		parseOembedDimension(url.searchParams.get('maxwidth')),
		parseOembedDimension(url.searchParams.get('maxheight'))
	);

	// `src=oembed` makes the embed stamp `utm_medium=oembed` on its outbound
	// links: an oEmbed consumer's page is not one we can name (there is no host
	// hostname to read), so the medium is what carries the attribution.
	const iframeSrc = new URL(target.embedPath, url.origin);
	iframeSrc.searchParams.set('src', 'oembed');

	setHeaders({ 'cache-control': EMBED_CACHE_CONTROL });

	return json({
		version: '1.0',
		type: 'rich',
		provider_name: SITE_NAME,
		provider_url: url.origin,
		title: resource.title,
		author_name: resource.authorName,
		author_url: `${url.origin}${resource.authorPath}`,
		...(resource.thumbnailUrl ? { thumbnail_url: resource.thumbnailUrl } : {}),
		width,
		height,
		cache_age: 3600,
		html: buildOembedIframeHtml({
			src: iframeSrc.toString(),
			width,
			height,
			title: resource.title
		})
	});
};
