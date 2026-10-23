# Tenant mode (custom domains and white-label)

Tenant mode lets one deployment of this app serve an organization on its own domain, for example
`events.example.org`. On that domain the whole site is the organization's: its page is the home
page, the header and footer carry its name, its brand colors apply everywhere, and none of the
platform's discovery or marketing pages show up.

This page describes what the frontend does. Domain registration, DNS and TLS (Cloudflare for SaaS
or similar) are backend and operator concerns, covered in the operator docs
([letsrevel/revel-backend#1166](https://github.com/letsrevel/revel-backend/issues/1166)). The
deployment variables are also listed in [`runbooks/deployment.md`](runbooks/deployment.md).

Tenant mode is off until `PLATFORM_HOSTS` is set, so deploying this code changes nothing by itself.

## How a request becomes a tenant

Implemented in `src/lib/server/tenant.ts`. `handleTenant` is the second hook in the chain in
`src/hooks.server.ts`: after request logging, before token capture, auth, i18n and rendering. A
host that is not the platform therefore never reaches cookie-setting or page code unless it
resolves to an organization.

1. **Platform or tenant candidate.** The request host is lowercased and its port and trailing dot
   are removed. It is a platform host when:
   - `PLATFORM_HOSTS` is unset or empty (tenant mode off, every host is the platform), or
   - the host is `localhost`, `127.0.0.1`, `::1` or `[::1]` (always platform, so the container
     `HEALTHCHECK` on `localhost:3000` works), or
   - the host is in the `PLATFORM_HOSTS` list (comma separated, case-insensitive, no ports).

   Anything else is a tenant candidate. `*.localhost` is deliberately a candidate, which is what
   dev and E2E use.
2. **Lookup.** A candidate that does not look like a DNS name (anything outside `a-z 0-9 . -`) is
   treated as unknown without calling the backend. Otherwise the app calls the public, anonymous
   `GET /api/organizations/by-domain/{hostname}` through `event.fetch`, with a 3 second timeout. Going
   through `event.fetch` means `handleFetch` forwards the client IP and request id as usual.
3. **Result.**

   | Backend answer              | Response                                                    |
   | --------------------------- | ----------------------------------------------------------- |
   | Organization found          | Request continues; `event.locals.tenant` is set             |
   | 404 (unknown domain)        | Bare `404` with the body `Not found`, never the app shell   |
   | Timeout, 5xx, bad payload   | `503` with `Retry-After: 5`                                 |

   On a platform host `locals.tenant` is `null`. The root layout passes `tenant` to every page as
   `page.data.tenant`.

**Cache.** Per Node process, so each replica has its own:

| Entry                    | TTL   |
| ------------------------ | ----- |
| Found organization       | 60 s  |
| Unknown host (negative)  | 15 s  |
| Upstream failure         | not cached |

The cache holds at most 500 hosts and evicts the oldest first. Concurrent first requests for the
same host share one backend call. The 503 path logs a `tenant_lookup_unavailable` warning at most once
every 10 seconds. After an organization changes or removes its domain, expect up to 60 s (found)
or 15 s (unknown) before every replica agrees.

## Route scoping

Implemented in `src/lib/server/tenant-routing.ts`, applied by `handleTenantRouting` right after
`handleTenant`. A tenant host serves one organization, so platform pages must not render there.
The decision is a pure function, `tenantRouteDecision`, driven by a rule per top-level path
segment. Redirects are `302` with `Cache-Control: no-store`.

| Path (first segment)                                                             | On a tenant host                                                          |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `/` (empty path)                                                                 | Allowed (renders the organization page)                                   |
| `/org/{tenant slug}/...` (not `/admin`)                                          | Allowed                                                                   |
| `/org/{uuid}/membership`                                                         | Allowed (legacy Stripe return route; the slug page is re-checked after its redirect) |
| `/events/{tenant slug}/...`                                                      | Allowed                                                                   |
| `/events/confirm-action`                                                         | Allowed                                                                   |
| `/events/{uuid}/...`                                                             | Allowed (legacy UUID routes redirect to slug URLs, which are re-checked)  |
| `/embed/{tenant slug}...`                                                        | Allowed                                                                   |
| `login`, `logout`, `register`, `password-reset`, `verify`                        | Allowed                                                                   |
| `account`, `dashboard`, `legal`, `unsubscribe`, `join`                           | Allowed                                                                   |
| `api`, `auth`, `_app`, `.well-known`                                             | Allowed                                                                   |
| `robots.txt`, `feed.xml`, `opensearch.xml`, `oembed`                             | Allowed (each handler is tenant-aware, see [SEO](#seo-on-tenant-hosts))   |
| Anything starting with `sitemap`, `favicon` or `manifest`                        | Allowed                                                                   |
| `/org/{any}/admin...`                                                            | 302 to the same path and query on the platform origin                     |
| `create-org`, `oauth`, `impersonate`                                             | 302 to the same path and query on the platform origin                     |
| `/org/{other slug}`, `/events/{other slug}`, `/embed/{other slug}`               | 302 to `/`                                                                |
| `organizations`, `referral`                                                      | 302 to `/`                                                                |
| The seven marketing pages (`club-membership-management`, `community-first-event-platform`, `eventbrite-alternative`, `kink-event-ticketing`, `privacy-focused-events`, `queer-event-management`, `self-hosted-event-platform`) | 302 to `/` |
| Localized landing prefixes `de`, `es`, `fr`, `it`, `pt`                          | 302 to `/`                                                                |
| Any other segment, or a malformed path (bad `%` escape, `..`, encoded `/`)       | 302 to `/`                                                                |

Notes on the table:

- `/events` itself (the discovery list) has no tenant slug in it, so it goes to `/`.
  `/events/confirm-action` is the one slugless exception.
- The platform origin is `PLATFORM_ORIGIN`, else `https://` plus the first `PLATFORM_HOSTS`
  entry (see [Environment variables](#environment-variables)). When neither yields a valid
  `http(s)` URL, platform redirects fall back to `/`.
- **Fail-closed.** `ruleForSegment` returns nothing for a segment without a rule, and the decision
  function then redirects to `/`. A new route can never become reachable on tenant hosts by
  accident.
- **The route-walk test.** `src/lib/server/tenant-routing.test.ts` walks `src/routes` and fails when
  a top-level route segment has no entry in `SEGMENT_RULES` or `PREFIX_RULES`. Adding a route means
  adding its rule in the same change.
- `/account/developer-apps` and `/account/connected-apps` are platform and OAuth settings, but the
  `account` rule is `open`, so they are reachable on tenant hosts today. See
  [Known limits](#known-limits-and-follow-ups).

## `/` renders the organization page

On the platform `/` is the landing page. On a tenant host it is the tenant organization's page,
at the root URL.

- `src/routes/(public)/+page.server.ts` checks `locals.tenant`. When set, it returns
  `{ kind: 'org', ...(await loadOrgPage(event, tenant.slug)) }`; otherwise the landing data.
- `loadOrgPage` lives in `src/lib/server/org-page.ts` and is shared with `/org/[slug]`, so both
  URLs render identically. It is what supplies the organization, permissions, resources,
  membership plans, SEO and `brandTheme`.
- The page keeps working at `/org/{tenant slug}` too, but its canonical URL is `/` (see
  [SEO](#seo-on-tenant-hosts)).

## Canonical redirects from the platform

Implemented in `src/lib/server/tenant-canonical.ts`. When an organization has an active custom
domain, its attendee pages on the platform host answer with a `301` to the same path on the domain:

```
https://app.example.com/events/acme/summer-party?ot=abc
  -> 301 https://events.acme.example/events/acme/summer-party?ot=abc
```

- **Query string is preserved**, so `?payment_success`, `?ot=` and `?et=` survive.
- **Where it applies** (the loaders that call `canonicalTenantRedirect`): the organization page
  (through `loadOrgPage`), event page, series page, event questionnaire, organization questionnaire,
  membership page and resources page.
- **Where it never applies:** `/embed/*` (those are iframed on third-party sites), org admin
  routes, anything on a tenant host (`locals.tenant` is set), and organizations without an active
  domain.
- The target origin comes from `customDomainOrigin`, which validates the domain as a bare hostname
  and applies `PUBLIC_CUSTOM_DOMAIN_URL_TEMPLATE`, so a bad value cannot redirect off that origin.

### The Stripe return flow

The backend keeps Stripe success and cancel URLs on the platform, using UUID routes so no names
reach Stripe (`/events/{org_uuid}/{event_uuid}`, `/events/{org_uuid}/series/{series_uuid}`,
`/org/{org_uuid}/membership`). A buyer who started checkout on `events.acme.example` therefore
comes back to the platform host, where their session cookie does not exist. The UUID routes handle
that:

1. The platform UUID route calls `tenantReturnUrl`, which asks the public
   `GET /api/organizations/{organization_id}/custom-domain` endpoint for the organization's domain.
   That endpoint is used instead of the organization retrieve because the retrieve returns 404
   anonymously for private and members-only organizations, and the buyer has no platform session.
2. If the organization has a domain, the route answers `303` to the **same UUID path** on the
   domain, query string intact.
3. On the tenant host the UUID route runs again. `tenantReturnUrl` returns `null` there, so it
   resolves the UUIDs with the buyer's host-only session and answers `303` to the slug page, with
   `payment_success` or `membership_success` still in the query.

Any lookup failure, or an organization with no active domain, returns `null` and the route's
original flow takes over (resolve on the platform, or fall back to `/`). A buyer is never sent to
an error page on the way back from a payment.

## Links to custom domains

`src/lib/utils/org-links.ts`:

| Function                          | Does                                                                                         |
| --------------------------------- | -------------------------------------------------------------------------------------------- |
| `customDomainOrigin(hostname)`    | Origin for a domain from `PUBLIC_CUSTOM_DOMAIN_URL_TEMPLATE`, or `null` if the hostname is absent or malformed |
| `orgOrigin(org)`                  | `customDomainOrigin(org.custom_domain)`                                                      |
| `orgHref(org, path, currentTenantDomain)` | `https://{domain}{path}`, or the plain path when the org has no valid domain or we are already on it |
| `normalizeCustomDomain(domain)`   | Lowercased, validated hostname (dot-separated DNS labels, at least one dot) or `null`        |
| `tenantDomainFrom(page.data)`     | The current tenant's domain from layout data, to pass as `currentTenantDomain`              |

Use `orgHref` for every link to an organization's attendee pages (event, series, org, membership).
Do not use it for admin routes, which stay on the platform. Where it is used: event, series and
organization cards, the calendar modal (a full navigation, because `goto` refuses cross-origin
URLs), the user menu, the dashboard organization and following lists, embed links, ICS output and
SEO canonicals. `withUtmParams` keeps cross-origin hrefs.

The template is read at runtime. It must start with `http://` or `https://` and contain
`{hostname}`; anything else falls back to `https://{hostname}` and logs once on the server. Trailing
slashes are removed.

**SSR-relative paths.** During SSR, SvelteKit's `resolve()` returns page-relative paths such as
`./events/x` or `../../org/x` (the `paths.relative` default). Prefixing an origin to one would give
`https://host./events/x`. `orgHref` strips the leading `./` and `../` segments to get a root-relative
path first. The app has no base path, so this is safe.

## Tenant chrome

`PublicLayout.svelte` and `AuthLayout.svelte` check `page.data.tenant`. When set they render
`src/lib/components/tenant/TenantHeader.svelte` and `TenantFooter.svelte` instead of the platform
header and footer. The platform path is unchanged.

- **Header:** organization logo (or its first letter) and name, linking to `/`. Nav items: Events
  (`/`), Membership (only when the org has membership plans or accepts membership requests) and
  Resources (only when the org has resources). Theme switcher, language switcher, Login and Sign up
  (or the account menu when signed in), and a mobile drawer that reuses `MobileNav`.
- **Footer:** "© {year} {organization}", then "Powered by Revel · Privacy · Terms". "Revel" links to
  the platform origin from layout data (`platformOrigin`), or is plain text if none is configured.
  Privacy and Terms point at the app's own `/legal/*` pages.
- **Account menu:** `UserMenu.svelte` detects the tenant and drops the organization admin entries,
  "create organization" and the referral entry, and skips fetching the user's organizations. Those
  live on the platform.
- **SSO is hidden.** `SsoProviderButtons.svelte` renders nothing on a tenant host, divider included,
  because the OIDC callback is pinned to the platform. Email and password login works. See
  [Known limits](#known-limits-and-follow-ups).

Strings for the chrome are in the `tenantChrome` block of all six locale files.

## Brand colors

The backend computes everything about contrast. For each mode (light and dark) it shifts the
organization's chosen primary until it clears the background, then picks black or white for the
foreground. The frontend never adjusts a color. `src/lib/utils/brand-theme.ts` only converts the
backend's `#RRGGBB` values into the `H S% L%` triplets the CSS tokens use, and drops anything that
is not a strict 6-digit hex. That is also why the output can go into a `<style>` tag without
escaping.

`src/lib/components/brand/OrgBrandStyle.svelte` injects the result into `<head>`. It is rendered once
from `src/routes/+layout.svelte`, outside the embed branch, with:

```svelte
<OrgBrandStyle theme={page.data.brandTheme ?? page.data.tenant?.brand_theme ?? null} />
```

- **Page theme.** Org-scoped loaders (org page, event, series, membership, resources,
  questionnaires, embeds) return `brandTheme` from the organization they load. On the platform that
  is how an organization's colors show up on its own pages only.
- **Tenant theme, app-wide.** On a tenant host the fallback is `tenant.brand_theme`, so login,
  legal, dashboard and account pages carry the organization's colors too. A page that sets its own
  `brandTheme` wins.
- **No theme, no override.** If the organization has no primary color the backend sends `null` and
  nothing is injected.
- **What it overrides.** `--primary`, `--primary-foreground` and `--ring` for each mode, plus
  `--accent` and `--accent-foreground` when the organization set an accent. The rules are scoped to
  `:root:not(.dark)` and `:root.dark`, on `<html>`, so portaled dialogs, sheets and toasts get them
  too.
- **`--poster-band`.** The solid ribbon under org, event and series covers is mode-inert, so it
  takes the organization's **light** primary in both modes. The backend guarantees that color is at
  least 4.5:1 against the white chip that sits on it.

## SEO on tenant hosts

On a tenant host the site is the organization. The helpers are in `src/lib/seo/tenant.ts`;
`siteName(tenant)` is the single place that chooses between the organization name and "Revel".

| Surface                | Tenant host behavior                                                                                  |
| ---------------------- | ----------------------------------------------------------------------------------------------------- |
| Titles                 | Org page: `Org`. Event, series, login, register, legal, membership: `Page \| Org` (`withSiteName`)    |
| Open Graph / Twitter   | `og:site_name` is the org; no `twitter:site`; org logo as `og:logo`; org cover or logo as image       |
| Canonical, `og:url`    | On the org's custom-domain origin. `/org/{slug}` canonicalizes to `/`                                 |
| JSON-LD                | Breadcrumbs rooted at the org home; no Revel `WebSite` or `SoftwareApplication` blocks               |
| `/manifest.webmanifest`| Tenant only (404 on the platform, which keeps `/manifest.json`). Org name, `start_url: /`, org logo icons, theme color |
| Head rewrite           | `handleTenantHead` rewrites the favicon, apple-touch icon, `theme-color`, manifest and feed links in the first streamed chunk, and removes the OpenSearch link |
| Theme color            | `brand_theme.light.primary` when valid, else Revel purple `#8C3CDD`                                   |
| `/sitemap.xml`         | Index of org-scoped children on the tenant origin; no `sitemap-orgs-*`                                |
| `/sitemap-events-N.xml`, `/sitemap-series-N.xml` | Filtered with `organization={tenant.id}`; URLs on the tenant origin        |
| `/sitemap-static.xml`  | One entry: the tenant root `/`                                                                        |
| `/sitemap-orgs-N.xml`  | 404                                                                                                   |
| `/robots.txt`          | The platform rules minus `/create-org` and `/org/*/admin`; a single `Sitemap:` line for the tenant  |
| `/feed.xml`            | The org's upcoming events, titled `{Org} - Upcoming Events`, on the tenant origin                     |
| `/opensearch.xml`      | 404 (it describes the platform-wide search)                                                           |
| `/oembed`              | Another organization's URL gives 404; `provider_name` is the org                                      |

`handleTenantHead` is tested against the real `src/app.html`, so changing the shell's head tags
without updating the patterns fails a test.

## `{brand}` in i18n

Some messages name the site you are on. They take a `{brand}` parameter, filled with
`brandName(tenant)`: the organization name on a custom domain, "Revel" elsewhere. Components pass
`page.data.tenant`, server code `locals.tenant`:

```svelte
<title>{m['profilePage.pageTitle']({ brand: brandName($page.data.tenant) })}</title>
```

The rule for whether a string takes `{brand}`:

- **`{brand}`**: "Revel" meaning the **site** the visitor is on. Titles, greetings, "sign in to ...",
  attendee-facing copy.
- **Literal "Revel"**: "Revel" meaning the **account** or the **legal entity**. "Your Revel account",
  privacy, terms, deletion and data copy, "Powered by Revel", Telegram linking. An account works
  across every Revel organization and Revel stays the data controller, so these must not change per
  domain.

Strings were reworded where an organization name needs to fit grammatically (for example German
"bei {brand}", French "sur {brand}", Portuguese without an article).
`src/lib/seo/brand-i18n.test.ts` renders the parameterized messages in all six locales with an
organization name and asserts that neither a literal `{brand}` nor "Revel" remains.

Many `en.json` strings that mention Revel are unused keys (page titles now come from `buildSeo`).
They were left alone instead of adding a parameter nobody passes.

## Sessions and cookies

No cookie sets a `domain`, so every cookie is **host-only**. Signing in on `events.acme.example`
creates a session for that host only; the platform and every other custom domain have their own. A
user who is signed in to the platform has to sign in again on a custom domain, and the reverse. This
is by design: it keeps one organization's site from reading another's session. It is also why the
Stripe return hop above sends the buyer back to the domain they paid from.

## Environment variables

Set these on the frontend container. The first two are read by adapter-node, the rest by the app
at runtime.

| Variable | Scope | Default | Production example | Dev / E2E example |
| --- | --- | --- | --- | --- |
| `HOST_HEADER` | private (adapter-node) | unset | `x-forwarded-host` | unset (Vite and the preview server use the `Host` header) |
| `PROTOCOL_HEADER` | private (adapter-node) | unset | `x-forwarded-proto` | unset |
| `PLATFORM_HOSTS` | private | unset (tenant mode off) | `app.example.com,www.example.com` | `localhost` |
| `PLATFORM_ORIGIN` | private | `https://` + first `PLATFORM_HOSTS` entry | `https://app.example.com` | `http://localhost:5173` |
| `PUBLIC_CUSTOM_DOMAIN_URL_TEMPLATE` | public (also read in the browser) | `https://{hostname}` | `https://{hostname}` | `http://{hostname}:5173` |
| `ORIGIN` | private (adapter-node) | unset | `https://app.example.com`, **single-host only** | unset |

**How `ORIGIN` interacts.** adapter-node uses `ORIGIN` when it is set and ignores the two header
variables. A multi-host deployment must not set it: with `ORIGIN` pinned to the platform, the form
action CSRF check and `url.origin` would be wrong on every custom domain. Without `ORIGIN`,
adapter-node builds the origin per request from `HOST_HEADER` and `PROTOCOL_HEADER`. A request that
lacks them (the container `HEALTHCHECK` on `localhost:3000`) falls back to the `Host` header, and the
scheme falls back to `https`. This app does not configure SvelteKit's `csrf` option, so the
same-origin check follows the real host.

`PLATFORM_ORIGIN` is only used for redirects from tenant hosts to platform-only paths and for the
"Powered by Revel" link. `PUBLIC_CUSTOM_DOMAIN_URL_TEMPLATE` must match the backend's
`CUSTOM_DOMAIN_URL_TEMPLATE`. If they differ, links and canonicals generated by the two sides
disagree. Terminate TLS for the platform and for custom domains at your proxy, and forward the
original host in `X-Forwarded-Host` and the scheme in `X-Forwarded-Proto`.

See [`runbooks/deployment.md`](runbooks/deployment.md) for single-host and multi-host compose and
Kubernetes examples.

## Local development and E2E

**`*.localhost`.** Chromium resolves any `*.localhost` name to loopback without touching
`/etc/hosts`. Firefox and WebKit are not relied on. `localhost` itself is always a platform host, so
the default dev setup is unaffected.

**Seed data.** With the backend running in `DEBUG`, `bootstrap_test_events` creates two dedicated
tenant fixtures, both owned by `tenant.owner@example.com`:

| Organization slug  | Domain             | Events                                           |
| ------------------ | ------------------ | ------------------------------------------------ |
| `tenant-test-org`  | `tenant.localhost` | `tenant-rsvp-event`, `tenant-free-ticket-event`  |
| `tenant-paid-org`  | `paid.localhost`   | `tenant-paid-event` (10.00 EUR, platform Stripe account) |

The shared E2E fixtures carry no domains. Confirm the backend sees them with
`curl localhost:8000/api/organizations/by-domain/tenant.localhost`.

**Dev server recipe.** Start the frontend with tenant mode on and links that point at the served
port:

```bash
PLATFORM_HOSTS=localhost \
PLATFORM_ORIGIN=http://localhost:5173 \
PUBLIC_CUSTOM_DOMAIN_URL_TEMPLATE='http://{hostname}:5173' \
pnpm dev
```

Then open `http://tenant.localhost:5173/`. `http://localhost:5173/org/tenant-test-org` 301s to it
because that organization has a domain. An unseeded name such as `http://nope.localhost:5173/` is the
bare 404.

**E2E.** The Playwright web server passes the same three variables (overridable from the
environment). The custom-domain journeys are in
`tests/e2e/journeys/j30-custom-domains/` and run on desktop Chromium only, because they need
`*.localhost` and assert desktop header chrome. They plant sessions per host, since cookies are
host-only, and self-skip with a reason when the backend does not resolve the seeded domains or the
frontend was started without `PLATFORM_HOSTS`. Judge the skip count, not just the exit code. A dev or
preview server reused through `reuseExistingServer` must itself have been started with the variables
above. See [`tests/e2e/README.md`](../tests/e2e/README.md) for the full environment contract.

> The `j30-custom-domains` specs and their README row live on the
> `feature/1056-tenant-e2e` branch and may not be on yours yet.

## Known limits and follow-ups

- **No per-tenant SSO.** The OIDC callback is pinned to the platform host, so SSO buttons are hidden
  on custom domains. Email and password login still works. Per-tenant OIDC is not supported.
- **Dashboards are not scoped to the tenant.** On a custom domain `/dashboard/*` still lists the
  user's tickets, RSVPs, passes and invitations across all organizations. Scoping them to the tenant
  needs a backend filter that is tracked separately (the stacked PR text calls it backend #1154; the
  hand-off note mentions #1165, so confirm the number).
- **PWA icons.** The manifest lists the backend's 150x150 logo thumbnail and the full logo with
  `sizes: any`. Installability checks want 192px and 512px icons, which would need backend-generated
  sizes.
- **Platform settings reachable on tenant hosts.** `/account/developer-apps` and
  `/account/connected-apps` are OAuth and platform settings, but the `account` rule allows them.
- **Remaining "Revel" copy.** Nine messages and the dashboard and account page titles take
  `{brand}`. Copy about the account and the legal entity intentionally still says Revel. Platform-only
  pages (admin, landing, referral, developer apps) are not parameterized; several still have a
  literal "- Revel" title, for example the referral pages, and the unused keys mentioned above stay as
  they are.
- **Cache lag.** Domain changes take up to 60 s to be seen by each frontend replica (see the cache
  table above).
