/**
 * Outbound-link construction for embeds.
 *
 * Every interactive flow (RSVP, application, checkout) lives in the Revel web
 * app, so an embed only ever *links out*. The attribution convention is a
 * cross-repo contract (frontend #689 / backend #791 / infra #37):
 *
 *   utm_source   = embed
 *   utm_medium   = event | list | series | oembed   (which surface linked out)
 *   utm_campaign = <org slug>                       (whose embed it was)
 *   utm_content  = <host page hostname>             (appended by the loader)
 *
 * `utm_content` is not known server-side: the loader script reads
 * `location.hostname` on the host page and puts it on the iframe URL, and the
 * embed echoes it back onto its outbound links.
 */

import type { EmbedMedium } from './constants';

/** Everything a component needs to build attributed outbound links. */
export interface EmbedLinkContext extends EmbedLinkAttribution {
	/** Origin the embed is served from, e.g. `https://letsrevel.io`. */
	origin: string;
}

export interface EmbedLinkAttribution {
	medium: EmbedMedium;
	/** Organization slug — the campaign dimension. */
	campaign: string;
	/** Host page hostname, forwarded by the loader script. */
	content?: string | null;
}

/**
 * Build an absolute, attributed link from an embed to the Revel web app.
 *
 * @param origin Origin the embed itself is served from (e.g. `https://letsrevel.io`).
 * @param path   Absolute app path, e.g. `/events/acme/summer-party`.
 */
export function buildEmbedLink(
	origin: string,
	path: string,
	{ medium, campaign, content }: EmbedLinkAttribution
): string {
	const url = new URL(path, origin);
	url.searchParams.set('utm_source', 'embed');
	url.searchParams.set('utm_medium', medium);
	url.searchParams.set('utm_campaign', campaign);
	if (content) url.searchParams.set('utm_content', content);
	return url.toString();
}

/** App path for an event detail page. */
export function eventPath(orgSlug: string, eventSlug: string): string {
	return `/events/${encodeURIComponent(orgSlug)}/${encodeURIComponent(eventSlug)}`;
}

/** App path for an event-series page. */
export function seriesPath(orgSlug: string, seriesSlug: string): string {
	return `/events/${encodeURIComponent(orgSlug)}/series/${encodeURIComponent(seriesSlug)}`;
}

/** App path for an organization profile. */
export function organizationPath(orgSlug: string): string {
	return `/org/${encodeURIComponent(orgSlug)}`;
}

/**
 * The "Powered by Revel" link. It is attribution for *us* rather than for the
 * organizer, so it carries no campaign of its own beyond the org slug — same
 * convention, so the analytics grouping stays uniform.
 */
export function poweredByLink(origin: string, attribution: EmbedLinkAttribution): string {
	return buildEmbedLink(origin, '/', attribution);
}
