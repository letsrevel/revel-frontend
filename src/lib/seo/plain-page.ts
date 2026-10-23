// src/lib/seo/plain-page.ts
import { OG_IMAGE_PATH, TWITTER_SITE } from './constants';
import { siteName, tenantShareImage, type SeoTenant } from './tenant';
import type { Robots, SeoConfig } from './types';

export const DEFAULT_OG_IMAGE_ALT = 'Revel — Event Management for Communities';

export function defaultOgImage(origin: string): string {
	return `${origin}${OG_IMAGE_PATH}`;
}

/** The subset of `SeoConfig['og']` that `defaultOgImageMeta` fills in. */
export type DefaultOgImageMeta = Pick<
	SeoConfig['og'],
	'image' | 'imageAlt' | 'imageWidth' | 'imageHeight' | 'imageType'
>;

/**
 * Full OG image metadata for the default (non-event/non-org) social card.
 * Dimensions are known and fixed for the static asset, so we advertise them to
 * let unfurlers render the preview without first fetching the image.
 */
export function defaultOgImageMeta(origin: string): DefaultOgImageMeta {
	return {
		image: defaultOgImage(origin),
		imageAlt: DEFAULT_OG_IMAGE_ALT,
		imageWidth: 1200,
		imageHeight: 630,
		imageType: 'image/png'
	};
}

/** OG image block for a tenant host's plain pages: the org image when it has one. */
function tenantImageMeta(tenant: SeoTenant): DefaultOgImageMeta {
	const image = tenantShareImage(tenant);
	return image ? { image, imageAlt: tenant.name } : {};
}

/** Everything `plainPageSeo` needs from the request, computed once per build. */
export interface PlainPageContext {
	canonical: string;
	origin: string;
	ogLocale: string;
	alts: string[];
	/** Organization served on this custom-domain host (#1057); absent on the platform. */
	tenant?: SeoTenant | null;
}

/**
 * Text-only pages (legal, auth, referral-apply) share one shape: default OG
 * image, summary card, no hreflang (single-URL page, #994), no JSON-LD. Kept in ONE
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
			// On a tenant host the fixed Revel card is the wrong brand: use the org's
			// own image, or none at all.
			...(ctx.tenant ? tenantImageMeta(ctx.tenant) : defaultOgImageMeta(ctx.origin)),
			siteName: siteName(ctx.tenant),
			locale: ctx.ogLocale,
			localeAlternate: ctx.alts
		},
		twitter: {
			card: 'summary',
			title,
			description,
			...(ctx.tenant ? {} : { site: TWITTER_SITE })
		},
		hreflang: [],
		jsonLd: []
	};
}
