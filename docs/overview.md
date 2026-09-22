# Frontend overview

How the web app is put together. For setup, see the [README](../README.md) and
[`runbooks/setup.md`](runbooks/setup.md).

## Rendering strategy

- Public pages (event pages, organization pages, discovery, landing pages) use server-side
  rendering for SEO and first load.
- Authenticated dashboards and the organizer admin use hybrid SSR/CSR.
- Client-only pages disable SSR per route (`export const ssr = false`), for example the
  membership verification scanner and the venue seat designer.

## Authentication flow

1. The user submits credentials to a SvelteKit server endpoint, which calls the backend API.
2. The access token is kept in memory on the client, never in `localStorage`.
3. The refresh token is stored in an httpOnly cookie.
4. Expired access tokens are refreshed automatically.
5. TOTP two-factor login and OpenID Connect sign-in (Google, Keycloak, Authentik and others, as
   configured on the backend) are supported.

## SEO landing pages

Multi-language landing pages for specific audiences. Every page ships in six locales: `/{slug}`
(English) plus the `/de/`, `/it/`, `/fr/`, `/es/` and `/pt/` prefixes (e.g.
`/fr/eventbrite-alternative`), with `hreflang` alternates between them.

| Page | Slug | Audience |
|------|------|----------|
| Eventbrite Alternative | `eventbrite-alternative` | Cost-conscious organizers |
| Queer Event Management | `queer-event-management` | LGBTQ+ communities |
| Kink Event Ticketing | `kink-event-ticketing` | Kink/BDSM communities |
| Self-Hosted Platform | `self-hosted-event-platform` | Self-hosters |
| Privacy-Focused Events | `privacy-focused-events` | GDPR/European market |
| Community-First Platform | `community-first-event-platform` | Book clubs, hobby groups, networks |
| Club Membership Management | `club-membership-management` | Gyms, yoga studios, dance schools, choirs |

Each page has keyword-targeted meta titles and descriptions, JSON-LD structured data (WebPage,
FAQPage, BreadcrumbList), internal links between related pages and CTAs to the
demo, GitHub and contact.

Content lives in `src/lib/data/landing-pages/` (one module per slug, all six locales).

## Accessibility

WCAG 2.1 AA is the minimum target. That means:

- All interactive elements are reachable and operable by keyboard.
- Semantic HTML, ARIA labels and live regions for screen readers.
- Text contrast of at least 4.5:1.
- Visible focus indicators.
- Mobile-first layouts.

Playwright runs an axe accessibility smoke test (`a11y-smoke.spec.ts`).
