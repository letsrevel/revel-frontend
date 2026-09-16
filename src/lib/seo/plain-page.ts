// src/lib/seo/plain-page.ts
import { OG_IMAGE_PATH, SITE_NAME, TWITTER_SITE } from './constants';
import { sameUrlHreflang } from './hreflang';
import type { Robots, SeoConfig } from './types';

export const DEFAULT_OG_IMAGE_ALT = 'Revel — Event Management for Communities';

export function defaultOgImage(origin: string): string {
	return `${origin}${OG_IMAGE_PATH}`;
}

/**
 * Full OG image metadata for the default (non-event/non-org) social card.
 * Dimensions are known and fixed for the static asset, so we advertise them to
 * let unfurlers render the preview without first fetching the image.
 */
export function defaultOgImageMeta(origin: string) {
	return {
		image: defaultOgImage(origin),
		imageAlt: DEFAULT_OG_IMAGE_ALT,
		imageWidth: 1200,
		imageHeight: 630,
		imageType: 'image/png'
	} as const;
}

/** Everything `plainPageSeo` needs from the request, computed once per build. */
export interface PlainPageContext {
	canonical: string;
	origin: string;
	ogLocale: string;
	alts: string[];
}

/**
 * Text-only pages (legal, auth, referral-apply) share one shape: default OG
 * image, summary card, self-referencing hreflang, no JSON-LD. Kept in ONE
 * place so it cannot drift per branch, and so the next one costs three lines.
 */
export function plainPageSeo(
	ctx: PlainPageContext,
	page: { title: string; description: string; robots?: Robots }
): SeoConfig {
	const { title, description, robots } = page;
	return {
		title,
		description,
		canonical: ctx.canonical,
		// Spread, not `robots:` — `legal` is indexable and must carry NO robots
		// key at all, not a present-but-undefined one.
		...(robots ? { robots } : {}),
		og: {
			type: 'website',
			title,
			description,
			url: ctx.canonical,
			...defaultOgImageMeta(ctx.origin),
			siteName: SITE_NAME,
			locale: ctx.ogLocale,
			localeAlternate: ctx.alts
		},
		twitter: {
			card: 'summary',
			title,
			description,
			site: TWITTER_SITE
		},
		hreflang: sameUrlHreflang(ctx.canonical),
		jsonLd: []
	};
}
