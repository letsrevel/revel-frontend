# SEO Phase 1 — Technical SEO Health (Foundation)

**Status:** Draft for implementation
**Date:** 2026-05-07
**Branch:** `feature/seo-phase-1-technical-health`
**Scope owner:** Frontend
**Backend changes required:** None

---

## 1. Goal

Make the SEO signals the site already emits **correct, consistent, and machine-validatable**, and add the measurement spine that prevents future regressions. This is the foundation that Phases 2 (long-tail indexation) and 3 (acquisition / content hubs) will build on.

We are not chasing rankings yet. We are removing the leaks that prevent later content investment from compounding.

---

## 2. Success criteria

1. Every public route emits its meta tags through a single `<SeoHead>` component — no inline `<meta>` drift.
2. Hreflang annotations (`en` / `de` / `it` / `x-default`) are present on **every** public page, not just hand-rolled landing pages. Strategy: same URL → same URL (Paraglide localizes chrome only; organizer content is single-language).
3. Sitemap is split into a **sitemap index** with paginated sub-sitemaps capped at 5,000 URLs each, and each `<url>` carries `<xhtml:link rel="alternate" hreflang>` entries.
4. The 5 SEO landing pages (× 3 locales = 15 pages) emit `FAQPage`, `HowTo`, and `SoftwareApplication` JSON-LD where applicable.
5. `BreadcrumbList` JSON-LD appears on every detail/listing page (events, orgs, series, listings).
6. `og:locale`, `og:locale:alternate`, `twitter:site`, `og:site_name` appear sitewide.
7. Canonical URL appears on every public page; never points to a non-200 URL; never has trailing-slash drift.
8. Cancelled / deleted / private events return `404` (not 200 with empty body) and emit `noindex`.
9. Lighthouse CI runs on every PR; fails the build if LCP > 2.5s, CLS > 0.1, or INP > 200ms on the home, /events, and one event detail page.
10. IndexNow ping fires on event publish/update; new events are surfaced to Bing/Yandex within minutes.
11. A written CWV audit report (one document) lists findings + suggested fixes; **fixes themselves are out of scope** for Phase 1.
12. All cover images have descriptive `alt` text; the audit script enforces it.

---

## 3. Out of scope (explicitly)

- Dynamic OG image generation (defer to its own spec)
- City / topic / category landing pages (Phase 3)
- Blog / content marketing (Phase 3)
- Per-locale URL prefixes for dynamic content (rejected — locale strategy is "same URL, hreflang same→same")
- Backend changes (event content remains single-language; no translation pipeline)
- AggregateOffer / Performer / Speaker schema (Phase 2)
- Actually fixing CWV findings (audit only — fixes become a follow-up)
- Internal linking / "related events" (Phase 2)

---

## 4. Architecture

### 4.1 New module layout

```
src/lib/seo/
├── SeoHead.svelte              # Single component used by every public page
├── build.ts                    # buildSeo(config) → assembled SeoConfig
├── hreflang.ts                 # getHreflangAlternates(pathname, origin)
├── jsonld/
│   ├── index.ts                # re-exports
│   ├── event.ts                # generateEventStructuredData (moved)
│   ├── organization.ts         # generateOrganizationStructuredData (moved)
│   ├── series.ts               # generateEventSeriesStructuredData (moved)
│   ├── website.ts              # WebSite + SearchAction (moved)
│   ├── breadcrumb.ts           # BreadcrumbList (moved)
│   ├── itemlist.ts             # ItemList (moved)
│   ├── faq.ts                  # FAQPage (new)
│   ├── howto.ts                # HowTo (new)
│   └── software.ts             # SoftwareApplication (new)
├── faq-content/
│   ├── eventbrite-alternative.ts   # FAQ items per landing page (i18n keys)
│   ├── queer-event-management.ts
│   ├── kink-event-ticketing.ts
│   ├── self-hosted-event-platform.ts
│   ├── privacy-focused-events.ts
│   └── community-first-event-platform.ts
└── index.ts                    # public surface

src/lib/utils/seo.ts            # KEPT for backward compat as a thin re-export shim during migration; deleted at end
src/lib/utils/structured-data.ts # KEPT same way; deleted at end

src/routes/
├── sitemap.xml/+server.ts                   # → sitemap INDEX
├── sitemap-static.xml/+server.ts            # static pages + 18 landing pages
├── sitemap-events-[page].xml/+server.ts     # paginated 5000/file
├── sitemap-orgs-[page].xml/+server.ts
├── sitemap-series-[page].xml/+server.ts
└── api/indexnow/+server.ts                  # POST endpoint, called from event mutations
```

### 4.2 Boundaries

- **`<SeoHead>`** is the **only** place `<svelte:head>` writes meta/link/JSON-LD for SEO purposes. Pages may still use `<svelte:head>` for non-SEO concerns (e.g., page-specific styles).
- **`build.ts`** is the only place where `MetaTags`, JSON-LD, and hreflang are assembled into the final `SeoConfig`. Pages call `buildSeo(...)`; they don't compose pieces by hand.
- **`lib/seo/`** depends only on `lib/api` types and `lib/config`. Nothing inside it imports from routes, stores, or components outside `lib/seo`.
- **Routes** call `buildSeo` in `+page.server.ts` (or `+page.ts` for client-load), pass result to the page, page passes it to `<SeoHead>`.

---

## 5. Component contracts

### 5.1 `SeoConfig` (the single source of truth)

```ts
interface SeoConfig {
  title: string;                            // <title>
  description: string;                      // <meta name="description">
  canonical: string;                        // absolute URL
  robots?: 'index,follow' | 'noindex,follow' | 'noindex,nofollow';
  og: {
    type: 'website' | 'profile' | 'event' | 'article';
    title: string;
    description: string;
    url: string;
    image?: string;                         // absolute
    siteName: 'Revel';
    locale: 'en_US' | 'de_DE' | 'it_IT';
    localeAlternate: string[];              // other locales
  };
  twitter: {
    card: 'summary' | 'summary_large_image';
    title: string;
    description: string;
    image?: string;
    site: '@letsrevel';                     // configured constant
  };
  hreflang: Array<{ lang: 'en' | 'de' | 'it' | 'x-default'; href: string }>;
  jsonLd: object[];                         // already-shaped schema.org objects
}
```

### 5.2 `<SeoHead>` component

```svelte
<script lang="ts">
  interface Props { config: SeoConfig }
  const { config }: Props = $props();
</script>

<svelte:head>
  <title>{config.title}</title>
  <meta name="description" content={config.description} />
  <link rel="canonical" href={config.canonical} />
  {#if config.robots}<meta name="robots" content={config.robots} />{/if}

  <meta property="og:type" content={config.og.type} />
  <meta property="og:title" content={config.og.title} />
  <meta property="og:description" content={config.og.description} />
  <meta property="og:url" content={config.og.url} />
  <meta property="og:site_name" content={config.og.siteName} />
  <meta property="og:locale" content={config.og.locale} />
  {#each config.og.localeAlternate as alt}
    <meta property="og:locale:alternate" content={alt} />
  {/each}
  {#if config.og.image}<meta property="og:image" content={config.og.image} />{/if}

  <meta name="twitter:card" content={config.twitter.card} />
  <meta name="twitter:title" content={config.twitter.title} />
  <meta name="twitter:description" content={config.twitter.description} />
  <meta name="twitter:site" content={config.twitter.site} />
  {#if config.twitter.image}<meta name="twitter:image" content={config.twitter.image} />{/if}

  {#each config.hreflang as alt}
    <link rel="alternate" hreflang={alt.lang} href={alt.href} />
  {/each}

  {#each config.jsonLd as block}
    {@html `<script type="application/ld+json">${toJsonLd(block)}</script>`}
  {/each}
</svelte:head>
```

### 5.3 `buildSeo(...)` factory

A discriminated-union API so every page type gets a typed call site:

```ts
type BuildSeoInput =
  | { kind: 'home'; url: URL; lang: Lang }
  | { kind: 'events-listing'; url: URL; lang: Lang }
  | { kind: 'orgs-listing'; url: URL; lang: Lang }
  | { kind: 'event'; url: URL; lang: Lang; event: EventDetailSchema; indexable: boolean }
  | { kind: 'org'; url: URL; lang: Lang; org: OrganizationRetrieveSchema }
  | { kind: 'series'; url: URL; lang: Lang; series: EventSeriesRetrieveSchema }
  | { kind: 'landing'; url: URL; lang: Lang; slug: SeoPageSlug }
  | { kind: 'legal'; url: URL; lang: Lang; doc: 'privacy' | 'terms' }
  | { kind: 'auth'; url: URL; lang: Lang; page: 'login' | 'register' | 'password-reset' };

export function buildSeo(input: BuildSeoInput): SeoConfig;
```

`indexable: false` means the page renders normally (200 OK) but emits `robots: 'noindex,follow'`. This is the case for **cancelled events** and events whose `start` is in the past — users with a link can still see them, but they shouldn't appear in search results. Pages that should not exist at all (private events, deleted events, hidden-after-end events whose hide-time has passed) are handled at the load-function level via `throw error(404, ...)` — they never reach `buildSeo`.

### 5.4 Hreflang policy ("same URL, same→same")

For every public page:

- emit `<link rel="alternate" hreflang="en" href={pathname}>`
- emit `<link rel="alternate" hreflang="de" href={pathname}>`
- emit `<link rel="alternate" hreflang="it" href={pathname}>`
- emit `<link rel="alternate" hreflang="x-default" href={pathname}>`

**Exception — the 5 hand-rolled landing pages:** they keep their existing per-locale variants (`/eventbrite-alternative`, `/de/eventbrite-alternative`, `/it/eventbrite-alternative`) and emit hreflang pointing to the actual locale-specific URLs.

---

## 6. Sitemap restructure

### 6.1 `/sitemap.xml` becomes a sitemap index

```xml
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>{origin}/sitemap-static.xml</loc><lastmod>{build}</lastmod></sitemap>
  <sitemap><loc>{origin}/sitemap-events-1.xml</loc><lastmod>{now}</lastmod></sitemap>
  <sitemap><loc>{origin}/sitemap-events-2.xml</loc><lastmod>{now}</lastmod></sitemap>
  <sitemap><loc>{origin}/sitemap-orgs-1.xml</loc><lastmod>{now}</lastmod></sitemap>
  <sitemap><loc>{origin}/sitemap-series-1.xml</loc><lastmod>{now}</lastmod></sitemap>
</sitemapindex>
```

The index dynamically computes how many `events-N.xml` files to advertise based on event count / 5000.

### 6.2 Per-URL hreflang annotations

Each `<url>` entry in events/orgs/series sub-sitemaps gets:

```xml
<url>
  <loc>{eventUrl}</loc>
  <xhtml:link rel="alternate" hreflang="en" href="{eventUrl}"/>
  <xhtml:link rel="alternate" hreflang="de" href="{eventUrl}"/>
  <xhtml:link rel="alternate" hreflang="it" href="{eventUrl}"/>
  <xhtml:link rel="alternate" hreflang="x-default" href="{eventUrl}"/>
  <lastmod>{event.updated_at}</lastmod>
  <changefreq>weekly</changefreq>
  <priority>{computed}</priority>
  <image:image>...</image:image>
</url>
```

For landing pages in `sitemap-static.xml`, the hreflang entries point to the actual per-locale variants (matching the in-page hreflang).

### 6.3 Pagination contract

- Each sub-sitemap caps at 5,000 URLs.
- Pages are 1-indexed.
- Out-of-range page numbers return 404.
- Pages cache for 1 hour with `stale-while-revalidate=86400`.

### 6.4 Robots.txt update

Add the new index location and the `Sitemap:` line for each sub-sitemap (Google ignores duplicates but Bing/Yandex like explicit listing).

---

## 7. JSON-LD additions for landing pages

For the 5 landing pages × 3 locales:

- **`SoftwareApplication`** (or `WebApplication`): name "Revel", category "EventManagement", offers (free), aggregateRating (only when we have real data — Phase 3), screenshot URL.
- **`FAQPage`**: 5–8 Q/A pairs per landing page. Content stored in `lib/seo/faq-content/{slug}.ts` with i18n keys; FAQ accordion is rendered visibly on the page (Google requires the FAQ content to be visible, not just in JSON-LD).
- **`HowTo`** (only on `self-hosted-event-platform`, where steps are real and verifiable).

The visible FAQ accordion is a small UI addition (uses existing `bits-ui` Accordion). FAQ copy is reviewed by the user before publication.

---

## 8. Soft-404 handling

The current event detail load function returns the event regardless of status. Required changes:

**Two distinct behaviors:**

1. **200 + noindex** (page exists for direct-link visitors but is removed from search):
   - Cancelled events
   - Events whose `start` date is past (default; configurable per-org later)
   - Implementation: load function sets `setHeaders({ 'X-Robots-Tag': 'noindex' })`; `buildSeo({kind: 'event', indexable: false})` emits `<meta name="robots" content="noindex,follow">`.

2. **404** (page should not exist for anyone without explicit access):
   - Private events (`visibility !== 'public'`) — for unauthenticated users
   - Deleted / soft-deleted events
   - Past events with `hide_after_end` enabled
   - Private organizations
   - Implementation: load function `throw error(404, ...)`. Never reaches `buildSeo`.

Audit: write a script that crawls `/events`, `/organizations`, follows links to detail pages, asserts only 200s and 404s — no 200-with-empty-body, no 200-with-noindex on a discoverable page.

---

## 9. Lighthouse CI

- Config file `lighthouserc.cjs` at repo root.
- Targets: `/`, `/events`, `/eventbrite-alternative`, plus one fixture event detail URL.
- Budget:
  - Performance score ≥ 85
  - LCP < 2500ms
  - CLS < 0.1
  - INP < 200ms
  - Accessibility score ≥ 95
  - SEO score = 100 (after Phase 1 ships)
- Runs in GitHub Actions on every PR; fails the workflow on regression.
- Reports uploaded to LHCI public storage.

---

## 10. IndexNow

- Generate a static key file: `static/indexnow-{key}.txt` (key is 32-hex random, committed to repo).
- New endpoint `POST /api/indexnow` (server-only, gated by a shared secret env var) that accepts `{ urls: string[] }` and forwards to `https://api.indexnow.org/indexnow` with the key.
- Backend webhook config (out of this spec, but documented in Phase 1 README): on event publish/update, backend POSTs `{urls: [eventUrl]}` to `/api/indexnow`.
- For Phase 1, we ship the endpoint + key + docs. The backend integration is a follow-up issue (filed at the end of Phase 1 implementation).

---

## 11. Search Console & Bing Webmaster

- Add verification meta tags as env-driven values (`PUBLIC_GOOGLE_SITE_VERIFICATION`, `PUBLIC_BING_SITE_VERIFICATION`) emitted by `<SeoHead>` on the home page only.
- Document submission steps in `docs/seo/search-console-setup.md`.

---

## 12. CWV audit deliverable

A markdown report at `docs/seo/cwv-audit-2026-05.md` with:

- Lighthouse report screenshots for the 4 target URLs (mobile + desktop)
- Top 10 actionable findings ranked by impact
- Estimated effort per finding
- Recommendation on whether to ship as Phase 1.5 or roll into Phase 2

No code fixes ship as part of Phase 1.

---

## 13. Image alt audit

A script `scripts/audit-image-alt.ts` that:

- Greps all `*.svelte` files under `src/` for `<img` and `<Image` tags
- Flags any without an `alt` attribute or with empty/static placeholder alt
- Runs in CI (added to `make check`)

Initial run will produce a list; we fix the violations as part of Phase 1 (small, mechanical).

---

## 14. Migration strategy

The `<SeoHead>` rollout is incremental and safe:

1. Land `lib/seo/` + `<SeoHead>` + `buildSeo` as new code; old `utils/seo.ts` and `utils/structured-data.ts` remain intact.
2. Migrate routes one at a time, in this order:
   1. Home (`(public)/+page.svelte`)
   2. Events listing
   3. Organizations listing
   4. Event detail
   5. Org detail
   6. Event series detail
   7. The 6 SEO landing pages × 3 locales (18 routes)
   8. Legal pages (privacy, terms)
   9. Auth pages (login, register, password-reset, verify, unsubscribe) — emit `noindex,follow`
3. Each migration is a small commit (~50 lines diff).
4. After all routes are migrated, delete the old `utils/seo.ts` and `utils/structured-data.ts`.
5. Sitemap restructure ships as a single PR after all in-page meta tags are migrated.
6. Lighthouse CI added at the end so the migrated state defines the baseline.

---

## 15. Risks & mitigations

| Risk | Mitigation |
|------|-----------|
| Hreflang same→same misinterpreted by Google as duplicate content | Documented; Google guidance explicitly supports same URL across locales when content is partially localized. We'll monitor Search Console after launch. |
| Sitemap index breaks Google's existing crawl pattern | Sitemap submission docs include "remove old sitemap, submit new index" step. |
| Lighthouse CI flakes on slow CI runners | Use 3 runs + median; budgets set with 10% buffer above current measurements. |
| `<SeoHead>` JSON-LD `{@html}` is a CSP concern | Strings escape `</` to `</`. Existing CSP allows `'self'` for scripts; inline `application/ld+json` is permitted. |
| FAQ schema flagged as spammy if Q/A is generic | First-pass FAQ copy reviewed by user before merge; tied to actual user questions, not keyword stuffing. |

---

## 16. Acceptance checklist

- [ ] `<SeoHead>` used on every route in `src/routes/(public)/`
- [ ] `utils/seo.ts` and `utils/structured-data.ts` deleted
- [ ] Sitemap index returns valid XML; sub-sitemaps validated against `https://www.xml-sitemaps.com/validate-xml-sitemap.html`
- [ ] All sitemap URLs return 200 (verified by audit script)
- [ ] Hreflang on every public route, validated by https://hreflang.org/check
- [ ] FAQPage / HowTo / SoftwareApplication JSON-LD validates at https://search.google.com/test/rich-results
- [ ] Lighthouse CI green on home + events + one event detail
- [ ] IndexNow key file accessible; endpoint test passes
- [ ] CWV audit report committed
- [ ] Image alt audit clean
- [ ] Soft-404 audit clean

---

## 17. What's deferred to Phase 2 / 3

- **Phase 2**: AggregateOffer (per-tier), Performer, Speaker schema; per-event "related events" links; "more from this organizer"; per-event SEO score in admin; OG image fallback chain enforcement; CWV fixes from audit.
- **Phase 3**: City hubs, topic hubs, blog, AggregateRating from past events, more SEO landing pages, link-building program.
