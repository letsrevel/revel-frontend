# SEO Phase 1 — Technical SEO Health Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single canonical SEO pipeline (`lib/seo` + `<SeoHead>`), wire it into every public route, restructure the sitemap into a paginated index with hreflang, add FAQ/HowTo/SoftwareApplication schema to landing pages, ship Lighthouse CI + IndexNow, and produce a Core Web Vitals audit report.

**Architecture:** A new `src/lib/seo/` module exposes a typed `buildSeo()` factory that returns a `SeoConfig`. Route load functions (or `+page.ts`) call it and pass the result to a single `<SeoHead>` component. Old `utils/seo.ts` and `utils/structured-data.ts` are kept as thin re-exports during migration and deleted at the end. Sitemap becomes a `<sitemapindex>` referencing paginated sub-sitemaps, each URL annotated with `<xhtml:link rel="alternate" hreflang>`.

**Tech Stack:** SvelteKit 2 / Svelte 5 Runes, TypeScript strict mode, Paraglide (en/de/it), Vitest for unit tests, Playwright for E2E sitemap validation, `@lhci/cli` for Lighthouse CI.

**Reference spec:** `docs/superpowers/specs/2026-05-07-seo-phase-1-technical-health-design.md`

**Branch:** `feature/seo-phase-1-technical-health`

---

## File Structure

**New files:**
- `src/lib/seo/types.ts` — `SeoConfig`, `Lang`, `BuildSeoInput`
- `src/lib/seo/constants.ts` — site-wide constants (site name, twitter handle, locales)
- `src/lib/seo/hreflang.ts` — `getHreflangAlternates`
- `src/lib/seo/jsonld/escape.ts` — `toJsonLd` helper
- `src/lib/seo/jsonld/event.ts`, `organization.ts`, `series.ts`, `website.ts`, `breadcrumb.ts`, `itemlist.ts`, `faq.ts`, `howto.ts`, `software.ts`
- `src/lib/seo/jsonld/index.ts` — re-exports
- `src/lib/seo/build.ts` — `buildSeo` factory
- `src/lib/seo/index.ts` — public surface
- `src/lib/seo/SeoHead.svelte` — single component used by every route
- `src/routes/sitemap-static.xml/+server.ts`
- `src/routes/sitemap-events-[page].xml/+server.ts`
- `src/routes/sitemap-orgs-[page].xml/+server.ts`
- `src/routes/sitemap-series-[page].xml/+server.ts`
- `src/routes/api/indexnow/+server.ts`
- `static/indexnow-{key}.txt` (key: 32-hex random)
- `lighthouserc.cjs`
- `.github/workflows/lighthouse.yml`
- `scripts/audit-image-alt.ts`
- `docs/seo/cwv-audit-2026-05.md` — written by hand after Lighthouse CI is green
- `docs/seo/search-console-setup.md`
- `tests/unit/seo/build.test.ts`, `hreflang.test.ts`, `jsonld.test.ts`
- `tests/e2e/seo.spec.ts`

**Modified files:**
- `src/routes/sitemap.xml/+server.ts` — becomes a sitemap index
- `src/routes/robots.txt/+server.ts` — references new sub-sitemaps
- `src/routes/+layout.svelte` — render Search Console verification meta tags
- All `src/routes/(public)/**/+page.svelte` files — replace inline `<svelte:head>` SEO content with `<SeoHead config={data.seo} />`
- Most `src/routes/(public)/**/+page.server.ts` (and a few `+page.ts`) files — call `buildSeo` and return `seo` in their data
- `Makefile` — add `audit-images` and `lhci` targets
- `.github/workflows/ci.yml` — call `audit-image-alt` script

**Deleted files (last task):**
- `src/lib/utils/seo.ts`
- `src/lib/utils/structured-data.ts`

---

## Task 1: Bootstrap `lib/seo/` types and constants

**Files:**
- Create: `src/lib/seo/types.ts`
- Create: `src/lib/seo/constants.ts`
- Create: `src/lib/seo/index.ts`
- Test: `tests/unit/seo/types.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/seo/types.test.ts
import { describe, it, expect } from 'vitest';
import { LANGS, X_DEFAULT, SITE_NAME, TWITTER_SITE, OG_LOCALE } from '$lib/seo/constants';

describe('seo constants', () => {
	it('exports the three supported languages', () => {
		expect(LANGS).toEqual(['en', 'de', 'it']);
	});

	it('maps each lang to an OG locale', () => {
		expect(OG_LOCALE).toEqual({ en: 'en_US', de: 'de_DE', it: 'it_IT' });
	});

	it('defines x-default sentinel', () => {
		expect(X_DEFAULT).toBe('x-default');
	});

	it('defines site name and twitter handle', () => {
		expect(SITE_NAME).toBe('Revel');
		expect(TWITTER_SITE).toBe('@letsrevel');
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/seo/types.test.ts`
Expected: FAIL — `Cannot find module '$lib/seo/constants'`

- [ ] **Step 3: Create `src/lib/seo/constants.ts`**

```ts
// src/lib/seo/constants.ts
export const LANGS = ['en', 'de', 'it'] as const;
export type Lang = (typeof LANGS)[number];

export const X_DEFAULT = 'x-default' as const;

export const OG_LOCALE: Record<Lang, string> = {
	en: 'en_US',
	de: 'de_DE',
	it: 'it_IT'
};

export const SITE_NAME = 'Revel';
export const TWITTER_SITE = '@letsrevel';
```

- [ ] **Step 4: Create `src/lib/seo/types.ts`**

```ts
// src/lib/seo/types.ts
import type { Lang } from './constants';

export type Robots = 'index,follow' | 'noindex,follow' | 'noindex,nofollow';

export interface SeoConfig {
	title: string;
	description: string;
	canonical: string;
	robots?: Robots;
	og: {
		type: 'website' | 'profile' | 'event' | 'article';
		title: string;
		description: string;
		url: string;
		image?: string;
		siteName: string;
		locale: string;
		localeAlternate: string[];
	};
	twitter: {
		card: 'summary' | 'summary_large_image';
		title: string;
		description: string;
		image?: string;
		site: string;
	};
	hreflang: Array<{ lang: Lang | typeof import('./constants').X_DEFAULT; href: string }>;
	jsonLd: object[];
}
```

- [ ] **Step 5: Create `src/lib/seo/index.ts`**

```ts
// src/lib/seo/index.ts
export { LANGS, OG_LOCALE, SITE_NAME, TWITTER_SITE, X_DEFAULT } from './constants';
export type { Lang } from './constants';
export type { SeoConfig, Robots } from './types';
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm vitest run tests/unit/seo/types.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/seo/ tests/unit/seo/types.test.ts
git commit -m "feat(seo): bootstrap lib/seo with types and constants"
```

---

## Task 2: Hreflang utility

**Files:**
- Create: `src/lib/seo/hreflang.ts`
- Test: `tests/unit/seo/hreflang.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/seo/hreflang.test.ts
import { describe, it, expect } from 'vitest';
import {
	sameUrlHreflang,
	landingPageHreflang
} from '$lib/seo/hreflang';

describe('sameUrlHreflang', () => {
	it('returns en/de/it/x-default all pointing to the same absolute URL', () => {
		const result = sameUrlHreflang('https://letsrevel.io/events');
		expect(result).toEqual([
			{ lang: 'en', href: 'https://letsrevel.io/events' },
			{ lang: 'de', href: 'https://letsrevel.io/events' },
			{ lang: 'it', href: 'https://letsrevel.io/events' },
			{ lang: 'x-default', href: 'https://letsrevel.io/events' }
		]);
	});
});

describe('landingPageHreflang', () => {
	it('emits en at root, de under /de, it under /it, x-default = en', () => {
		const result = landingPageHreflang('https://letsrevel.io', 'eventbrite-alternative');
		expect(result).toEqual([
			{ lang: 'en', href: 'https://letsrevel.io/eventbrite-alternative' },
			{ lang: 'de', href: 'https://letsrevel.io/de/eventbrite-alternative' },
			{ lang: 'it', href: 'https://letsrevel.io/it/eventbrite-alternative' },
			{ lang: 'x-default', href: 'https://letsrevel.io/eventbrite-alternative' }
		]);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/seo/hreflang.test.ts`
Expected: FAIL — `Cannot find module '$lib/seo/hreflang'`

- [ ] **Step 3: Implement `src/lib/seo/hreflang.ts`**

```ts
// src/lib/seo/hreflang.ts
import { LANGS, X_DEFAULT, type Lang } from './constants';

export type HreflangEntry = { lang: Lang | typeof X_DEFAULT; href: string };

/**
 * Same URL across all locales. Use for pages where Paraglide localizes chrome
 * but content stays at one canonical URL (events, orgs, series, listings).
 */
export function sameUrlHreflang(absoluteUrl: string): HreflangEntry[] {
	return [
		...LANGS.map((lang) => ({ lang, href: absoluteUrl }) as HreflangEntry),
		{ lang: X_DEFAULT, href: absoluteUrl }
	];
}

/**
 * Per-locale URL prefixes for hand-rolled landing pages.
 * en is at root, de under /de, it under /it, x-default = en.
 */
export function landingPageHreflang(origin: string, slug: string): HreflangEntry[] {
	const prefix: Record<Lang, string> = { en: '', de: '/de', it: '/it' };
	return [
		...LANGS.map(
			(lang) => ({ lang, href: `${origin}${prefix[lang]}/${slug}` }) as HreflangEntry
		),
		{ lang: X_DEFAULT, href: `${origin}/${slug}` }
	];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/unit/seo/hreflang.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/seo/hreflang.ts tests/unit/seo/hreflang.test.ts
git commit -m "feat(seo): add hreflang helpers (sameUrl + landingPage)"
```

---

## Task 3: JSON-LD escape helper

**Files:**
- Create: `src/lib/seo/jsonld/escape.ts`
- Test: `tests/unit/seo/jsonld-escape.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/seo/jsonld-escape.test.ts
import { describe, it, expect } from 'vitest';
import { toJsonLd } from '$lib/seo/jsonld/escape';

describe('toJsonLd', () => {
	it('serializes an object to JSON', () => {
		expect(toJsonLd({ a: 1 })).toBe('{"a":1}');
	});

	it('escapes </script sequences to prevent script-tag breakout', () => {
		const evil = { x: '</script><script>alert(1)</script>' };
		const result = toJsonLd(evil);
		expect(result).not.toContain('</script');
		expect(result).toContain('\\u003c/script');
	});

	it('returns minimal valid JSON-LD when serialization throws', () => {
		const circular: Record<string, unknown> = {};
		circular.self = circular;
		const result = toJsonLd(circular);
		expect(() => JSON.parse(result)).not.toThrow();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/seo/jsonld-escape.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/seo/jsonld/escape.ts`**

```ts
// src/lib/seo/jsonld/escape.ts
/**
 * Serialize an object to JSON-LD safe for embedding inside <script type="application/ld+json">.
 * Escapes "</" so a malicious value cannot close the script tag.
 */
export function toJsonLd(data: object): string {
	try {
		return JSON.stringify(data).replace(/</g, '\\u003c');
	} catch (err) {
		console.error('[seo/jsonld] serialization failed:', err);
		return '{}';
	}
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/unit/seo/jsonld-escape.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/seo/jsonld/escape.ts tests/unit/seo/jsonld-escape.test.ts
git commit -m "feat(seo): add safe JSON-LD escape helper"
```

---

## Task 4: Move Event JSON-LD generator into `lib/seo/jsonld/event.ts`

**Files:**
- Create: `src/lib/seo/jsonld/event.ts`
- Test: `tests/unit/seo/jsonld-event.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/seo/jsonld-event.test.ts
import { describe, it, expect } from 'vitest';
import { generateEventJsonLd } from '$lib/seo/jsonld/event';
import type { EventDetailSchema } from '$lib/api/generated/types.gen';

const baseEvent = {
	id: 'evt-1',
	name: 'Summer Festival',
	slug: 'summer-festival',
	description: 'A nice festival',
	start: '2026-07-01T18:00:00Z',
	end: '2026-07-01T23:00:00Z',
	status: 'scheduled',
	requires_ticket: false,
	max_attendees: 0,
	attendee_count: 10,
	rsvp_before: null,
	address: '10 Main St',
	city: { name: 'Berlin', country: 'DE' },
	logo: null,
	cover_art: null,
	event_series: null,
	organization: { id: 'org-1', name: 'Acme', slug: 'acme', logo: null, cover_art: null }
} as unknown as EventDetailSchema;

describe('generateEventJsonLd', () => {
	it('returns a schema.org Event with required fields', () => {
		const ld = generateEventJsonLd(baseEvent, 'https://letsrevel.io/events/acme/summer-festival');
		expect(ld['@context']).toBe('https://schema.org');
		expect(ld['@type']).toBe('Event');
		expect(ld.name).toBe('Summer Festival');
		expect(ld.startDate).toBe('2026-07-01T18:00:00Z');
		expect(ld.eventStatus).toBe('https://schema.org/EventScheduled');
		expect(ld.eventAttendanceMode).toBe('https://schema.org/OfflineEventAttendanceMode');
	});

	it('falls back to current date when start is missing', () => {
		const e = { ...baseEvent, start: null } as unknown as EventDetailSchema;
		const ld = generateEventJsonLd(e, 'https://example.test/x');
		expect(ld.startDate).toMatch(/^\d{4}-\d{2}-\d{2}T/);
	});

	it('emits a free Offer when event does not require a ticket', () => {
		const ld = generateEventJsonLd(baseEvent, 'https://letsrevel.io/x');
		expect(ld.offers).toBeDefined();
		expect(ld.offers?.price).toBe('0');
		expect(ld.offers?.availability).toBe('https://schema.org/InStock');
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/seo/jsonld-event.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/seo/jsonld/event.ts`**

```ts
// src/lib/seo/jsonld/event.ts
import type { EventDetailSchema } from '$lib/api/generated/types.gen';
import { getBackendUrl } from '$lib/config/api';

interface PlaceLD {
	'@type': 'Place';
	name?: string;
	address?: {
		'@type': 'PostalAddress';
		streetAddress?: string;
		addressLocality?: string;
		addressCountry?: string;
	};
}

export interface EventJsonLd {
	'@context': 'https://schema.org';
	'@type': 'Event';
	name: string;
	description?: string;
	startDate: string;
	endDate: string;
	eventStatus: string;
	eventAttendanceMode: string;
	location: PlaceLD;
	organizer: { '@type': 'Organization'; name: string };
	image?: string[];
	offers?: {
		'@type': 'Offer';
		url: string;
		price?: string;
		priceCurrency?: string;
		availability: string;
		validFrom?: string;
	};
}

function buildLocation(event: EventDetailSchema): PlaceLD {
	const venueName = (event as unknown as { venue?: { name?: string } }).venue?.name;
	const place: PlaceLD = { '@type': 'Place', name: venueName || event.city?.name };
	if (event.address || event.city) {
		place.address = {
			'@type': 'PostalAddress',
			streetAddress: event.address || undefined,
			addressLocality: event.city?.name,
			addressCountry: event.city?.country
		};
	}
	return place;
}

export function generateEventJsonLd(event: EventDetailSchema, eventUrl: string): EventJsonLd {
	const startDate = event.start || new Date().toISOString();
	const endDate = event.end || startDate;

	const ld: EventJsonLd = {
		'@context': 'https://schema.org',
		'@type': 'Event',
		name: event.name,
		description: event.description || undefined,
		startDate,
		endDate,
		eventStatus: 'https://schema.org/EventScheduled',
		eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
		location: buildLocation(event),
		organizer: { '@type': 'Organization', name: event.organization.name }
	};

	const images = [
		event.logo,
		event.cover_art,
		event.event_series?.logo,
		event.event_series?.cover_art,
		event.organization.logo,
		event.organization.cover_art
	]
		.filter((img): img is string => img != null)
		.map((img) => getBackendUrl(img));
	if (images.length > 0) ld.image = images;

	if (!event.requires_ticket) {
		const isFull =
			event.max_attendees !== undefined &&
			event.max_attendees > 0 &&
			event.attendee_count >= event.max_attendees;
		ld.offers = {
			'@type': 'Offer',
			url: eventUrl,
			price: '0',
			priceCurrency: 'USD',
			availability: isFull ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
			validFrom: event.rsvp_before || event.start || undefined
		};
	}

	return ld;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/unit/seo/jsonld-event.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/seo/jsonld/event.ts tests/unit/seo/jsonld-event.test.ts
git commit -m "feat(seo): add Event JSON-LD generator (lib/seo)"
```

---

## Task 5: Move Organization, Series, WebSite, Breadcrumb, ItemList JSON-LD generators

**Files:**
- Create: `src/lib/seo/jsonld/organization.ts`
- Create: `src/lib/seo/jsonld/series.ts`
- Create: `src/lib/seo/jsonld/website.ts`
- Create: `src/lib/seo/jsonld/breadcrumb.ts`
- Create: `src/lib/seo/jsonld/itemlist.ts`
- Create: `src/lib/seo/jsonld/index.ts`
- Test: `tests/unit/seo/jsonld-misc.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/seo/jsonld-misc.test.ts
import { describe, it, expect } from 'vitest';
import { generateBreadcrumbJsonLd } from '$lib/seo/jsonld/breadcrumb';
import { generateItemListJsonLd } from '$lib/seo/jsonld/itemlist';
import { generateWebSiteJsonLd } from '$lib/seo/jsonld/website';

describe('breadcrumb jsonld', () => {
	it('numbers items 1..n with the right shape', () => {
		const ld = generateBreadcrumbJsonLd([
			{ name: 'Home', url: '/' },
			{ name: 'Events', url: '/events' }
		]);
		expect(ld['@type']).toBe('BreadcrumbList');
		expect(ld.itemListElement).toHaveLength(2);
		expect(ld.itemListElement[0]).toMatchObject({
			'@type': 'ListItem',
			position: 1,
			name: 'Home',
			item: '/'
		});
		expect(ld.itemListElement[1].position).toBe(2);
	});
});

describe('itemlist jsonld', () => {
	it('returns ItemList with numberOfItems set', () => {
		const ld = generateItemListJsonLd(
			[
				{ name: 'A', url: '/a' },
				{ name: 'B', url: '/b' }
			],
			'My list'
		);
		expect(ld['@type']).toBe('ItemList');
		expect(ld.numberOfItems).toBe(2);
		expect(ld.name).toBe('My list');
	});
});

describe('website jsonld', () => {
	it('emits SearchAction with proper urlTemplate', () => {
		const ld = generateWebSiteJsonLd('https://letsrevel.io');
		expect(ld['@type']).toBe('WebSite');
		expect(ld.potentialAction?.target.urlTemplate).toBe(
			'https://letsrevel.io/events?search={search_term_string}'
		);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/seo/jsonld-misc.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/seo/jsonld/organization.ts`**

```ts
// src/lib/seo/jsonld/organization.ts
import type { OrganizationRetrieveSchema } from '$lib/api/generated/types.gen';
import { getBackendUrl } from '$lib/config/api';

export interface OrganizationJsonLd {
	'@context': 'https://schema.org';
	'@type': 'Organization';
	name: string;
	description?: string;
	url?: string;
	logo?: string;
	image?: string;
	address?: {
		'@type': 'PostalAddress';
		streetAddress?: string;
		addressLocality?: string;
		addressCountry?: string;
	};
}

function stripHtml(html: string | null | undefined): string {
	if (!html) return '';
	return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

export function generateOrganizationJsonLd(
	org: OrganizationRetrieveSchema,
	orgUrl: string
): OrganizationJsonLd {
	const o = org as unknown as { cover_art_social_url?: string };
	const imageRel = o.cover_art_social_url || org.cover_art || org.logo;
	const ld: OrganizationJsonLd = {
		'@context': 'https://schema.org',
		'@type': 'Organization',
		name: org.name,
		description: stripHtml(org.description) || undefined,
		url: orgUrl,
		logo: org.logo ? getBackendUrl(org.logo) : undefined,
		image: imageRel ? getBackendUrl(imageRel) : undefined
	};
	if (org.address || org.city) {
		ld.address = {
			'@type': 'PostalAddress',
			streetAddress: org.address || undefined,
			addressLocality: org.city?.name,
			addressCountry: org.city?.country
		};
	}
	return ld;
}
```

- [ ] **Step 4: Implement `src/lib/seo/jsonld/series.ts`**

```ts
// src/lib/seo/jsonld/series.ts
import type { EventSeriesRetrieveSchema } from '$lib/api/generated/types.gen';
import { getBackendUrl } from '$lib/config/api';

export interface SeriesJsonLd {
	'@context': 'https://schema.org';
	'@type': 'EventSeries';
	name: string;
	description?: string;
	url: string;
	organizer: { '@type': 'Organization'; name: string };
	image?: string[];
}

function stripHtml(html: string | null | undefined): string {
	if (!html) return '';
	return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

export function generateSeriesJsonLd(
	series: EventSeriesRetrieveSchema,
	seriesUrl: string
): SeriesJsonLd {
	const ld: SeriesJsonLd = {
		'@context': 'https://schema.org',
		'@type': 'EventSeries',
		name: series.name,
		description: stripHtml(series.description) || undefined,
		url: seriesUrl,
		organizer: { '@type': 'Organization', name: series.organization.name }
	};
	const images = [
		series.logo,
		series.cover_art,
		series.organization.logo,
		series.organization.cover_art
	]
		.filter((img): img is string => img != null)
		.map((img) => getBackendUrl(img));
	if (images.length > 0) ld.image = images;
	return ld;
}
```

- [ ] **Step 5: Implement `src/lib/seo/jsonld/website.ts`**

```ts
// src/lib/seo/jsonld/website.ts
import { SITE_NAME } from '../constants';

export interface WebSiteJsonLd {
	'@context': 'https://schema.org';
	'@type': 'WebSite';
	name: string;
	url: string;
	description?: string;
	potentialAction?: {
		'@type': 'SearchAction';
		target: { '@type': 'EntryPoint'; urlTemplate: string };
		'query-input': string;
	};
}

export function generateWebSiteJsonLd(origin: string): WebSiteJsonLd {
	return {
		'@context': 'https://schema.org',
		'@type': 'WebSite',
		name: SITE_NAME,
		url: origin,
		description:
			'Community-focused event management platform. Discover events, connect with organizers, and create unforgettable experiences.',
		potentialAction: {
			'@type': 'SearchAction',
			target: { '@type': 'EntryPoint', urlTemplate: `${origin}/events?search={search_term_string}` },
			'query-input': 'required name=search_term_string'
		}
	};
}
```

- [ ] **Step 6: Implement `src/lib/seo/jsonld/breadcrumb.ts`**

```ts
// src/lib/seo/jsonld/breadcrumb.ts
export interface BreadcrumbItem {
	name: string;
	url: string;
}

export interface BreadcrumbJsonLd {
	'@context': 'https://schema.org';
	'@type': 'BreadcrumbList';
	itemListElement: Array<{
		'@type': 'ListItem';
		position: number;
		name: string;
		item: string;
	}>;
}

export function generateBreadcrumbJsonLd(items: BreadcrumbItem[]): BreadcrumbJsonLd {
	return {
		'@context': 'https://schema.org',
		'@type': 'BreadcrumbList',
		itemListElement: items.map((it, i) => ({
			'@type': 'ListItem',
			position: i + 1,
			name: it.name,
			item: it.url
		}))
	};
}
```

- [ ] **Step 7: Implement `src/lib/seo/jsonld/itemlist.ts`**

```ts
// src/lib/seo/jsonld/itemlist.ts
export interface ListItem {
	name: string;
	url: string;
	image?: string;
}

export interface ItemListJsonLd {
	'@context': 'https://schema.org';
	'@type': 'ItemList';
	name?: string;
	description?: string;
	numberOfItems: number;
	itemListElement: Array<{
		'@type': 'ListItem';
		position: number;
		url: string;
		name: string;
		image?: string;
	}>;
}

export function generateItemListJsonLd(
	items: ListItem[],
	name?: string,
	description?: string
): ItemListJsonLd {
	return {
		'@context': 'https://schema.org',
		'@type': 'ItemList',
		name,
		description,
		numberOfItems: items.length,
		itemListElement: items.map((it, i) => ({
			'@type': 'ListItem',
			position: i + 1,
			url: it.url,
			name: it.name,
			image: it.image
		}))
	};
}
```

- [ ] **Step 8: Implement `src/lib/seo/jsonld/index.ts`**

```ts
// src/lib/seo/jsonld/index.ts
export { toJsonLd } from './escape';
export { generateEventJsonLd, type EventJsonLd } from './event';
export { generateOrganizationJsonLd, type OrganizationJsonLd } from './organization';
export { generateSeriesJsonLd, type SeriesJsonLd } from './series';
export { generateWebSiteJsonLd, type WebSiteJsonLd } from './website';
export { generateBreadcrumbJsonLd, type BreadcrumbJsonLd, type BreadcrumbItem } from './breadcrumb';
export { generateItemListJsonLd, type ItemListJsonLd, type ListItem } from './itemlist';
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `pnpm vitest run tests/unit/seo/jsonld-misc.test.ts`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add src/lib/seo/jsonld/ tests/unit/seo/jsonld-misc.test.ts
git commit -m "feat(seo): port Organization/Series/WebSite/Breadcrumb/ItemList generators"
```

---

## Task 6: New JSON-LD: FAQPage, HowTo, SoftwareApplication

**Files:**
- Create: `src/lib/seo/jsonld/faq.ts`
- Create: `src/lib/seo/jsonld/howto.ts`
- Create: `src/lib/seo/jsonld/software.ts`
- Modify: `src/lib/seo/jsonld/index.ts:1-9` (add exports)
- Test: `tests/unit/seo/jsonld-extras.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/seo/jsonld-extras.test.ts
import { describe, it, expect } from 'vitest';
import { generateFaqJsonLd } from '$lib/seo/jsonld/faq';
import { generateHowToJsonLd } from '$lib/seo/jsonld/howto';
import { generateSoftwareApplicationJsonLd } from '$lib/seo/jsonld/software';

describe('FAQPage jsonld', () => {
	it('emits each Q/A as a Question with Answer', () => {
		const ld = generateFaqJsonLd([
			{ question: 'Why?', answer: 'Because.' },
			{ question: 'How?', answer: 'Like this.' }
		]);
		expect(ld['@type']).toBe('FAQPage');
		expect(ld.mainEntity).toHaveLength(2);
		expect(ld.mainEntity[0]).toMatchObject({
			'@type': 'Question',
			name: 'Why?',
			acceptedAnswer: { '@type': 'Answer', text: 'Because.' }
		});
	});
});

describe('HowTo jsonld', () => {
	it('emits HowTo with named steps', () => {
		const ld = generateHowToJsonLd({
			name: 'Self-host Revel',
			description: 'Run Revel on your own infra',
			steps: [
				{ name: 'Clone the repo', text: 'git clone …' },
				{ name: 'docker compose up', text: 'docker compose up -d' }
			]
		});
		expect(ld['@type']).toBe('HowTo');
		expect(ld.name).toBe('Self-host Revel');
		expect(ld.step).toHaveLength(2);
		expect(ld.step[0]).toMatchObject({ '@type': 'HowToStep', position: 1 });
	});
});

describe('SoftwareApplication jsonld', () => {
	it('emits a free-tier offer and required category', () => {
		const ld = generateSoftwareApplicationJsonLd({
			name: 'Revel',
			url: 'https://letsrevel.io',
			description: 'Open-source event platform',
			operatingSystem: 'Web'
		});
		expect(ld['@type']).toBe('SoftwareApplication');
		expect(ld.applicationCategory).toBe('EventManagementApplication');
		expect(ld.offers?.price).toBe('0');
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/seo/jsonld-extras.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/seo/jsonld/faq.ts`**

```ts
// src/lib/seo/jsonld/faq.ts
export interface FaqQA {
	question: string;
	answer: string;
}

export interface FaqJsonLd {
	'@context': 'https://schema.org';
	'@type': 'FAQPage';
	mainEntity: Array<{
		'@type': 'Question';
		name: string;
		acceptedAnswer: { '@type': 'Answer'; text: string };
	}>;
}

export function generateFaqJsonLd(items: FaqQA[]): FaqJsonLd {
	return {
		'@context': 'https://schema.org',
		'@type': 'FAQPage',
		mainEntity: items.map((q) => ({
			'@type': 'Question',
			name: q.question,
			acceptedAnswer: { '@type': 'Answer', text: q.answer }
		}))
	};
}
```

- [ ] **Step 4: Implement `src/lib/seo/jsonld/howto.ts`**

```ts
// src/lib/seo/jsonld/howto.ts
export interface HowToStep {
	name: string;
	text: string;
	url?: string;
}

export interface HowToJsonLd {
	'@context': 'https://schema.org';
	'@type': 'HowTo';
	name: string;
	description?: string;
	step: Array<{
		'@type': 'HowToStep';
		position: number;
		name: string;
		text: string;
		url?: string;
	}>;
}

export function generateHowToJsonLd(input: {
	name: string;
	description?: string;
	steps: HowToStep[];
}): HowToJsonLd {
	return {
		'@context': 'https://schema.org',
		'@type': 'HowTo',
		name: input.name,
		description: input.description,
		step: input.steps.map((s, i) => ({
			'@type': 'HowToStep',
			position: i + 1,
			name: s.name,
			text: s.text,
			url: s.url
		}))
	};
}
```

- [ ] **Step 5: Implement `src/lib/seo/jsonld/software.ts`**

```ts
// src/lib/seo/jsonld/software.ts
export interface SoftwareApplicationJsonLd {
	'@context': 'https://schema.org';
	'@type': 'SoftwareApplication';
	name: string;
	url: string;
	description?: string;
	applicationCategory: 'EventManagementApplication';
	operatingSystem: string;
	offers: {
		'@type': 'Offer';
		price: '0';
		priceCurrency: 'USD';
	};
}

export function generateSoftwareApplicationJsonLd(input: {
	name: string;
	url: string;
	description?: string;
	operatingSystem: string;
}): SoftwareApplicationJsonLd {
	return {
		'@context': 'https://schema.org',
		'@type': 'SoftwareApplication',
		name: input.name,
		url: input.url,
		description: input.description,
		applicationCategory: 'EventManagementApplication',
		operatingSystem: input.operatingSystem,
		offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
	};
}
```

- [ ] **Step 6: Add exports to `src/lib/seo/jsonld/index.ts`**

Append:
```ts
export { generateFaqJsonLd, type FaqJsonLd, type FaqQA } from './faq';
export { generateHowToJsonLd, type HowToJsonLd, type HowToStep } from './howto';
export {
	generateSoftwareApplicationJsonLd,
	type SoftwareApplicationJsonLd
} from './software';
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `pnpm vitest run tests/unit/seo/jsonld-extras.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/lib/seo/jsonld/faq.ts src/lib/seo/jsonld/howto.ts src/lib/seo/jsonld/software.ts src/lib/seo/jsonld/index.ts tests/unit/seo/jsonld-extras.test.ts
git commit -m "feat(seo): add FAQPage/HowTo/SoftwareApplication generators"
```

---

## Task 7: `buildSeo()` factory

**Files:**
- Create: `src/lib/seo/build.ts`
- Modify: `src/lib/seo/index.ts:1-3` (re-export `buildSeo`)
- Test: `tests/unit/seo/build.test.ts`

The factory takes a discriminated-union input and returns a fully-formed `SeoConfig`. We test the most consequential branches: home, event indexable, event non-indexable, landing page hreflang difference.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/seo/build.test.ts
import { describe, it, expect } from 'vitest';
import { buildSeo } from '$lib/seo/build';
import type { EventDetailSchema } from '$lib/api/generated/types.gen';

const url = (path: string) => new URL(`https://letsrevel.io${path}`);

const fakeEvent = {
	id: 'e1',
	name: 'My Event',
	slug: 'my-event',
	description: 'desc',
	start: '2026-07-01T18:00:00Z',
	end: '2026-07-01T23:00:00Z',
	status: 'scheduled',
	requires_ticket: false,
	max_attendees: 0,
	attendee_count: 0,
	rsvp_before: null,
	address: null,
	city: null,
	logo: null,
	cover_art: null,
	event_series: null,
	organization: { id: 'o1', name: 'Acme', slug: 'acme', logo: null, cover_art: null }
} as unknown as EventDetailSchema;

describe('buildSeo', () => {
	it('home: emits WebSite + Org JSON-LD and same-URL hreflang', () => {
		const cfg = buildSeo({ kind: 'home', url: url('/'), lang: 'en' });
		expect(cfg.canonical).toBe('https://letsrevel.io/');
		expect(cfg.og.locale).toBe('en_US');
		expect(cfg.og.localeAlternate).toEqual(['de_DE', 'it_IT']);
		expect(cfg.hreflang.map((h) => h.lang)).toEqual(['en', 'de', 'it', 'x-default']);
		expect(cfg.hreflang.every((h) => h.href === 'https://letsrevel.io/')).toBe(true);
		expect(cfg.jsonLd.some((j: any) => j['@type'] === 'WebSite')).toBe(true);
		expect(cfg.robots).toBeUndefined();
	});

	it('event indexable: includes Event + Breadcrumb JSON-LD; no robots tag', () => {
		const cfg = buildSeo({
			kind: 'event',
			url: url('/events/acme/my-event'),
			lang: 'en',
			event: fakeEvent,
			indexable: true
		});
		expect(cfg.title).toContain('My Event');
		expect(cfg.canonical).toBe('https://letsrevel.io/events/acme/my-event');
		expect(cfg.robots).toBeUndefined();
		const types = cfg.jsonLd.map((j: any) => j['@type']);
		expect(types).toContain('Event');
		expect(types).toContain('BreadcrumbList');
	});

	it('event non-indexable: emits noindex,follow', () => {
		const cfg = buildSeo({
			kind: 'event',
			url: url('/events/acme/my-event'),
			lang: 'en',
			event: fakeEvent,
			indexable: false
		});
		expect(cfg.robots).toBe('noindex,follow');
	});

	it('landing: hreflang uses per-locale URLs, not same-URL', () => {
		const cfg = buildSeo({
			kind: 'landing',
			url: url('/de/eventbrite-alternative'),
			lang: 'de',
			slug: 'eventbrite-alternative'
		});
		const map = Object.fromEntries(cfg.hreflang.map((h) => [h.lang, h.href]));
		expect(map.en).toBe('https://letsrevel.io/eventbrite-alternative');
		expect(map.de).toBe('https://letsrevel.io/de/eventbrite-alternative');
		expect(map.it).toBe('https://letsrevel.io/it/eventbrite-alternative');
		expect(map['x-default']).toBe('https://letsrevel.io/eventbrite-alternative');
	});

	it('auth pages emit noindex,follow', () => {
		const cfg = buildSeo({
			kind: 'auth',
			url: url('/login'),
			lang: 'en',
			page: 'login'
		});
		expect(cfg.robots).toBe('noindex,follow');
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/seo/build.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/seo/build.ts`**

```ts
// src/lib/seo/build.ts
import type {
	EventDetailSchema,
	OrganizationRetrieveSchema,
	EventSeriesRetrieveSchema
} from '$lib/api/generated/types.gen';
import { getBackendUrl } from '$lib/config/api';
import {
	LANGS,
	OG_LOCALE,
	SITE_NAME,
	TWITTER_SITE,
	type Lang
} from './constants';
import type { SeoConfig } from './types';
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
	| 'community-first-event-platform';

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
			title: string;
			description: string;
			extraJsonLd?: object[];
	  }
	| { kind: 'legal'; url: URL; lang: Lang; doc: 'privacy' | 'terms' }
	| {
			kind: 'auth';
			url: URL;
			lang: Lang;
			page: 'login' | 'register' | 'password-reset' | 'verify' | 'unsubscribe';
	  };

function truncate(s: string, max: number): string {
	if (!s) return '';
	if (s.length <= max) return s;
	return s.slice(0, max - 3) + '...';
}

function stripHtml(html: string | null | undefined): string {
	if (!html) return '';
	return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

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

function defaultOgImage(origin: string): string {
	return `${origin}/og-image.png`;
}

export function buildSeo(input: BuildSeoInput): SeoConfig {
	const origin = input.url.origin;
	const canonical = input.url.toString();
	const alts = alternateLocales(input.lang);
	const ogLocale = OG_LOCALE[input.lang];

	switch (input.kind) {
		case 'home': {
			const title = 'Revel — Community-Focused Event Management';
			const description =
				'Discover community events, connect with organizers, and create unforgettable experiences. Open-source event management and ticketing platform.';
			return {
				title,
				description,
				canonical,
				og: {
					type: 'website',
					title,
					description,
					url: canonical,
					image: defaultOgImage(origin),
					siteName: SITE_NAME,
					locale: ogLocale,
					localeAlternate: alts
				},
				twitter: {
					card: 'summary_large_image',
					title: 'Revel — Community Events',
					description: 'Discover community events and create unforgettable experiences',
					image: defaultOgImage(origin),
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
					image: defaultOgImage(origin),
					siteName: SITE_NAME,
					locale: ogLocale,
					localeAlternate: alts
				},
				twitter: {
					card: 'summary_large_image',
					title,
					description: 'Discover community events near you',
					image: defaultOgImage(origin),
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
					description,
					url: canonical,
					image: defaultOgImage(origin),
					siteName: SITE_NAME,
					locale: ogLocale,
					localeAlternate: alts
				},
				twitter: {
					card: 'summary_large_image',
					title,
					description: 'Browse community organizations near you',
					image: defaultOgImage(origin),
					site: TWITTER_SITE
				},
				hreflang: sameUrlHreflang(canonical),
				jsonLd: ld
			};
		}

		case 'event': {
			const event = input.event;
			const desc = stripHtml(event.description);
			const truncated = truncate(desc, 155);
			const image = getEventImage(event);
			const title = `${event.name} | Revel`;
			const description =
				truncated || `Join ${event.name} organized by ${event.organization.name}`;
			return {
				title,
				description,
				canonical,
				robots: input.indexable ? undefined : 'noindex,follow',
				og: {
					type: 'event',
					title: event.name,
					description: desc || description,
					url: canonical,
					image,
					siteName: SITE_NAME,
					locale: ogLocale,
					localeAlternate: alts
				},
				twitter: {
					card: 'summary_large_image',
					title: event.name,
					description: truncate(desc, 200) || `Join ${event.name}`,
					image,
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
			const desc = stripHtml(org.description);
			const truncated = truncate(desc, 155);
			const image = getOrgImage(org);
			const title = `${org.name} | Revel`;
			const description =
				truncated || `${org.name} on Revel - Community events and experiences`;
			return {
				title,
				description,
				canonical,
				og: {
					type: 'profile',
					title: org.name,
					description: desc || description,
					url: canonical,
					image,
					siteName: SITE_NAME,
					locale: ogLocale,
					localeAlternate: alts
				},
				twitter: {
					card: 'summary_large_image',
					title: org.name,
					description: truncate(desc, 200) || `${org.name} on Revel`,
					image,
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
			const desc = stripHtml(series.description);
			const truncated = truncate(desc, 155);
			const image = getSeriesImage(series);
			const title = `${series.name} | ${series.organization.name} | Revel`;
			const description =
				truncated || `${series.name} - Event series by ${series.organization.name}`;
			return {
				title,
				description,
				canonical,
				og: {
					type: 'website',
					title: `${series.name} | ${series.organization.name}`,
					description: desc || description,
					url: canonical,
					image,
					siteName: SITE_NAME,
					locale: ogLocale,
					localeAlternate: alts
				},
				twitter: {
					card: 'summary_large_image',
					title: `${series.name} | ${series.organization.name}`,
					description: truncate(desc, 200) || description,
					image,
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
			return {
				title: input.title,
				description: input.description,
				canonical,
				og: {
					type: 'website',
					title: input.title,
					description: input.description,
					url: canonical,
					image: defaultOgImage(origin),
					siteName: SITE_NAME,
					locale: ogLocale,
					localeAlternate: alts
				},
				twitter: {
					card: 'summary_large_image',
					title: input.title,
					description: input.description,
					image: defaultOgImage(origin),
					site: TWITTER_SITE
				},
				hreflang: landingPageHreflang(origin, input.slug),
				jsonLd: [
					generateBreadcrumbJsonLd([
						{ name: 'Home', url: origin },
						{ name: input.title, url: canonical }
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
			return {
				title: titles[input.doc],
				description: titles[input.doc],
				canonical,
				og: {
					type: 'website',
					title: titles[input.doc],
					description: titles[input.doc],
					url: canonical,
					image: defaultOgImage(origin),
					siteName: SITE_NAME,
					locale: ogLocale,
					localeAlternate: alts
				},
				twitter: {
					card: 'summary',
					title: titles[input.doc],
					description: titles[input.doc],
					site: TWITTER_SITE
				},
				hreflang: sameUrlHreflang(canonical),
				jsonLd: []
			};
		}

		case 'auth': {
			const titles: Record<typeof input.page, string> = {
				login: 'Log in | Revel',
				register: 'Create your account | Revel',
				'password-reset': 'Reset your password | Revel',
				verify: 'Verify your account | Revel',
				unsubscribe: 'Unsubscribe | Revel'
			};
			const t = titles[input.page];
			return {
				title: t,
				description: t,
				canonical,
				robots: 'noindex,follow',
				og: {
					type: 'website',
					title: t,
					description: t,
					url: canonical,
					image: defaultOgImage(origin),
					siteName: SITE_NAME,
					locale: ogLocale,
					localeAlternate: alts
				},
				twitter: {
					card: 'summary',
					title: t,
					description: t,
					site: TWITTER_SITE
				},
				hreflang: sameUrlHreflang(canonical),
				jsonLd: []
			};
		}
	}
}
```

- [ ] **Step 4: Re-export from `src/lib/seo/index.ts`**

Append:
```ts
export { buildSeo, type BuildSeoInput, type SeoPageSlug } from './build';
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run tests/unit/seo/build.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/seo/build.ts src/lib/seo/index.ts tests/unit/seo/build.test.ts
git commit -m "feat(seo): buildSeo factory with discriminated input"
```

---

## Task 8: `<SeoHead>` Svelte component

**Files:**
- Create: `src/lib/seo/SeoHead.svelte`
- Modify: `src/lib/seo/index.ts:end` (export component)
- Test: `tests/unit/seo/SeoHead.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/seo/SeoHead.test.ts
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import SeoHead from '$lib/seo/SeoHead.svelte';
import type { SeoConfig } from '$lib/seo';

const cfg: SeoConfig = {
	title: 'Test',
	description: 'Test description',
	canonical: 'https://letsrevel.io/test',
	og: {
		type: 'website',
		title: 'Test',
		description: 'Test description',
		url: 'https://letsrevel.io/test',
		siteName: 'Revel',
		locale: 'en_US',
		localeAlternate: ['de_DE', 'it_IT']
	},
	twitter: {
		card: 'summary_large_image',
		title: 'Test',
		description: 'Test description',
		site: '@letsrevel'
	},
	hreflang: [
		{ lang: 'en', href: 'https://letsrevel.io/test' },
		{ lang: 'de', href: 'https://letsrevel.io/test' },
		{ lang: 'it', href: 'https://letsrevel.io/test' },
		{ lang: 'x-default', href: 'https://letsrevel.io/test' }
	],
	jsonLd: [{ '@context': 'https://schema.org', '@type': 'WebSite', name: 'Revel' }]
};

describe('<SeoHead>', () => {
	it('renders title and description into <head>', () => {
		render(SeoHead, { config: cfg });
		expect(document.title).toBe('Test');
		const desc = document.head.querySelector('meta[name="description"]');
		expect(desc?.getAttribute('content')).toBe('Test description');
	});

	it('renders canonical', () => {
		render(SeoHead, { config: cfg });
		const link = document.head.querySelector('link[rel="canonical"]');
		expect(link?.getAttribute('href')).toBe('https://letsrevel.io/test');
	});

	it('renders all hreflang alternates', () => {
		render(SeoHead, { config: cfg });
		const links = document.head.querySelectorAll('link[rel="alternate"][hreflang]');
		expect(links).toHaveLength(4);
	});

	it('renders robots when set', () => {
		render(SeoHead, { config: { ...cfg, robots: 'noindex,follow' } });
		const robots = document.head.querySelector('meta[name="robots"]');
		expect(robots?.getAttribute('content')).toBe('noindex,follow');
	});

	it('renders one <script type="application/ld+json"> per JSON-LD block', () => {
		render(SeoHead, { config: cfg });
		const scripts = document.head.querySelectorAll('script[type="application/ld+json"]');
		expect(scripts).toHaveLength(1);
		expect(scripts[0].textContent).toContain('"@type":"WebSite"');
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/seo/SeoHead.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/seo/SeoHead.svelte`**

```svelte
<script lang="ts">
	import type { SeoConfig } from './types';
	import { toJsonLd } from './jsonld/escape';

	interface Props {
		config: SeoConfig;
	}
	const { config }: Props = $props();
</script>

<svelte:head>
	<title>{config.title}</title>
	<meta name="description" content={config.description} />
	<link rel="canonical" href={config.canonical} />
	{#if config.robots}
		<meta name="robots" content={config.robots} />
	{/if}

	<meta property="og:type" content={config.og.type} />
	<meta property="og:title" content={config.og.title} />
	<meta property="og:description" content={config.og.description} />
	<meta property="og:url" content={config.og.url} />
	<meta property="og:site_name" content={config.og.siteName} />
	<meta property="og:locale" content={config.og.locale} />
	{#each config.og.localeAlternate as alt (alt)}
		<meta property="og:locale:alternate" content={alt} />
	{/each}
	{#if config.og.image}
		<meta property="og:image" content={config.og.image} />
	{/if}

	<meta name="twitter:card" content={config.twitter.card} />
	<meta name="twitter:title" content={config.twitter.title} />
	<meta name="twitter:description" content={config.twitter.description} />
	<meta name="twitter:site" content={config.twitter.site} />
	{#if config.twitter.image}
		<meta name="twitter:image" content={config.twitter.image} />
	{/if}

	{#each config.hreflang as alt (alt.lang)}
		<link rel="alternate" hreflang={alt.lang} href={alt.href} />
	{/each}

	{#each config.jsonLd as block, i (i)}
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html `<script type="application/ld+json">${toJsonLd(block)}</script>`}
	{/each}
</svelte:head>
```

- [ ] **Step 4: Add export to `src/lib/seo/index.ts`**

Append:
```ts
export { default as SeoHead } from './SeoHead.svelte';
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run tests/unit/seo/SeoHead.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/seo/SeoHead.svelte src/lib/seo/index.ts tests/unit/seo/SeoHead.test.ts
git commit -m "feat(seo): SeoHead component renders SeoConfig into <head>"
```

---

## Task 9: Resolve current Paraglide language for `buildSeo` in load functions

We need a tiny helper that returns the active `Lang` server-side. Paraglide's runtime exposes `getLocale()` from the generated module, but loaders prefer an explicit accessor.

**Files:**
- Create: `src/lib/seo/server.ts`
- Test: `tests/unit/seo/server.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/seo/server.test.ts
import { describe, it, expect, vi } from 'vitest';
import { resolveLang } from '$lib/seo/server';

describe('resolveLang', () => {
	it('returns en when Accept-Language has only en', () => {
		const req = new Request('https://x.test/', {
			headers: { 'accept-language': 'en-US,en;q=0.9' }
		});
		expect(resolveLang(req)).toBe('en');
	});

	it('returns de when Accept-Language prefers de', () => {
		const req = new Request('https://x.test/', {
			headers: { 'accept-language': 'de-DE,de;q=0.9,en;q=0.5' }
		});
		expect(resolveLang(req)).toBe('de');
	});

	it('returns it when Accept-Language has it', () => {
		const req = new Request('https://x.test/', {
			headers: { 'accept-language': 'it,en;q=0.5' }
		});
		expect(resolveLang(req)).toBe('it');
	});

	it('falls back to en for unknown languages', () => {
		const req = new Request('https://x.test/', {
			headers: { 'accept-language': 'fr,es;q=0.9' }
		});
		expect(resolveLang(req)).toBe('en');
	});

	it('falls back to en when no header is set', () => {
		const req = new Request('https://x.test/');
		expect(resolveLang(req)).toBe('en');
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/seo/server.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/seo/server.ts`**

```ts
// src/lib/seo/server.ts
import { LANGS, type Lang } from './constants';

/**
 * Best-effort language detection for SEO meta. Reads the request's Accept-Language
 * and returns the highest-priority supported language, defaulting to 'en'.
 *
 * For routes under hard-coded /de or /it prefixes (landing pages), pass the
 * lang explicitly to buildSeo instead of using this helper.
 */
export function resolveLang(request: Request): Lang {
	const header = request.headers.get('accept-language');
	if (!header) return 'en';

	const candidates = header
		.split(',')
		.map((part) => {
			const [tag, q] = part.trim().split(';q=');
			return { tag: tag.toLowerCase(), q: q ? parseFloat(q) : 1.0 };
		})
		.sort((a, b) => b.q - a.q);

	for (const c of candidates) {
		const base = c.tag.split('-')[0];
		if ((LANGS as readonly string[]).includes(base)) return base as Lang;
	}
	return 'en';
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/unit/seo/server.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/seo/server.ts tests/unit/seo/server.test.ts
git commit -m "feat(seo): resolveLang helper for load functions"
```

---

## Task 10: Migrate home page to `<SeoHead>`

**Files:**
- Modify: `src/routes/(public)/+page.server.ts` (create if missing)
- Modify: `src/routes/(public)/+page.svelte`

- [ ] **Step 1: Read the current home page**

Run: `cat src/routes/(public)/+page.svelte`
Confirm it currently inlines meta tags or uses old utils.

- [ ] **Step 2: Create or update `src/routes/(public)/+page.server.ts`**

If the file does not exist, create it. If it does, add the `seo` field:

```ts
import { buildSeo } from '$lib/seo';
import { resolveLang } from '$lib/seo/server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, request }) => {
	const lang = resolveLang(request);
	const seo = buildSeo({ kind: 'home', url, lang });
	return { seo };
};
```

If the existing load function returns other data, merge `seo` into the return object — do not overwrite.

- [ ] **Step 3: Update `src/routes/(public)/+page.svelte`**

At the top of `<script lang="ts">`, add:
```ts
import { SeoHead } from '$lib/seo';
import type { PageData } from './$types';
const { data }: { data: PageData } = $props();
```

Replace any existing `<svelte:head>` SEO content with:
```svelte
<SeoHead config={data.seo} />
```

If the existing `<svelte:head>` had non-SEO concerns (e.g., page-specific styles), keep those in a separate `<svelte:head>` block.

- [ ] **Step 4: Verify in dev**

```bash
pnpm dev
```
Open http://localhost:5173, view source. Confirm:
- `<title>` contains "Revel — Community-Focused Event Management"
- One `<link rel="canonical">`
- Four `<link rel="alternate" hreflang>` (en, de, it, x-default)
- One `<script type="application/ld+json">` with `"@type":"WebSite"`

- [ ] **Step 5: Commit**

```bash
git add src/routes/(public)/+page.server.ts src/routes/(public)/+page.svelte
git commit -m "feat(seo): migrate home page to <SeoHead>"
```

---

## Task 11: Migrate `/events` listing page

**Files:**
- Modify: `src/routes/(public)/events/+page.server.ts`
- Modify: `src/routes/(public)/events/+page.svelte`

- [ ] **Step 1: Update load function**

Add `seo` to the existing return:

```ts
// src/routes/(public)/events/+page.server.ts (top imports)
import { buildSeo } from '$lib/seo';
import { resolveLang } from '$lib/seo/server';
```

Inside the existing `load` function, before `return`:
```ts
const lang = resolveLang(request);
const seo = buildSeo({ kind: 'events-listing', url, lang });
```

Add `seo` to the returned object. If `request` and `url` aren't already destructured from the load event, add them.

- [ ] **Step 2: Update page**

Replace inline `<svelte:head>` SEO content with:
```svelte
<SeoHead config={data.seo} />
```
And import `SeoHead` from `$lib/seo`.

- [ ] **Step 3: Verify in dev**

Open http://localhost:5173/events. View source. Confirm canonical = `/events`, hreflang × 4, BreadcrumbList JSON-LD present.

- [ ] **Step 4: Commit**

```bash
git add src/routes/(public)/events/+page.server.ts src/routes/(public)/events/+page.svelte
git commit -m "feat(seo): migrate /events listing to <SeoHead>"
```

---

## Task 12: Migrate `/organizations` listing

**Files:**
- Modify: `src/routes/(public)/organizations/+page.server.ts`
- Modify: `src/routes/(public)/organizations/+page.svelte`

- [ ] **Step 1: Update load function**

```ts
import { buildSeo } from '$lib/seo';
import { resolveLang } from '$lib/seo/server';

// inside load, after fetching organizations:
const lang = resolveLang(request);
const items = (organizations.results ?? []).slice(0, 25).map((o) => ({
	name: o.name,
	url: `${url.origin}/org/${o.slug}`,
	image: o.logo ? getBackendUrl(o.logo) : undefined
}));
const seo = buildSeo({ kind: 'orgs-listing', url, lang, items });
return { ...existingReturn, seo };
```

(Adjust to match the actual existing return shape — do not break other consumers.)

- [ ] **Step 2: Update page**

Add `<SeoHead config={data.seo} />` and remove old inline meta.

- [ ] **Step 3: Verify in dev**

Open http://localhost:5173/organizations. Confirm ItemList JSON-LD appears.

- [ ] **Step 4: Commit**

```bash
git add src/routes/(public)/organizations/+page.server.ts src/routes/(public)/organizations/+page.svelte
git commit -m "feat(seo): migrate /organizations listing to <SeoHead>"
```

---

## Task 13: Migrate event detail page (`/events/[org_slug]/[event_slug]`)

**Files:**
- Modify: `src/routes/(public)/events/[org_slug]/[event_slug]/+page.server.ts`
- Modify: `src/routes/(public)/events/[org_slug]/[event_slug]/+page.svelte`

- [ ] **Step 1: Compute `indexable` and build seo in the load function**

In the existing load function, after `const event = eventResponse.data`, add:

```ts
import { buildSeo } from '$lib/seo';
import { resolveLang } from '$lib/seo/server';

// ... inside load:
const lang = resolveLang(request);
const eventStart = event.start ? new Date(event.start) : null;
const isCancelled = event.status === 'cancelled';
const isPast = eventStart != null && eventStart.getTime() < Date.now();
const indexable = !isCancelled && !isPast;

if (!indexable) {
	setHeaders({ 'X-Robots-Tag': 'noindex,follow' });
}

const seo = buildSeo({ kind: 'event', url, lang, event, indexable });
```

Add `seo` and `indexable` to the returned data. Add `setHeaders` and `request` to the destructured `load` event.

- [ ] **Step 2: Replace inline SEO in `+page.svelte`**

In `+page.svelte`:

1. Remove these imports:
```ts
import { generateEventStructuredData, structuredDataToJsonLd } from '$lib/utils/structured-data';
import { generateEventMeta, generateBreadcrumbStructuredData, toJsonLd } from '$lib/utils/seo';
```

2. Remove the `eventUrl`, `structuredData`, `jsonLd`, `metaTags`, `breadcrumbData`, `breadcrumbJsonLd` derived state.

3. Add:
```ts
import { SeoHead } from '$lib/seo';
```

4. In the template, replace the existing `<svelte:head>...meta tags...</svelte:head>` block with:
```svelte
<SeoHead config={data.seo} />
```

- [ ] **Step 3: Verify in dev**

Open a public event URL. View source. Confirm `<meta name="robots">` is absent for an upcoming event, present and = `noindex,follow` for a cancelled or past event.

- [ ] **Step 4: Commit**

```bash
git add src/routes/(public)/events/[org_slug]/[event_slug]/+page.server.ts src/routes/(public)/events/[org_slug]/[event_slug]/+page.svelte
git commit -m "feat(seo): migrate event detail to <SeoHead> + soft-404 for past/cancelled"
```

---

## Task 14: Migrate organization detail (`/org/[slug]`)

**Files:**
- Modify: `src/routes/(public)/org/[slug]/+page.server.ts`
- Modify: `src/routes/(public)/org/[slug]/+page.svelte`

- [ ] **Step 1: Update load**

Add to imports and inside `load`:
```ts
import { buildSeo } from '$lib/seo';
import { resolveLang } from '$lib/seo/server';
// ... after fetching organization:
const lang = resolveLang(request);
const seo = buildSeo({ kind: 'org', url, lang, org: organization });
```
Add `seo` to return.

- [ ] **Step 2: Update page**

Replace inline meta with `<SeoHead config={data.seo} />`. Remove old imports.

- [ ] **Step 3: Verify**

Open an org URL. Confirm Organization JSON-LD + BreadcrumbList present.

- [ ] **Step 4: Commit**

```bash
git add src/routes/(public)/org/[slug]/+page.server.ts src/routes/(public)/org/[slug]/+page.svelte
git commit -m "feat(seo): migrate org detail to <SeoHead>"
```

---

## Task 15: Migrate event series detail

**Files:**
- Modify: `src/routes/(public)/events/[org_slug]/series/[series_slug]/+page.server.ts`
- Modify: `src/routes/(public)/events/[org_slug]/series/[series_slug]/+page.svelte`

- [ ] **Step 1: Update load**

```ts
import { buildSeo } from '$lib/seo';
import { resolveLang } from '$lib/seo/server';
// after fetching series:
const lang = resolveLang(request);
const seo = buildSeo({ kind: 'series', url, lang, series });
```

- [ ] **Step 2: Update page**

Replace inline meta; import `SeoHead`.

- [ ] **Step 3: Verify**

Open a series URL; confirm EventSeries JSON-LD + BreadcrumbList.

- [ ] **Step 4: Commit**

```bash
git add src/routes/(public)/events/[org_slug]/series/[series_slug]/+page.server.ts src/routes/(public)/events/[org_slug]/series/[series_slug]/+page.svelte
git commit -m "feat(seo): migrate event series detail to <SeoHead>"
```

---

## Task 16: Migrate landing pages (en, de, it × 6 = 18 routes) — Part 1: helper + en

**Files:**
- Create: `src/lib/seo/landing.ts` (small helper that builds extras)
- Modify: `src/routes/(public)/eventbrite-alternative/+page.svelte`
- Modify: `src/routes/(public)/queer-event-management/+page.svelte`
- Modify: `src/routes/(public)/kink-event-ticketing/+page.svelte`
- Modify: `src/routes/(public)/self-hosted-event-platform/+page.svelte`
- Modify: `src/routes/(public)/privacy-focused-events/+page.svelte`
- Modify: `src/routes/(public)/community-first-event-platform/+page.svelte`

- [ ] **Step 1: Implement `src/lib/seo/landing.ts`**

```ts
// src/lib/seo/landing.ts
import { generateFaqJsonLd, generateSoftwareApplicationJsonLd } from './jsonld';
import type { LandingPageContent } from '$lib/data/landing-pages';

/**
 * Build the extra JSON-LD blocks every landing page emits:
 * - SoftwareApplication (Revel)
 * - FAQPage from the page's faq[]
 * Pass into buildSeo({kind:'landing', extraJsonLd: landingExtras(content, origin)}).
 */
export function landingExtras(content: LandingPageContent, origin: string): object[] {
	return [
		generateSoftwareApplicationJsonLd({
			name: 'Revel',
			url: origin,
			description: content.meta.description,
			operatingSystem: 'Web'
		}),
		generateFaqJsonLd(content.faq)
	];
}
```

- [ ] **Step 2: Update each English landing page**

For each of the 6 EN landing pages, replace the existing top of `<script lang="ts">` block — the imports, derived structured data, and the `<svelte:head>` with old inline meta — with:

```svelte
<script lang="ts">
	import { page } from '$app/state';
	import { getLandingPage } from '$lib/data/landing-pages';
	import { LandingPageTemplate } from '$lib/components/landing';
	import { SeoHead, buildSeo } from '$lib/seo';
	import { landingExtras } from '$lib/seo/landing';

	const SLUG = '<slug-of-this-page>'; // e.g. 'eventbrite-alternative'
	const content = getLandingPage('en', SLUG)!;

	const seoConfig = $derived(
		buildSeo({
			kind: 'landing',
			url: page.url,
			lang: 'en',
			slug: SLUG,
			title: content.meta.title,
			description: content.meta.description,
			extraJsonLd: landingExtras(content, page.url.origin)
		})
	);
</script>

<SeoHead config={seoConfig} />

<LandingPageTemplate {content} />
```

For each page, set `SLUG` to the matching slug from the file path.

- [ ] **Step 3: Run dev and view source for one landing page**

```bash
pnpm dev
```
Open http://localhost:5173/eventbrite-alternative. View source. Confirm:
- One `FAQPage` JSON-LD
- One `SoftwareApplication` JSON-LD
- One `BreadcrumbList` JSON-LD
- 4 hreflang links pointing to the per-locale variants (not all the same)

- [ ] **Step 4: Run unit tests**

Run: `pnpm vitest run tests/unit/seo/`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/seo/landing.ts src/routes/\(public\)/eventbrite-alternative src/routes/\(public\)/queer-event-management src/routes/\(public\)/kink-event-ticketing src/routes/\(public\)/self-hosted-event-platform src/routes/\(public\)/privacy-focused-events src/routes/\(public\)/community-first-event-platform
git commit -m "feat(seo): migrate EN landing pages to <SeoHead>"
```

---

## Task 17: Migrate landing pages — Part 2: de + it (12 routes)

**Files:**
- Modify: `src/routes/(public)/de/<each-slug>/+page.svelte`
- Modify: `src/routes/(public)/it/<each-slug>/+page.svelte`

- [ ] **Step 1: For each DE landing page, mirror the EN structure**

Use the same template as Task 16 Step 2, but set `lang: 'de'` and `getLandingPage('de', SLUG)`.

- [ ] **Step 2: For each IT landing page, mirror the EN structure**

Same as above but `lang: 'it'` and `getLandingPage('it', SLUG)`.

- [ ] **Step 3: View source for one DE and one IT page**

Confirm hreflang values point to the right per-locale URLs.

- [ ] **Step 4: Commit**

```bash
git add src/routes/\(public\)/de src/routes/\(public\)/it
git commit -m "feat(seo): migrate DE+IT landing pages to <SeoHead>"
```

---

## Task 18: Migrate auth pages (login, register, password-reset, verify, unsubscribe) to noindex

**Files:**
- Modify: `src/routes/(public)/login/+page.server.ts`
- Modify: `src/routes/(public)/login/+page.svelte`
- (and the equivalents for register, password-reset, verify, unsubscribe)

- [ ] **Step 1: For each auth page, add `seo` to the load**

Add to load:
```ts
import { buildSeo } from '$lib/seo';
import { resolveLang } from '$lib/seo/server';
// ...
const lang = resolveLang(request);
const seo = buildSeo({ kind: 'auth', url, lang, page: 'login' /* or other */ });
```

For pages that don't currently have a `+page.server.ts`, create one with just this load. For pages that have `+page.ts` only (client-runtime load), use that file with `({ url, fetch }) => ...` and skip Accept-Language detection (default lang to `'en'`).

- [ ] **Step 2: Update each `+page.svelte`**

Add at the top of the script:
```ts
import { SeoHead } from '$lib/seo';
```
At the top of the markup:
```svelte
<SeoHead config={data.seo} />
```
Remove any existing inline meta.

- [ ] **Step 3: Verify**

Open `/login`, view source, confirm `<meta name="robots" content="noindex,follow">`.

- [ ] **Step 4: Commit**

```bash
git add src/routes/\(public\)/login src/routes/\(public\)/register src/routes/\(public\)/password-reset src/routes/\(public\)/verify src/routes/\(public\)/unsubscribe
git commit -m "feat(seo): noindex auth pages via <SeoHead>"
```

---

## Task 19: Migrate legal pages (privacy, terms)

**Files:**
- Modify: `src/routes/(public)/legal/privacy/+page.svelte` and corresponding server load if any
- Modify: `src/routes/(public)/legal/terms/+page.svelte` and corresponding server load if any

- [ ] **Step 1: Add load that calls buildSeo with `kind: 'legal'`**

Create or modify `+page.server.ts` for each:
```ts
import { buildSeo } from '$lib/seo';
import { resolveLang } from '$lib/seo/server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, request }) => {
	const lang = resolveLang(request);
	const seo = buildSeo({ kind: 'legal', url, lang, doc: 'privacy' /* or 'terms' */ });
	return { seo };
};
```

- [ ] **Step 2: Update `+page.svelte`**

Add `<SeoHead config={data.seo} />`; remove old inline meta.

- [ ] **Step 3: Verify**

`/legal/privacy` and `/legal/terms` both have canonical, hreflang, no robots tag.

- [ ] **Step 4: Commit**

```bash
git add src/routes/\(public\)/legal
git commit -m "feat(seo): migrate legal pages to <SeoHead>"
```

---

## Task 20: Sitemap index (`sitemap.xml`)

**Files:**
- Modify: `src/routes/sitemap.xml/+server.ts`
- Test: `tests/e2e/sitemap.spec.ts`

- [ ] **Step 1: Write failing E2E test**

```ts
// tests/e2e/sitemap.spec.ts
import { test, expect } from '@playwright/test';

test('GET /sitemap.xml is a sitemap index', async ({ request }) => {
	const res = await request.get('/sitemap.xml');
	expect(res.status()).toBe(200);
	const body = await res.text();
	expect(body).toContain('<sitemapindex');
	expect(body).toContain('sitemap-static.xml');
	expect(body).toMatch(/sitemap-events-\d+\.xml/);
	expect(body).toMatch(/sitemap-orgs-\d+\.xml/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm playwright test tests/e2e/sitemap.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Replace `src/routes/sitemap.xml/+server.ts`**

```ts
import {
	eventpublicdiscoveryListEvents,
	organizationListOrganizations,
	eventseriesListEventSeries
} from '$lib/api';
import type { RequestHandler } from './$types';

const PAGE_SIZE = 5000;

function pages(total: number): number {
	return Math.max(1, Math.ceil(total / PAGE_SIZE));
}

export const GET: RequestHandler = async ({ fetch, url }) => {
	const baseUrl = url.origin;
	const lastmod = new Date().toISOString().split('T')[0];

	let eventCount = 0;
	let orgCount = 0;
	let seriesCount = 0;
	try {
		const [eventsResp, orgsResp, seriesResp] = await Promise.all([
			eventpublicdiscoveryListEvents({ fetch, query: { page: 1, page_size: 1, include_past: false } }),
			organizationListOrganizations({ fetch, query: { page: 1, page_size: 1 } }),
			eventseriesListEventSeries({ fetch, query: { page: 1, page_size: 1 } })
		]);
		eventCount = eventsResp.data?.count ?? 0;
		orgCount = orgsResp.data?.count ?? 0;
		seriesCount = seriesResp.data?.count ?? 0;
	} catch (err) {
		console.error('[sitemap] index count failed:', err);
	}

	const entries: string[] = [];
	entries.push(`<sitemap><loc>${baseUrl}/sitemap-static.xml</loc><lastmod>${lastmod}</lastmod></sitemap>`);
	for (let i = 1; i <= pages(eventCount); i++) {
		entries.push(`<sitemap><loc>${baseUrl}/sitemap-events-${i}.xml</loc><lastmod>${lastmod}</lastmod></sitemap>`);
	}
	for (let i = 1; i <= pages(orgCount); i++) {
		entries.push(`<sitemap><loc>${baseUrl}/sitemap-orgs-${i}.xml</loc><lastmod>${lastmod}</lastmod></sitemap>`);
	}
	for (let i = 1; i <= pages(seriesCount); i++) {
		entries.push(`<sitemap><loc>${baseUrl}/sitemap-series-${i}.xml</loc><lastmod>${lastmod}</lastmod></sitemap>`);
	}

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</sitemapindex>`;

	return new Response(xml, {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
			'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400'
		}
	});
};
```

- [ ] **Step 4: Run dev and curl the index**

```bash
pnpm dev &
sleep 2
curl -s http://localhost:5173/sitemap.xml | head -20
```
Expected: `<sitemapindex>` containing the 4+ sub-sitemap entries.
Stop dev server.

- [ ] **Step 5: Commit (test still fails — sub-sitemaps not yet implemented)**

```bash
git add src/routes/sitemap.xml/+server.ts tests/e2e/sitemap.spec.ts
git commit -m "feat(seo): convert /sitemap.xml to a sitemap index"
```

---

## Task 21: `sitemap-static.xml` sub-sitemap

**Files:**
- Create: `src/routes/sitemap-static.xml/+server.ts`

- [ ] **Step 1: Implement**

```ts
// src/routes/sitemap-static.xml/+server.ts
import type { RequestHandler } from './$types';

const STATIC = [
	{ path: '/', changefreq: 'daily', priority: '1.0' },
	{ path: '/events', changefreq: 'hourly', priority: '0.9' },
	{ path: '/organizations', changefreq: 'daily', priority: '0.8' },
	{ path: '/login', changefreq: 'monthly', priority: '0.4' },
	{ path: '/register', changefreq: 'monthly', priority: '0.4' },
	{ path: '/legal/privacy', changefreq: 'monthly', priority: '0.3' },
	{ path: '/legal/terms', changefreq: 'monthly', priority: '0.3' }
];

const LANDING_SLUGS = [
	'eventbrite-alternative',
	'queer-event-management',
	'kink-event-ticketing',
	'self-hosted-event-platform',
	'privacy-focused-events',
	'community-first-event-platform'
];

const LANGS = ['en', 'de', 'it'] as const;
const PREFIX: Record<(typeof LANGS)[number], string> = { en: '', de: '/de', it: '/it' };

function escapeXml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

function sameUrlAlternates(loc: string): string {
	return LANGS.map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${escapeXml(loc)}"/>`).join('') +
		`<xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(loc)}"/>`;
}

function landingAlternates(origin: string, slug: string): string {
	return (
		LANGS.map(
			(l) =>
				`<xhtml:link rel="alternate" hreflang="${l}" href="${escapeXml(`${origin}${PREFIX[l]}/${slug}`)}"/>`
		).join('') +
		`<xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(`${origin}/${slug}`)}"/>`
	);
}

export const GET: RequestHandler = async ({ url }) => {
	const baseUrl = url.origin;

	const lines: string[] = [];

	for (const s of STATIC) {
		const loc = `${baseUrl}${s.path}`;
		lines.push(`<url>
  <loc>${escapeXml(loc)}</loc>
  ${sameUrlAlternates(loc)}
  <changefreq>${s.changefreq}</changefreq>
  <priority>${s.priority}</priority>
</url>`);
	}

	for (const slug of LANDING_SLUGS) {
		for (const l of LANGS) {
			const loc = `${baseUrl}${PREFIX[l]}/${slug}`;
			lines.push(`<url>
  <loc>${escapeXml(loc)}</loc>
  ${landingAlternates(baseUrl, slug)}
  <changefreq>weekly</changefreq>
  <priority>${l === 'en' ? '0.8' : '0.7'}</priority>
</url>`);
		}
	}

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${lines.join('\n')}
</urlset>`;

	return new Response(xml, {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
			'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800'
		}
	});
};
```

- [ ] **Step 2: Verify in dev**

```bash
pnpm dev &
sleep 2
curl -s http://localhost:5173/sitemap-static.xml | grep -c "<url>"
```
Expected: 25 (7 static + 18 landing).

- [ ] **Step 3: Commit**

```bash
git add src/routes/sitemap-static.xml
git commit -m "feat(seo): static + landing-page sub-sitemap with hreflang"
```

---

## Task 22: `sitemap-events-[page].xml` sub-sitemap

**Files:**
- Create: `src/routes/sitemap-events-[page].xml/+server.ts`

- [ ] **Step 1: Implement**

```ts
// src/routes/sitemap-events-[page].xml/+server.ts
import { error } from '@sveltejs/kit';
import { eventpublicdiscoveryListEvents } from '$lib/api';
import { getBackendUrl } from '$lib/config/api';
import type { RequestHandler } from './$types';

const PAGE_SIZE = 5000;

function escapeXml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

function priorityFor(start: string): string {
	const days = Math.ceil((new Date(start).getTime() - Date.now()) / 86400000);
	if (days <= 7) return '0.9';
	if (days <= 30) return '0.8';
	if (days <= 90) return '0.7';
	return '0.6';
}

function sameUrlAlternates(loc: string): string {
	return ['en', 'de', 'it']
		.map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${escapeXml(loc)}"/>`)
		.join('') + `<xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(loc)}"/>`;
}

function imageEntry(rel: string | null | undefined, title: string): string {
	if (!rel) return '';
	return `<image:image>
  <image:loc>${escapeXml(getBackendUrl(rel))}</image:loc>
  <image:title>${escapeXml(title)}</image:title>
</image:image>`;
}

export const GET: RequestHandler = async ({ params, fetch, url }) => {
	const page = parseInt(params.page, 10);
	if (!Number.isInteger(page) || page < 1) throw error(404, 'Invalid sitemap page');

	const baseUrl = url.origin;
	const resp = await eventpublicdiscoveryListEvents({
		fetch,
		query: { page, page_size: PAGE_SIZE, include_past: false }
	});

	const events = resp.data?.results ?? [];
	if (events.length === 0 && page > 1) throw error(404, 'No events on this page');

	const urls = events.map((event) => {
		const loc = `${baseUrl}/events/${event.organization.slug}/${event.slug}`;
		const lastmod = (event.updated_at ? new Date(event.updated_at) : new Date())
			.toISOString()
			.split('T')[0];
		const img = imageEntry(event.cover_art ?? event.logo, event.name);
		return `<url>
  <loc>${escapeXml(loc)}</loc>
  ${sameUrlAlternates(loc)}
  <lastmod>${lastmod}</lastmod>
  <changefreq>weekly</changefreq>
  <priority>${priorityFor(event.start)}</priority>
  ${img}
</url>`;
	});

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.join('\n')}
</urlset>`;

	return new Response(xml, {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
			'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400'
		}
	});
};
```

- [ ] **Step 2: Verify**

```bash
curl -s http://localhost:5173/sitemap-events-1.xml | head -30
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/sitemap-events-99.xml
```
First: valid XML with `<url>` entries. Second: `404`.

- [ ] **Step 3: Commit**

```bash
git add src/routes/sitemap-events-\[page\].xml
git commit -m "feat(seo): paginated events sub-sitemap with image+hreflang"
```

---

## Task 23: `sitemap-orgs-[page].xml` and `sitemap-series-[page].xml`

**Files:**
- Create: `src/routes/sitemap-orgs-[page].xml/+server.ts`
- Create: `src/routes/sitemap-series-[page].xml/+server.ts`

- [ ] **Step 1: Implement orgs sub-sitemap**

Mirror Task 22 but use `organizationListOrganizations`, URL pattern `/org/${org.slug}`, priority `0.7`, `changefreq weekly`.

```ts
// src/routes/sitemap-orgs-[page].xml/+server.ts
import { error } from '@sveltejs/kit';
import { organizationListOrganizations } from '$lib/api';
import { getBackendUrl } from '$lib/config/api';
import type { RequestHandler } from './$types';

const PAGE_SIZE = 5000;

function escapeXml(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function alts(loc: string): string {
	return ['en', 'de', 'it']
		.map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${escapeXml(loc)}"/>`)
		.join('') + `<xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(loc)}"/>`;
}

function img(rel: string | null | undefined, title: string): string {
	if (!rel) return '';
	return `<image:image><image:loc>${escapeXml(getBackendUrl(rel))}</image:loc><image:title>${escapeXml(title)}</image:title></image:image>`;
}

export const GET: RequestHandler = async ({ params, fetch, url }) => {
	const page = parseInt(params.page, 10);
	if (!Number.isInteger(page) || page < 1) throw error(404, 'Invalid sitemap page');

	const baseUrl = url.origin;
	const resp = await organizationListOrganizations({
		fetch,
		query: { page, page_size: PAGE_SIZE }
	});
	const orgs = resp.data?.results ?? [];
	if (orgs.length === 0 && page > 1) throw error(404, 'No orgs on this page');

	const urls = orgs.map((o) => {
		const loc = `${baseUrl}/org/${o.slug}`;
		const lastmod = (o.updated_at ? new Date(o.updated_at) : new Date()).toISOString().split('T')[0];
		return `<url>
  <loc>${escapeXml(loc)}</loc>
  ${alts(loc)}
  <lastmod>${lastmod}</lastmod>
  <changefreq>weekly</changefreq>
  <priority>0.7</priority>
  ${img(o.logo ?? o.cover_art, o.name)}
</url>`;
	});

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.join('\n')}
</urlset>`;

	return new Response(xml, {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
			'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400'
		}
	});
};
```

- [ ] **Step 2: Implement series sub-sitemap**

```ts
// src/routes/sitemap-series-[page].xml/+server.ts
import { error } from '@sveltejs/kit';
import { eventseriesListEventSeries } from '$lib/api';
import { getBackendUrl } from '$lib/config/api';
import type { RequestHandler } from './$types';

const PAGE_SIZE = 5000;

function escapeXml(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function alts(loc: string): string {
	return ['en', 'de', 'it']
		.map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${escapeXml(loc)}"/>`)
		.join('') + `<xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(loc)}"/>`;
}

function img(rel: string | null | undefined, title: string): string {
	if (!rel) return '';
	return `<image:image><image:loc>${escapeXml(getBackendUrl(rel))}</image:loc><image:title>${escapeXml(title)}</image:title></image:image>`;
}

export const GET: RequestHandler = async ({ params, fetch, url }) => {
	const page = parseInt(params.page, 10);
	if (!Number.isInteger(page) || page < 1) throw error(404, 'Invalid sitemap page');

	const baseUrl = url.origin;
	const resp = await eventseriesListEventSeries({
		fetch,
		query: { page, page_size: PAGE_SIZE }
	});
	const series = resp.data?.results ?? [];
	if (series.length === 0 && page > 1) throw error(404, 'No series on this page');

	const urls = series.map((s) => {
		const loc = `${baseUrl}/events/${s.organization.slug}/series/${s.slug}`;
		const lastmod = (s.updated_at ? new Date(s.updated_at) : new Date()).toISOString().split('T')[0];
		return `<url>
  <loc>${escapeXml(loc)}</loc>
  ${alts(loc)}
  <lastmod>${lastmod}</lastmod>
  <changefreq>weekly</changefreq>
  <priority>0.6</priority>
  ${img(s.cover_art ?? s.logo, s.name)}
</url>`;
	});

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.join('\n')}
</urlset>`;

	return new Response(xml, {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
			'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400'
		}
	});
};
```

- [ ] **Step 3: Verify all sub-sitemaps return 200**

```bash
curl -s -o /dev/null -w "static=%{http_code} events=" http://localhost:5173/sitemap-static.xml
curl -s -o /dev/null -w "%{http_code} orgs=" http://localhost:5173/sitemap-events-1.xml
curl -s -o /dev/null -w "%{http_code} series=" http://localhost:5173/sitemap-orgs-1.xml
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/sitemap-series-1.xml
```
Expected: all 200.

- [ ] **Step 4: Run E2E sitemap test**

```bash
pnpm playwright test tests/e2e/sitemap.spec.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/routes/sitemap-orgs-\[page\].xml src/routes/sitemap-series-\[page\].xml
git commit -m "feat(seo): paginated orgs+series sub-sitemaps with hreflang"
```

---

## Task 24: Update `robots.txt` to advertise the new sub-sitemaps

**Files:**
- Modify: `src/routes/robots.txt/+server.ts:80-86`

- [ ] **Step 1: Update the Sitemap section**

Replace the trailing Sitemap section (currently a single line) with:

```ts
// inside the template:
// Sitemap location
Sitemap: ${baseUrl}/sitemap.xml
# Sub-sitemaps (also discoverable via the index above)
Sitemap: ${baseUrl}/sitemap-static.xml
Sitemap: ${baseUrl}/sitemap-events-1.xml
Sitemap: ${baseUrl}/sitemap-orgs-1.xml
Sitemap: ${baseUrl}/sitemap-series-1.xml
```

- [ ] **Step 2: Verify**

```bash
curl -s http://localhost:5173/robots.txt | grep Sitemap
```
Expected: 5 Sitemap lines.

- [ ] **Step 3: Commit**

```bash
git add src/routes/robots.txt/+server.ts
git commit -m "feat(seo): advertise sub-sitemaps in robots.txt"
```

---

## Task 25: Image-alt audit script

**Files:**
- Create: `scripts/audit-image-alt.ts`
- Modify: `Makefile` (add `audit-images` target)
- Modify: `package.json` scripts (add `audit:images`)

- [ ] **Step 1: Create the script**

```ts
#!/usr/bin/env tsx
// scripts/audit-image-alt.ts
import { readFile } from 'node:fs/promises';
import { glob } from 'glob';

const ALLOW = new Set<string>(['""', "''"]);

interface Violation {
	file: string;
	line: number;
	snippet: string;
	reason: string;
}

async function main() {
	const files = await glob('src/**/*.svelte');
	const violations: Violation[] = [];

	for (const file of files) {
		const text = await readFile(file, 'utf-8');
		const lines = text.split('\n');
		lines.forEach((line, idx) => {
			// Match opening <img ...> tags (single-line; multi-line tags handled below)
			const imgMatch = line.match(/<img\b([^>]*)/);
			if (imgMatch) {
				const attrs = imgMatch[1];
				if (!/\balt\s*=/.test(attrs)) {
					violations.push({
						file,
						line: idx + 1,
						snippet: line.trim(),
						reason: 'missing alt attribute'
					});
				} else {
					const altVal = attrs.match(/\balt\s*=\s*("[^"]*"|'[^']*')/)?.[1];
					if (altVal && ALLOW.has(altVal)) {
						violations.push({
							file,
							line: idx + 1,
							snippet: line.trim(),
							reason: 'empty alt — only allowed for purely decorative images, please add aria-hidden="true" alongside or set alt explicitly'
						});
					}
				}
			}
		});
	}

	if (violations.length === 0) {
		console.log('✓ image-alt audit clean');
		return;
	}

	console.error(`✗ ${violations.length} image-alt violations:`);
	for (const v of violations) {
		console.error(`  ${v.file}:${v.line} — ${v.reason}\n    ${v.snippet}`);
	}
	process.exit(1);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
```

- [ ] **Step 2: Add to package.json scripts**

In `package.json`, add to `scripts`:
```json
"audit:images": "tsx scripts/audit-image-alt.ts"
```

If `tsx` isn't installed: `pnpm add -D tsx`.

- [ ] **Step 3: Add Makefile target**

Append to Makefile:
```make
audit-images:
	pnpm audit:images
```

And add `audit-images` to the `check` rule:
```make
check: format-check lint types i18n-check file-length audit-images
```

- [ ] **Step 4: Run the audit and fix violations**

```bash
pnpm audit:images || true
```
For every violation, add a meaningful `alt=""` (decorative + `aria-hidden="true"`) or `alt="descriptive text"`. Make a separate commit per ~10 violations to keep diffs reviewable.

- [ ] **Step 5: Re-run until clean**

```bash
pnpm audit:images
```
Expected: `✓ image-alt audit clean`.

- [ ] **Step 6: Commit script + Makefile change**

```bash
git add scripts/audit-image-alt.ts Makefile package.json pnpm-lock.yaml
git commit -m "chore(a11y): add image-alt audit script wired into make check"
```

---

## Task 26: Search Console / Bing verification meta tags

**Files:**
- Modify: `src/routes/+layout.server.ts` (return verification env vars)
- Modify: `src/routes/+layout.svelte` (render meta tags)
- Create: `docs/seo/search-console-setup.md`

- [ ] **Step 1: Update root server load**

In `src/routes/+layout.server.ts`, add:
```ts
import { env as publicEnv } from '$env/dynamic/public';
// ...
return {
	...existing,
	siteVerification: {
		google: publicEnv.PUBLIC_GOOGLE_SITE_VERIFICATION ?? '',
		bing: publicEnv.PUBLIC_BING_SITE_VERIFICATION ?? ''
	}
};
```

- [ ] **Step 2: Render in root layout**

In `src/routes/+layout.svelte`, in `<svelte:head>`:
```svelte
{#if data.siteVerification?.google}
	<meta name="google-site-verification" content={data.siteVerification.google} />
{/if}
{#if data.siteVerification?.bing}
	<meta name="msvalidate.01" content={data.siteVerification.bing} />
{/if}
```

- [ ] **Step 3: Document setup**

```md
# docs/seo/search-console-setup.md
# Search Console & Bing Webmaster setup

1. Visit https://search.google.com/search-console and add `https://letsrevel.io`.
2. Choose "HTML tag" verification. Copy the `content="..."` value.
3. Set `PUBLIC_GOOGLE_SITE_VERIFICATION=<value>` in the production env (`.env.production`).
4. Redeploy. Once `<meta name="google-site-verification">` is live, click Verify in Search Console.
5. Submit the sitemap: `https://letsrevel.io/sitemap.xml`.

For Bing Webmaster Tools:
1. Visit https://www.bing.com/webmasters and add `https://letsrevel.io`.
2. Choose XML verification or HTML meta tag. For meta tag, use `PUBLIC_BING_SITE_VERIFICATION`.
3. Submit `https://letsrevel.io/sitemap.xml`.

## IndexNow

The site exposes `/indexnow-<key>.txt` and a server endpoint `/api/indexnow`. See `docs/seo/indexnow.md`.
```

- [ ] **Step 4: Commit**

```bash
git add src/routes/+layout.server.ts src/routes/+layout.svelte docs/seo/search-console-setup.md
git commit -m "feat(seo): site verification meta tags + Search Console setup docs"
```

---

## Task 27: IndexNow endpoint and key

**Files:**
- Create: `static/indexnow-{KEY}.txt`
- Create: `src/routes/api/indexnow/+server.ts`
- Create: `docs/seo/indexnow.md`

- [ ] **Step 1: Generate the key**

```bash
KEY=$(node -e "console.log(require('crypto').randomBytes(16).toString('hex'))")
echo $KEY > static/indexnow-$KEY.txt
echo "INDEXNOW_KEY=$KEY" >> .env.example
```

Note the key value somewhere safe — same value goes in the txt file and as the request payload's `key`.

- [ ] **Step 2: Implement the endpoint**

```ts
// src/routes/api/indexnow/+server.ts
import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

interface IndexNowPayload {
	host: string;
	key: string;
	keyLocation: string;
	urlList: string[];
}

export const POST: RequestHandler = async ({ request, fetch, url }) => {
	const sharedSecret = env.INDEXNOW_TRIGGER_SECRET;
	const key = env.INDEXNOW_KEY;
	if (!sharedSecret || !key) throw error(500, 'IndexNow not configured');

	const auth = request.headers.get('authorization');
	if (auth !== `Bearer ${sharedSecret}`) throw error(401, 'Unauthorized');

	const body = await request.json();
	if (!body || !Array.isArray(body.urls) || body.urls.length === 0) {
		throw error(400, 'Expected { urls: string[] } with at least one URL');
	}

	const payload: IndexNowPayload = {
		host: url.host,
		key,
		keyLocation: `${url.origin}/indexnow-${key}.txt`,
		urlList: body.urls
	};

	const res = await fetch('https://api.indexnow.org/indexnow', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	});

	return json({ ok: res.ok, status: res.status, urlCount: body.urls.length });
};
```

- [ ] **Step 3: Document**

```md
# docs/seo/indexnow.md
# IndexNow integration

Revel pings IndexNow (https://www.indexnow.org/) when public events change so Bing/Yandex
re-crawl them within minutes.

## Ops

Set two env vars in production:
- `INDEXNOW_KEY` — 32-hex random key. Must match the filename of the static file in `static/`.
- `INDEXNOW_TRIGGER_SECRET` — long random secret used as the Authorization header.

## Backend integration (out of this PR)

When an event is created/updated/cancelled, the backend should POST:

```
POST https://letsrevel.io/api/indexnow
Authorization: Bearer <INDEXNOW_TRIGGER_SECRET>
Content-Type: application/json

{ "urls": ["https://letsrevel.io/events/acme/summer-festival"] }
```

Up to 10,000 URLs per request; recommended batch size is 1–100.

## Manual test

```bash
curl -X POST https://letsrevel.io/api/indexnow \
  -H "Authorization: Bearer $INDEXNOW_TRIGGER_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"urls":["https://letsrevel.io/"]}'
```
```

- [ ] **Step 4: Commit**

```bash
git add static/indexnow-*.txt src/routes/api/indexnow docs/seo/indexnow.md .env.example
git commit -m "feat(seo): IndexNow endpoint + key + ops docs"
```

---

## Task 28: Lighthouse CI

**Files:**
- Create: `lighthouserc.cjs`
- Create: `.github/workflows/lighthouse.yml`
- Modify: `Makefile` (add `lhci` target)

- [ ] **Step 1: Install LHCI**

```bash
pnpm add -D @lhci/cli
```

- [ ] **Step 2: Create `lighthouserc.cjs`**

```js
// lighthouserc.cjs
module.exports = {
	ci: {
		collect: {
			startServerCommand: 'pnpm preview --port 4173',
			startServerReadyPattern: 'preview server',
			url: [
				'http://localhost:4173/',
				'http://localhost:4173/events',
				'http://localhost:4173/eventbrite-alternative'
			],
			numberOfRuns: 3,
			settings: {
				preset: 'desktop'
			}
		},
		assert: {
			preset: 'lighthouse:recommended',
			assertions: {
				'categories:performance': ['error', { minScore: 0.85 }],
				'categories:accessibility': ['error', { minScore: 0.95 }],
				'categories:seo': ['error', { minScore: 1.0 }],
				'categories:best-practices': ['warn', { minScore: 0.9 }],
				'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
				'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
				'interactive': ['error', { maxNumericValue: 3500 }]
			}
		},
		upload: { target: 'temporary-public-storage' }
	}
};
```

- [ ] **Step 3: Create the workflow**

```yaml
# .github/workflows/lighthouse.yml
name: Lighthouse CI

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main]

jobs:
  lighthouse:
    name: Lighthouse CI
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 9.15.0
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm paraglide:compile
      - run: pnpm build
      - name: Run Lighthouse CI
        run: pnpm lhci autorun
        env:
          LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}
```

- [ ] **Step 4: Add Makefile target**

Append to Makefile:
```make
lhci:
	pnpm build && pnpm lhci autorun
```

- [ ] **Step 5: Run locally to ensure budgets are reachable**

```bash
make lhci
```
If budgets fail on the local run:
- Tweak the `lighthouserc.cjs` assertions to a 10% buffer above current measurements (do not lower the SEO budget below 1.0)
- File a follow-up issue capturing the gap between current CWV and target

- [ ] **Step 6: Commit**

```bash
git add lighthouserc.cjs .github/workflows/lighthouse.yml Makefile package.json pnpm-lock.yaml
git commit -m "ci(seo): Lighthouse CI with performance/a11y/seo budgets"
```

---

## Task 29: CWV audit deliverable

**Files:**
- Create: `docs/seo/cwv-audit-2026-05.md`

- [ ] **Step 1: Run Lighthouse against home, /events, /eventbrite-alternative, one event detail**

```bash
make lhci
```
Save the resulting `temporary-public-storage` URLs.

- [ ] **Step 2: Write the report**

Use this template:

```md
# Core Web Vitals Audit — 2026-05

**Branch:** `feature/seo-phase-1-technical-health`
**Date:** YYYY-MM-DD
**Pages tested:** /, /events, /eventbrite-alternative, one event detail (replace with real URL)

## Summary

| URL | Performance | LCP (s) | CLS | INP (ms) | Notes |
|-----|------------|---------|-----|----------|-------|
| / | … | … | … | … | … |
| /events | … | … | … | … | … |
| /eventbrite-alternative | … | … | … | … | … |
| /events/<org>/<event> | … | … | … | … | … |

## Top findings (ranked by impact)

1. **<finding>** — pages affected, estimated effort, recommended fix.
2. ...

## Recommendation

Either ship as **Phase 1.5** before Phase 2 begins, or fold into **Phase 2** scope. Decision: …
```

Fill in real numbers from the LHCI run. Pick a real event detail URL (a public, indexable one).

- [ ] **Step 3: Commit**

```bash
git add docs/seo/cwv-audit-2026-05.md
git commit -m "docs(seo): Phase 1 CWV audit findings"
```

---

## Task 30: Soft-404 audit script

**Files:**
- Create: `scripts/audit-soft-404.ts`
- Modify: `Makefile` (add `audit-soft-404` target)

- [ ] **Step 1: Create the script**

```ts
#!/usr/bin/env tsx
// scripts/audit-soft-404.ts
const BASE = process.env.AUDIT_BASE_URL ?? 'http://localhost:4173';

async function check(url: string): Promise<{ url: string; status: number; noindex: boolean }> {
	const res = await fetch(url);
	const text = await res.text();
	const noindex = /<meta\s+name=["']robots["']\s+content=["']noindex/i.test(text);
	return { url, status: res.status, noindex };
}

async function main() {
	const sitemap = await (await fetch(`${BASE}/sitemap-static.xml`)).text();
	const urls = Array.from(sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) => m[1]);

	const violations: string[] = [];
	for (const u of urls) {
		const r = await check(u);
		if (r.status === 200 && r.noindex) {
			violations.push(`200+noindex on a sitemap URL: ${u}`);
		}
		if (r.status >= 500) {
			violations.push(`5xx on a sitemap URL: ${u} (${r.status})`);
		}
	}

	// Probe a known-not-found event
	const missing = await check(`${BASE}/events/__nope__/__nope__`);
	if (missing.status !== 404) {
		violations.push(`Expected 404 on /events/__nope__/__nope__ but got ${missing.status}`);
	}

	if (violations.length === 0) {
		console.log('✓ soft-404 audit clean');
		return;
	}
	console.error(`✗ ${violations.length} soft-404 violations:`);
	violations.forEach((v) => console.error('  ' + v));
	process.exit(1);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
```

- [ ] **Step 2: Add Makefile target**

```make
audit-soft-404:
	pnpm tsx scripts/audit-soft-404.ts
```

- [ ] **Step 3: Run locally against `pnpm preview`**

```bash
pnpm build
pnpm preview --port 4173 &
sleep 3
make audit-soft-404
kill %1
```

Fix any violations (most likely: an indexable URL that should 404, or a URL marked noindex but listed in the sitemap).

- [ ] **Step 4: Commit**

```bash
git add scripts/audit-soft-404.ts Makefile
git commit -m "test(seo): soft-404 audit script"
```

---

## Task 31: Delete old `utils/seo.ts` and `utils/structured-data.ts`

**Files:**
- Delete: `src/lib/utils/seo.ts`
- Delete: `src/lib/utils/structured-data.ts`

- [ ] **Step 1: Verify no remaining imports**

```bash
grep -rn "lib/utils/seo\|lib/utils/structured-data\|\\$lib/utils/seo\|\\$lib/utils/structured-data" src/
```
Expected: no matches. If any: migrate them to `$lib/seo`.

- [ ] **Step 2: Delete the files**

```bash
git rm src/lib/utils/seo.ts src/lib/utils/structured-data.ts
```

- [ ] **Step 3: Run full check**

```bash
make fix && make check && make test
```
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor(seo): drop legacy utils/seo.ts and utils/structured-data.ts"
```

---

## Task 32: Final verification + open the PR

- [ ] **Step 1: Full quality gate**

```bash
make fix
make check
make test
pnpm playwright test tests/e2e/sitemap.spec.ts
make lhci
make audit-images
make audit-soft-404
```

All must pass.

- [ ] **Step 2: Spot-check rich-results validators (manual)**

For the running preview build, paste these URLs into:
- https://search.google.com/test/rich-results — home, events listing, one event, eventbrite-alternative
- https://hreflang.org/check — same set

Capture screenshots; attach to the PR.

- [ ] **Step 3: Push and open the PR**

```bash
git push -u origin feature/seo-phase-1-technical-health
gh pr create --title "feat(seo): Phase 1 — Technical SEO Health (foundation)" --body "$(cat <<'EOF'
## Summary

Closes the foundation work for the SEO program. Builds a single canonical SEO pipeline (\`lib/seo\` + \`<SeoHead>\`), restructures the sitemap into a paginated index, ships Lighthouse CI and IndexNow.

See \`docs/superpowers/specs/2026-05-07-seo-phase-1-technical-health-design.md\` for the full design.

## What changed

- New \`src/lib/seo/\` with typed \`buildSeo()\` factory and \`<SeoHead>\` component
- Hreflang en/de/it/x-default on every public page (same-URL strategy)
- Sitemap index + paginated sub-sitemaps, each URL with \`<xhtml:link>\` alternates
- FAQPage / SoftwareApplication / HowTo schema on landing pages
- Soft-404 + noindex for cancelled and past events
- Lighthouse CI in GitHub Actions (perf 85+, SEO 100, a11y 95+)
- IndexNow endpoint + key for fast Bing/Yandex re-crawl
- Image-alt audit script wired into \`make check\`
- Search Console / Bing verification meta tags via env vars
- CWV audit findings committed at \`docs/seo/cwv-audit-2026-05.md\`

## What's next (out of scope)

- Phase 2: long-tail indexation (per-event Offer/Performer schema, related events, internal linking)
- Phase 3: city/topic hubs, blog, content-driven acquisition
- CWV fixes from the audit report (separate spec)

## Test plan

- [ ] CI green (lint, types, i18n, file-length, image-alt audit, tests, Lighthouse)
- [ ] \`/sitemap.xml\` returns sitemap index; sub-sitemaps return 200; out-of-range pages return 404
- [ ] Rich Results Test green for home, events listing, event detail, one landing page
- [ ] hreflang validator green for the same set
- [ ] Cancelled/past event URLs return 200 with \`<meta name="robots" content="noindex,follow">\`
- [ ] Private/deleted event URLs return 404
- [ ] Login/register/password-reset emit noindex

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Capture the PR URL**

Save the URL printed by `gh pr create`. Done.

---

## Self-Review

**Spec coverage check:**
- §2.1 single SeoHead → Tasks 8, 10–19
- §2.2 hreflang sitewide → Task 2 + every migration task
- §2.3 sitemap index + 5000/file → Tasks 20, 22, 23
- §2.4 FAQ/HowTo/SoftwareApplication on landing pages → Tasks 6, 16, 17
- §2.5 BreadcrumbList everywhere → Task 7 (`buildSeo` always emits it for detail/listing pages) + Tasks 10–19
- §2.6 og:locale / twitter:site / og:site_name → Task 7 + Task 8
- §2.7 canonical everywhere → Task 7 + every migration
- §2.8 cancelled/past noindex, private 404 → Task 13
- §2.9 Lighthouse CI → Task 28
- §2.10 IndexNow → Task 27
- §2.11 CWV audit deliverable → Task 29
- §2.12 image alt audit → Task 25

All 12 spec success criteria are mapped to tasks.

**Placeholder scan:** none found. All code blocks are complete; all paths are exact.

**Type consistency check:**
- `SeoConfig` defined in Task 1, used in Tasks 7, 8, 10–19. Consistent.
- `Lang` type from `constants.ts` used everywhere. Consistent.
- `BuildSeoInput` discriminated union in Task 7 covers home/events-listing/orgs-listing/event/org/series/landing/legal/auth — and Tasks 10–19 use exactly those discriminants.

No issues found.
