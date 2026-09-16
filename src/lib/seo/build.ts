// src/lib/seo/build.ts
import type {
	EventDetailSchema,
	OrganizationRetrieveSchema,
	EventSeriesRetrieveSchema
} from '$lib/api/generated/types.gen';
import { getBackendUrl } from '$lib/config/api';
import { LANGS, OG_LOCALE, OG_LOGO_PATH, SITE_NAME, TWITTER_SITE, type Lang } from './constants';
import type { SeoConfig } from './types';
import {
	defaultOgImage,
	defaultOgImageMeta,
	DEFAULT_OG_IMAGE_ALT,
	plainPageSeo
} from './plain-page';
import { oembedDiscoveryUrl } from '$lib/embed/oembed';
import { truncate, stripMarkup } from './text';
import { sameUrlHreflang, landingPageHreflang } from './hreflang';
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

export type BuildSeoInput =
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

function alternateLocales(lang: Lang): string[] {
	return LANGS.filter((l) => l !== lang).map((l) => OG_LOCALE[l]);
}

function getEventImage(event: EventDetailSchema): string | undefined {
	const e = event as unknown as {
		cover_art_social_url?: string;
		event_series?: { cover_art_social_url?: string };
		organization?: { cover_art_social_url?: string };
	};
	const candidates = [
		e.cover_art_social_url,
		event.cover_art,
		e.event_series?.cover_art_social_url,
		event.event_series?.cover_art,
		e.organization?.cover_art_social_url,
		event.organization.cover_art,
		event.logo,
		event.organization.logo
	];
	const first = candidates.find((c) => c != null);
	return first ? getBackendUrl(first) : undefined;
}

function getOrgImage(org: OrganizationRetrieveSchema): string | undefined {
	const o = org as unknown as { cover_art_social_url?: string };
	const first = o.cover_art_social_url || org.cover_art || org.logo;
	return first ? getBackendUrl(first) : undefined;
}

function getSeriesImage(series: EventSeriesRetrieveSchema): string | undefined {
	const s = series as unknown as {
		cover_art_social_url?: string;
		organization?: { cover_art_social_url?: string };
	};
	const first =
		s.cover_art_social_url ||
		series.cover_art ||
		s.organization?.cover_art_social_url ||
		series.organization.cover_art ||
		series.logo ||
		series.organization.logo;
	return first ? getBackendUrl(first) : undefined;
}

export function buildSeo(input: BuildSeoInput): SeoConfig {
	const cfg = buildSeoConfig(input);
	// og:logo is site-wide brand metadata (the square R mark), identical on
	// every page regardless of which og:image the page uses.
	return { ...cfg, og: { ...cfg.og, logo: `${input.url.origin}${OG_LOGO_PATH}` } };
}

function buildSeoConfig(input: BuildSeoInput): SeoConfig {
	const origin = input.url.origin;
	const canonical = input.url.toString();
	const alts = alternateLocales(input.lang);
	const ogLocale = OG_LOCALE[input.lang];
	/** Shared by every `plainPageSeo` branch below. */
	const plainCtx = { canonical, origin, ogLocale, alts };

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
					siteName: SITE_NAME,
					locale: ogLocale,
					localeAlternate: alts
				},
				twitter: {
					card: 'summary_large_image',
					title: 'Event Management for Communities',
					description: 'Discover community events and create unforgettable experiences',
					image: defaultOgImage(origin),
					imageAlt: DEFAULT_OG_IMAGE_ALT,
					site: TWITTER_SITE
				},
				hreflang: sameUrlHreflang(canonical),
				jsonLd: [generateWebSiteJsonLd(origin)]
			};
		}

		case 'events-listing': {
			const title = 'Browse Events | Revel';
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
					siteName: SITE_NAME,
					locale: ogLocale,
					localeAlternate: alts
				},
				twitter: {
					card: 'summary_large_image',
					title,
					description: 'Discover community events near you',
					image: defaultOgImage(origin),
					imageAlt: DEFAULT_OG_IMAGE_ALT,
					site: TWITTER_SITE
				},
				hreflang: sameUrlHreflang(canonical),
				jsonLd: [
					generateBreadcrumbJsonLd([
						{ name: 'Home', url: origin },
						{ name: 'Events', url: canonical }
					])
				]
			};
		}

		case 'orgs-listing': {
			const title = 'Discover Organizations | Revel';
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
					siteName: SITE_NAME,
					locale: ogLocale,
					localeAlternate: alts
				},
				twitter: {
					card: 'summary_large_image',
					title,
					description: 'Browse community organizations near you',
					image: defaultOgImage(origin),
					imageAlt: DEFAULT_OG_IMAGE_ALT,
					site: TWITTER_SITE
				},
				hreflang: sameUrlHreflang(canonical),
				jsonLd: ld
			};
		}

		case 'event': {
			const event = input.event;
			const desc = stripMarkup(event.description);
			const truncated = truncate(desc, 155);
			const image = getEventImage(event);
			const title = `${event.name} | Revel`;
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
					siteName: SITE_NAME,
					locale: ogLocale,
					localeAlternate: alts
				},
				twitter: {
					card: 'summary_large_image',
					title: event.name,
					description: truncate(desc, 200) || `Join ${event.name}`,
					image,
					imageAlt: image ? event.name : undefined,
					site: TWITTER_SITE
				},
				hreflang: sameUrlHreflang(canonical),
				jsonLd: [
					generateEventJsonLd(event, canonical),
					generateBreadcrumbJsonLd([
						{ name: 'Home', url: origin },
						{ name: 'Events', url: `${origin}/events` },
						{ name: event.organization.name, url: `${origin}/org/${event.organization.slug}` },
						{ name: event.name, url: canonical }
					])
				]
			};
		}

		case 'org': {
			const org = input.org;
			const desc = stripMarkup(org.description);
			const truncated = truncate(desc, 155);
			const image = getOrgImage(org);
			const title = `${org.name} | Revel`;
			const description = truncated || `${org.name} on Revel - Community events and experiences`;
			return {
				title,
				description,
				canonical,
				oembed: oembedDiscoveryUrl(input.url),
				og: {
					type: 'profile',
					title: org.name,
					description: desc || description,
					url: canonical,
					image,
					imageAlt: image ? org.name : undefined,
					siteName: SITE_NAME,
					locale: ogLocale,
					localeAlternate: alts
				},
				twitter: {
					card: 'summary_large_image',
					title: org.name,
					description: truncate(desc, 200) || `${org.name} on Revel`,
					image,
					imageAlt: image ? org.name : undefined,
					site: TWITTER_SITE
				},
				hreflang: sameUrlHreflang(canonical),
				jsonLd: [
					generateOrganizationJsonLd(org, canonical),
					generateBreadcrumbJsonLd([
						{ name: 'Home', url: origin },
						{ name: 'Organizations', url: `${origin}/organizations` },
						{ name: org.name, url: canonical }
					])
				]
			};
		}

		case 'series': {
			const series = input.series;
			const desc = stripMarkup(series.description);
			const truncated = truncate(desc, 155);
			const image = getSeriesImage(series);
			const title = `${series.name} | ${series.organization.name} | Revel`;
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
					siteName: SITE_NAME,
					locale: ogLocale,
					localeAlternate: alts
				},
				twitter: {
					card: 'summary_large_image',
					title: `${series.name} | ${series.organization.name}`,
					description: truncate(desc, 200) || description,
					image,
					imageAlt: image ? `${series.name} | ${series.organization.name}` : undefined,
					site: TWITTER_SITE
				},
				hreflang: sameUrlHreflang(canonical),
				jsonLd: [
					generateSeriesJsonLd(series, canonical),
					generateBreadcrumbJsonLd([
						{ name: 'Home', url: origin },
						{ name: series.organization.name, url: `${origin}/org/${series.organization.slug}` },
						{ name: series.name, url: canonical }
					])
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
					siteName: SITE_NAME,
					locale: ogLocale,
					localeAlternate: alts
				},
				twitter: {
					card: 'summary_large_image',
					title,
					description,
					image: defaultOgImage(origin),
					imageAlt: DEFAULT_OG_IMAGE_ALT,
					site: TWITTER_SITE
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
				privacy: 'Privacy Policy | Revel',
				terms: 'Terms of Service | Revel'
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
				title: 'Referral program | Revel',
				description:
					'Apply to the Revel referral program: bring communities to Revel and earn a share of what they sell.',
				robots: 'noindex,follow'
			});
		}

		case 'auth': {
			const titles: Record<typeof input.page, string> = {
				login: 'Log in | Revel',
				register: 'Create your account | Revel',
				'password-reset': 'Reset your password | Revel',
				verify: 'Verify your account | Revel',
				unsubscribe: 'Unsubscribe | Revel'
			};
			const title = titles[input.page];
			return plainPageSeo(plainCtx, { title, description: title, robots: 'noindex,follow' });
		}
	}
}
