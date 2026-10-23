// src/lib/seo/build.ts
import type {
	EventDetailSchema,
	OrganizationRetrieveSchema,
	EventSeriesRetrieveSchema
} from '$lib/api/generated/types.gen';
import { LANGS, OG_LOCALE, OG_LOGO_PATH, TWITTER_SITE, type Lang } from './constants';
import type { SeoConfig } from './types';
import {
	defaultOgImage,
	defaultOgImageMeta,
	DEFAULT_OG_IMAGE_ALT,
	plainPageSeo
} from './plain-page';
import { oembedDiscoveryUrl } from '$lib/embed/oembed';
import { orgOrigin, type LinkContext } from '$lib/utils/org-links';
import { siteName, tenantIconUrl, withSiteName, type SeoTenant } from './tenant';
import { truncate, stripMarkup } from './text';
import { getEventImage, getOrgImage, getSeriesImage } from './images';
import { landingPageHreflang } from './hreflang';
import {
	generateEventJsonLd,
	generateOrganizationJsonLd,
	generateSeriesJsonLd,
	generateWebSiteJsonLd,
	generateBreadcrumbJsonLd,
	generateItemListJsonLd,
	type ListItem
} from './jsonld';

export type SeoPageSlug =
	| 'eventbrite-alternative'
	| 'queer-event-management'
	| 'kink-event-ticketing'
	| 'self-hosted-event-platform'
	| 'privacy-focused-events'
	| 'community-first-event-platform'
	| 'club-membership-management';

type BuildSeoVariant =
	| { kind: 'home'; url: URL; lang: Lang }
	| { kind: 'events-listing'; url: URL; lang: Lang }
	| { kind: 'orgs-listing'; url: URL; lang: Lang; items?: ListItem[] }
	| {
			kind: 'event';
			url: URL;
			lang: Lang;
			event: EventDetailSchema;
			indexable: boolean;
	  }
	| { kind: 'org'; url: URL; lang: Lang; org: OrganizationRetrieveSchema }
	| { kind: 'series'; url: URL; lang: Lang; series: EventSeriesRetrieveSchema }
	| {
			kind: 'landing';
			url: URL;
			lang: Lang;
			slug: SeoPageSlug;
			title?: string;
			description?: string;
			extraJsonLd?: object[];
	  }
	| { kind: 'legal'; url: URL; lang: Lang; doc: 'privacy' | 'terms' }
	| { kind: 'referral-apply'; url: URL; lang: Lang }
	| {
			kind: 'auth';
			url: URL;
			lang: Lang;
			page: 'login' | 'register' | 'password-reset' | 'verify' | 'unsubscribe';
	  };

/**
 * `tenant` is the organization served on this custom-domain host (null/absent on
 * the platform). It switches the site name, drops the Revel-only metadata
 * (`twitter:site`, `og:logo`, the Revel root breadcrumb) and re-roots the
 * breadcrumbs at the org home (#1057).
 */
export type BuildSeoInput = BuildSeoVariant & {
	tenant?: SeoTenant | null;
	/**
	 * Tenant-mode link context (`serverLinkContext(locals)`). Without it org-scoped
	 * pages canonicalise on the platform URL, never on a custom domain.
	 */
	linkContext?: LinkContext;
};

function alternateLocales(lang: Lang): string[] {
	return LANGS.filter((l) => l !== lang).map((l) => OG_LOCALE[l]);
}

export function buildSeo(input: BuildSeoInput): SeoConfig {
	const cfg = buildSeoConfig(input);
	// og:logo is site-wide brand metadata (the square R mark), identical on
	// every page regardless of which og:image the page uses. On a tenant host the
	// brand is the org, so it is the org logo or nothing, never Revel's mark.
	if (input.tenant) {
		const logo = tenantIconUrl(input.tenant);
		return { ...cfg, og: { ...cfg.og, ...(logo ? { logo } : {}) } };
	}
	return { ...cfg, og: { ...cfg.og, logo: `${input.url.origin}${OG_LOGO_PATH}` } };
}

function buildSeoConfig(input: BuildSeoInput): SeoConfig {
	const origin = input.url.origin;
	// Org-scoped pages whose org has an active custom domain are canonical on that
	// domain (#1056): the platform URL 301s there anyway, and a tenant host must not
	// canonicalise to itself over http in dev or behind a proxy.
	const domainOrigin = orgOrigin(
		input.kind === 'event'
			? input.event.organization
			: input.kind === 'org'
				? input.org
				: input.kind === 'series'
					? input.series.organization
					: null,
		input.linkContext
	);
	// On its own custom domain the org page lives at `/`; `/org/{slug}` is an alias.
	const ownRoot = input.kind === 'org' && !!input.tenant && input.tenant.id === input.org.id;
	const path = ownRoot ? '/' : input.url.pathname;
	const canonical = domainOrigin
		? `${domainOrigin}${path}${input.url.search}`
		: ownRoot
			? `${origin}/`
			: input.url.toString();
	const alts = alternateLocales(input.lang);
	const ogLocale = OG_LOCALE[input.lang];
	const tenant = input.tenant ?? null;
	/** Shared by every `plainPageSeo` branch below. */
	const plainCtx = { canonical, origin, ogLocale, alts, tenant };
	/** `twitter:site` is Revel's handle: never advertised on a tenant host. */
	const twitterSite = tenant ? {} : { site: TWITTER_SITE };
	const site = siteName(tenant);
	/** Breadcrumb root: the org home on a tenant host, Revel's home otherwise. */
	const rootCrumb = tenant
		? {
				name: tenant.name,
				url: `${domainOrigin ?? orgOrigin(tenant, input.linkContext) ?? origin}/`
			}
		: { name: 'Home', url: origin };

	switch (input.kind) {
		case 'home': {
			const title = 'Revel — Event Management for Communities';
			const description =
				'Discover community events, connect with organizers, and create unforgettable experiences. Open-source event management and ticketing platform.';
			// og:description has a tighter budget than the meta description:
			// social previews truncate around ~125 chars on mobile (#624).
			const ogDescription =
				'Discover community events, connect with organizers, and create unforgettable experiences on Revel, the open-source platform.';
			return {
				title,
				description,
				canonical,
				og: {
					type: 'website',
					title: 'Event Management for Communities',
					description: ogDescription,
					url: canonical,
					...defaultOgImageMeta(origin),
					siteName: site,
					locale: ogLocale,
					localeAlternate: alts
				},
				twitter: {
					card: 'summary_large_image',
					title: 'Event Management for Communities',
					description: 'Discover community events and create unforgettable experiences',
					image: defaultOgImage(origin),
					imageAlt: DEFAULT_OG_IMAGE_ALT,
					...twitterSite
				},
				hreflang: [],
				jsonLd: [generateWebSiteJsonLd(origin)]
			};
		}

		case 'events-listing': {
			const title = withSiteName('Browse Events', tenant);
			const description =
				'Discover community events happening near you. Find concerts, workshops, meetups, and more on Revel.';
			return {
				title,
				description,
				canonical,
				og: {
					type: 'website',
					title,
					description,
					url: canonical,
					...defaultOgImageMeta(origin),
					siteName: site,
					locale: ogLocale,
					localeAlternate: alts
				},
				twitter: {
					card: 'summary_large_image',
					title,
					description: 'Discover community events near you',
					image: defaultOgImage(origin),
					imageAlt: DEFAULT_OG_IMAGE_ALT,
					...twitterSite
				},
				hreflang: [],
				jsonLd: [
					generateBreadcrumbJsonLd([
						{ name: 'Home', url: origin },
						{ name: 'Events', url: canonical }
					])
				]
			};
		}

		case 'orgs-listing': {
			const title = withSiteName('Discover Organizations', tenant);
			const description =
				'Browse and discover community organizations on Revel. Find event organizers, communities, and groups creating amazing experiences.';
			// Shorter variant for social previews (~125-char budget, #624).
			const ogDescription =
				'Browse community organizations on Revel — event organizers, communities, and groups creating amazing experiences.';
			const ld: object[] = [
				generateBreadcrumbJsonLd([
					{ name: 'Home', url: origin },
					{ name: 'Organizations', url: canonical }
				])
			];
			if (input.items?.length) {
				ld.push(generateItemListJsonLd(input.items, 'Organizations on Revel'));
			}
			return {
				title,
				description,
				canonical,
				og: {
					type: 'website',
					title,
					description: ogDescription,
					url: canonical,
					...defaultOgImageMeta(origin),
					siteName: site,
					locale: ogLocale,
					localeAlternate: alts
				},
				twitter: {
					card: 'summary_large_image',
					title,
					description: 'Browse community organizations near you',
					image: defaultOgImage(origin),
					imageAlt: DEFAULT_OG_IMAGE_ALT,
					...twitterSite
				},
				hreflang: [],
				jsonLd: ld
			};
		}

		case 'event': {
			const event = input.event;
			const desc = stripMarkup(event.description);
			const truncated = truncate(desc, 155);
			const image = getEventImage(event);
			const title = withSiteName(event.name, tenant);
			const description = truncated || `Join ${event.name} organized by ${event.organization.name}`;
			return {
				title,
				description,
				canonical,
				robots: input.indexable ? undefined : 'noindex,follow',
				oembed: oembedDiscoveryUrl(input.url),
				og: {
					type: 'event',
					title: event.name,
					description: desc || description,
					url: canonical,
					image,
					imageAlt: image ? event.name : undefined,
					siteName: site,
					locale: ogLocale,
					localeAlternate: alts
				},
				twitter: {
					card: 'summary_large_image',
					title: event.name,
					description: truncate(desc, 200) || `Join ${event.name}`,
					image,
					imageAlt: image ? event.name : undefined,
					...twitterSite
				},
				hreflang: [],
				jsonLd: [
					generateEventJsonLd(event, canonical),
					generateBreadcrumbJsonLd(
						tenant
							? [rootCrumb, { name: event.name, url: canonical }]
							: [
									{ name: 'Home', url: origin },
									{ name: 'Events', url: `${origin}/events` },
									{
										name: event.organization.name,
										url: `${domainOrigin ?? origin}/org/${event.organization.slug}`
									},
									{ name: event.name, url: canonical }
								]
					)
				]
			};
		}

		case 'org': {
			const org = input.org;
			const desc = stripMarkup(org.description);
			const truncated = truncate(desc, 155);
			const image = getOrgImage(org);
			// The org page is the site itself: just the org name on a tenant host.
			const title = tenant ? org.name : `${org.name} | Revel`;
			const description =
				truncated ||
				(tenant
					? `${org.name} - Community events and experiences`
					: `${org.name} on Revel - Community events and experiences`);
			return {
				title,
				description,
				canonical,
				// The tenant root `/` renders the org page but is not an oEmbed target
				// path; point discovery at the org's own `/org/{slug}` URL.
				oembed: oembedDiscoveryUrl(
					tenant && input.url.pathname === '/' ? new URL(`/org/${org.slug}`, input.url) : input.url
				),
				og: {
					type: 'profile',
					title: org.name,
					description: desc || description,
					url: canonical,
					image,
					imageAlt: image ? org.name : undefined,
					siteName: site,
					locale: ogLocale,
					localeAlternate: alts
				},
				twitter: {
					card: 'summary_large_image',
					title: org.name,
					description: truncate(desc, 200) || (tenant ? org.name : `${org.name} on Revel`),
					image,
					imageAlt: image ? org.name : undefined,
					...twitterSite
				},
				hreflang: [],
				jsonLd: [
					generateOrganizationJsonLd(org, canonical),
					// The org page IS the tenant's root: a one-crumb trail adds nothing.
					...(tenant
						? []
						: [
								generateBreadcrumbJsonLd([
									{ name: 'Home', url: origin },
									{ name: 'Organizations', url: `${origin}/organizations` },
									{ name: org.name, url: canonical }
								])
							])
				]
			};
		}

		case 'series': {
			const series = input.series;
			const desc = stripMarkup(series.description);
			const truncated = truncate(desc, 155);
			const image = getSeriesImage(series);
			const title = tenant
				? withSiteName(series.name, tenant)
				: `${series.name} | ${series.organization.name} | Revel`;
			const description =
				truncated || `${series.name} - Event series by ${series.organization.name}`;
			return {
				title,
				description,
				canonical,
				oembed: oembedDiscoveryUrl(input.url),
				og: {
					type: 'website',
					title: `${series.name} | ${series.organization.name}`,
					description: desc || description,
					url: canonical,
					image,
					imageAlt: image ? `${series.name} | ${series.organization.name}` : undefined,
					siteName: site,
					locale: ogLocale,
					localeAlternate: alts
				},
				twitter: {
					card: 'summary_large_image',
					title: `${series.name} | ${series.organization.name}`,
					description: truncate(desc, 200) || description,
					image,
					imageAlt: image ? `${series.name} | ${series.organization.name}` : undefined,
					...twitterSite
				},
				hreflang: [],
				jsonLd: [
					generateSeriesJsonLd(series, canonical),
					generateBreadcrumbJsonLd(
						tenant
							? [rootCrumb, { name: series.name, url: canonical }]
							: [
									{ name: 'Home', url: origin },
									{
										name: series.organization.name,
										url: `${domainOrigin ?? origin}/org/${series.organization.slug}`
									},
									{ name: series.name, url: canonical }
								]
					)
				]
			};
		}

		case 'landing': {
			const title = input.title ?? input.slug;
			const description = input.description ?? '';
			return {
				title,
				description,
				canonical,
				og: {
					type: 'website',
					title,
					description,
					url: canonical,
					...defaultOgImageMeta(origin),
					siteName: site,
					locale: ogLocale,
					localeAlternate: alts
				},
				twitter: {
					card: 'summary_large_image',
					title,
					description,
					image: defaultOgImage(origin),
					imageAlt: DEFAULT_OG_IMAGE_ALT,
					...twitterSite
				},
				hreflang: landingPageHreflang(origin, input.slug),
				jsonLd: [
					generateBreadcrumbJsonLd([
						{ name: 'Home', url: origin },
						{ name: title, url: canonical }
					]),
					...(input.extraJsonLd ?? [])
				]
			};
		}

		case 'legal': {
			const titles: Record<typeof input.doc, string> = {
				privacy: withSiteName('Privacy Policy', tenant),
				terms: withSiteName('Terms of Service', tenant)
			};
			const title = titles[input.doc];
			return plainPageSeo(plainCtx, { title, description: title });
		}

		case 'referral-apply': {
			// noindex on purpose: the page 404s the moment an admin switches the
			// backend's `referral_applications` flag off, and an indexed URL that
			// flips to 404 is the soft-404 signal `make audit-soft-404` exists to
			// keep out of the index. `follow`, so its outgoing links still count.
			return plainPageSeo(plainCtx, {
				title: withSiteName('Referral program', tenant),
				description:
					'Apply to the Revel referral program: bring organizers to Revel and earn 15% of what Revel makes from them, forever.',
				robots: 'noindex,follow'
			});
		}

		case 'auth': {
			const titles: Record<typeof input.page, string> = {
				login: withSiteName('Log in', tenant),
				register: withSiteName('Create your account', tenant),
				'password-reset': withSiteName('Reset your password', tenant),
				verify: withSiteName('Verify your account', tenant),
				unsubscribe: withSiteName('Unsubscribe', tenant)
			};
			const title = titles[input.page];
			return plainPageSeo(plainCtx, { title, description: title, robots: 'noindex,follow' });
		}
	}
}
