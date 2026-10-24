# Tenant mode (custom domains and white-label)

Tenant mode lets one deployment of this app serve an organization on its own domain, for example
`events.example.org`. On that domain the whole site is the organization's: its page is the home
page, the header and footer carry its name, its brand colors apply everywhere, and none of the
platform's discovery or marketing pages show up.

This page describes what the frontend does. Domain registration, DNS and TLS (Cloudflare for SaaS
or similar) are backend and operator concerns, covered in the operator docs
([letsrevel/revel-backend#1166](https://github.com/letsrevel/revel-backend/issues/1166)). What the
proxy in front of the frontend must do is summarized in [Reverse proxy and TLS](#reverse-proxy-and-tls)
below. The deployment variables are also listed in [`runbooks/deployment.md`](runbooks/deployment.md).

Tenant mode is off until `PLATFORM_HOSTS` is set, so deploying this code changes nothing by itself.
With `PLATFORM_HOSTS` unset nothing redirects and no link is rewritten, even if the backend returns a
`custom_domain` for an organization. That matters for a deployment that shares a backend with a
tenant-mode deployment but does not serve the custom domains itself: it must never send visitors to
a domain it does not answer for. The switch is `tenantModeEnabled()` in `src/lib/server/tenant.ts`
(true when `PLATFORM_HOSTS` names at least one host). Canonical redirects, the Stripe return hop,
link rewriting and route scoping all follow it.

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

Found organizations and unknown hosts live in two separate maps, each capped at 500 entries
(`MAX_CACHE_ENTRIES`) and each evicting its oldest entry first. A flood of requests with random
`Host` headers can therefore churn the unknown-host map but can never push a real tenant out of the
found map. Concurrent first requests for the
same host share one backend call. The 503 path logs a `tenant_lookup_unavailable` warning at most once
every 10 seconds. After an organization changes or removes its domain, expect up to 60 s (found)
or 15 s (unknown) before every replica agrees.

## Route scoping

Implemented in `src/lib/server/tenant-routing.ts`, applied by `handleTenantRouting` right after
`handleTenant`. A tenant host serves one organization, so platform pages must not render there.
The decision is a pure function, `tenantRouteDecision`, driven by a rule per top-level path
segment. Redirects are `302` with `Cache-Control: no-store`. On a platform host the same hook only
post-processes the response (see [Canonical redirects](#canonical-redirects-from-the-platform)).

| Path (first segment)                                                             | On a tenant host                                                          |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `/` (empty path)                                                                 | Allowed (renders the organization page)                                   |
| `/org/{tenant slug}/...` (not `/admin`)                                          | Allowed                                                                   |
| `/org/{uuid}/membership` (exactly)                                               | Allowed (legacy Stripe return route; the slug page is re-checked after its redirect) |
| `/events` (bare)                                                                 | Allowed; the list is forced to the tenant organization (see note below)   |
| `/events/{tenant slug}/...`                                                      | Allowed                                                                   |
| `/events/confirm-action`                                                         | Allowed                                                                   |
| `/events/{uuid}`, `/events/{uuid}/{uuid}`, `/events/{uuid}/series/{uuid}`        | Allowed (legacy UUID routes redirect to slug URLs, which are re-checked; `events/[id]` renders on the platform but 303s to the slug URL on a tenant host). Any other shape under a UUID goes to `/` |
| `/embed/{tenant slug}...`                                                        | Allowed                                                                   |
| `login`, `logout`, `register`, `password-reset`, `verify`                        | Allowed                                                                   |
| `account` (except the three platform pages below), `dashboard`, `legal`, `unsubscribe`, `join` | Allowed                                                      |
| `/account/referral...`, `/account/developer-apps...`, `/account/connected-apps...` | 302 to the same path and query on the platform origin                   |
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

- **`/events` on a tenant host** is the tenant's own event list. The loader in
  `src/routes/(public)/events/+page.server.ts` sets the organization filter to `locals.tenant.id`,
  overriding any `organization` query parameter, and the page hides the organization filter and
  the organization name on cards (`hideOrganization`). `/events/confirm-action` is the one slugless
  exception besides the bare list.
- **UUID shapes are exact.** `/org/{uuid}/membership`, `/events/{uuid}`, `/events/{uuid}/{uuid}` and
  `/events/{uuid}/series/{uuid}` are the real legacy Stripe-return routes. Extra segments after
  them, or a UUID in any other position, fall through to `/`.
- The `account` rule is open except for the pages in `PLATFORM_ACCOUNT_PAGES` (`referral`,
  `developer-apps`, `connected-apps`): those are platform and OAuth settings, so they redirect to
  the platform. Only the top-level `/referral` page (a different route) goes to `/`.
- The platform origin is `PLATFORM_ORIGIN`, else `https://` plus the first `PLATFORM_HOSTS`
  entry (see [Environment variables](#environment-variables)). When neither yields a valid
  `http(s)` URL, platform redirects fall back to `/`.
- **Fail-closed.** `ruleForSegment` returns nothing for a segment without a rule, and the decision
  function then redirects to `/`. A new route can never become reachable on tenant hosts by
  accident.
- **The route-walk test.** `src/lib/server/tenant-routing.test.ts` walks `src/routes` and fails when
  a top-level route segment has no entry in `SEGMENT_RULES` or `PREFIX_RULES`. Adding a route means
  adding its rule in the same change.

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
domain, its attendee pages on the platform host answer with a `301` to the same path on the domain.
This only happens while tenant mode is on (`PLATFORM_HOSTS` set):

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
- **Never to itself.** `canonicalTenantUrl` returns nothing when the target host equals the
  request's own host. A `custom_domain` that is misconfigured to a platform host would otherwise
  301 to itself forever.
- **No cache.** A 301 is cached by browsers indefinitely, so an organization that later drops or
  changes its domain would keep redirecting returning visitors. `capCanonicalRedirectCache`
  (`src/lib/server/tenant-routing.ts`, run by `handleTenantRouting` on platform hosts) adds
  `Cache-Control: no-store` to a 301 that points at another origin and sets no cache policy of its
  own. The kill switch then acts at once, and a redirect that depends on the caller's session (a
  members-only org 404s for anonymous visitors) and can carry refreshed session cookies is never
  reused after a logout or account switch. Same-origin redirects and responses that already carry
  `Cache-Control` are left alone.
- The functions in `tenant-canonical.ts` are `canonicalTenantUrl` (pure target computation),
  `canonicalTenantRedirect` (throws the 301), `tenantReturnUrl` (Stripe hop, below) and
  `serverLinkContext` (builds a link context from `locals` for server code such as SEO canonicals).

### The Stripe return flow

The backend keeps Stripe success and cancel URLs on the platform, using UUID routes so no names
reach Stripe (`/events/{org_uuid}/{event_uuid}`, `/events/{org_uuid}/series/{series_uuid}`,
`/org/{org_uuid}/membership`). A buyer who started checkout on `events.acme.example` therefore
comes back to the platform host, where their session cookie does not exist. The UUID routes handle
that:

1. The platform UUID route calls `tenantReturnUrl` (a no-op when tenant mode is off), which asks the public
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

`src/lib/utils/org-links.ts`. The link helpers take a **link context** (`LinkContext`): an object with
`tenant` and `customDomains`. The root layout returns both, so client code passes `page.data`
directly, and server code builds one with `serverLinkContext(locals)`. `customDomains` is
`{ enabled, platformOrigin }`, computed in `src/routes/+layout.server.ts`: `enabled` is
`tenantModeEnabled()`, and `platformOrigin` is the resolved platform origin when enabled, else `null`.

| Function                          | Does                                                                                         |
| --------------------------------- | -------------------------------------------------------------------------------------------- |
| `customDomainOrigin(hostname)`    | Origin for a domain from `PUBLIC_CUSTOM_DOMAIN_URL_TEMPLATE`, or `null` if the hostname is absent or malformed |
| `orgOrigin(org, ctx)`             | The org's custom-domain origin, or `null` when tenant mode is off (`ctx.customDomains.enabled` is not true) or the org has no valid domain |
| `orgHref(org, path, ctx)`         | The link for `path` on the org's attendee pages, by the rules below                          |
| `normalizeCustomDomain(domain)`   | Lowercased, validated hostname (dot-separated DNS labels, at least one dot) or `null`        |

`orgHref` rules, first match wins:

- **A. Tenant mode off** (no context, or `enabled` is false): the plain path. Nothing is rewritten.
- **B. The org has a valid custom domain:** the plain path when we are already on that domain
  (hostnames are compared, not origins, since the template may add a port), otherwise
  `https://{domain}{path}`.
- **C. The org has no domain and we are on a tenant host** (for example a ticket or calendar item
  from another organization): `{platformOrigin}{path}`, because a relative link would be scoped back
  to `/` by the tenant host. The tenant's own organization stays relative, and so does everything
  when the platform origin is unknown.
- **D. Otherwise** (on the platform, org without a domain): the plain path.

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
`https://host./events/x`. `rootRelative` strips the leading `./` and `../` segments to get a
root-relative path first. The app has no base path, so this is safe.

## Tenant chrome

`PublicLayout.svelte` and `AuthLayout.svelte` check `page.data.tenant`. When set they render
`src/lib/components/tenant/TenantHeader.svelte` and `TenantFooter.svelte` instead of the platform
header and footer. The platform path is unchanged.

- **Header:** organization logo (or its first letter) and name, linking to `/`. Nav items: Events
  (`/`), Membership (only when the org has membership plans or accepts membership requests) and
  Resources (only when the org has resources). Theme switcher, language switcher, Login and Sign up
  (or the account menu when signed in), and a mobile drawer that reuses `MobileNav`.
- **Footer:** "© {year} {organization}", then "Powered by Revel · Privacy · Terms". "Revel" links to
  `customDomains.platformOrigin` from layout data (passed down by `PublicLayout` and `AuthLayout`),
  or is plain text if none is configured.
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

## Tenant-scoped dashboards

On a custom domain the attendee's own lists show only that organization. `tenantOrgFilter()`
(`src/lib/utils/tenant-filter.ts`) returns `{ organization: tenant.id }` on a tenant host and `{}`
on the platform, and it is spread into the query of every "my" call: dashboard events, calendar,
organizations, followed organizations and event series, tickets, RSVPs, invitations and invitation
requests, series passes, memberships, subscriptions and membership applications (backend #1154's
optional `organization` parameter). The
filter is part of each dashboard query key, so tenant and platform results never share a cache entry.

## Sessions and cookies

No cookie sets a `domain`, so every cookie is **host-only**. Signing in on `events.acme.example`
creates a session for that host only; the platform and every other custom domain have their own. A
user who is signed in to the platform has to sign in again on a custom domain, and the reverse. This
is by design: it keeps one organization's site from reading another's session. It is also why the
Stripe return hop above sends the buyer back to the domain they paid from.

A host-only cookie is only as safe as the domain it is bound to, and the organization owner controls
that domain's DNS. If they repoint it at a server of their own, every returning browser sends its
session cookies there, and a refresh token is platform-wide and skips TOTP. So on a tenant host the
frontend never persists the session: the refresh cookie is a session cookie (no `maxAge`),
`remember_me` is always `false`, and the login page hides the "remember me" checkbox. The same rule
applies on every path that writes the cookie: login, 2FA, OIDC, email verification and the refresh
endpoint (`sessionRememberMe` in `src/lib/server/session.ts`). This only shortens the window.
Revocation is the backend's job: refresh tokens minted on a custom domain carry that host, and stop
working as soon as the domain is no longer active (removed, failed, moved, or the kill switch is
off).

**No session handoff to the platform, on purpose.** Org admin lives on the platform, so an owner
who signed in on the custom domain signs in once more there; the dashboard says so next to its Admin
links. Do not "fix" that with a handoff token: a token exchange that starts from the tenant origin
would let whoever controls the domain's DNS turn stolen tenant sessions into platform sessions that
outlive the domain.

## Environment variables

Set these on the frontend container. The first two are read by adapter-node, the rest by the app
at runtime.

| Variable | Scope | Default | Production example | Dev / E2E example |
| --- | --- | --- | --- | --- |
| `HOST_HEADER` | private (adapter-node) | unset | `x-forwarded-host` | unset (Vite and the preview server use the `Host` header) |
| `PROTOCOL_HEADER` | private (adapter-node) | unset | `x-forwarded-proto` | unset |
| `PLATFORM_HOSTS` | private | unset (tenant mode off) | `app.example.com` | `localhost` |
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

`PLATFORM_ORIGIN` (or its fallback) is the platform origin exposed as `customDomains.platformOrigin`.
It is used for redirects from tenant hosts to platform-only paths, for the "Powered by Revel" link,
and for links from a tenant host to organizations that have no custom domain. `PUBLIC_CUSTOM_DOMAIN_URL_TEMPLATE` must match the backend's
`CUSTOM_DOMAIN_URL_TEMPLATE`. If they differ, links and canonicals generated by the two sides
disagree. Terminate TLS for the platform and for custom domains at your proxy, and forward the
original host in `X-Forwarded-Host` and the scheme in `X-Forwarded-Proto`.

**Which hosts go in `PLATFORM_HOSTS`.** Only the hosts the frontend itself serves as the platform.
Any other host that reaches the frontend (except the loopback names, which are always the platform)
is treated as a custom domain: a well-formed DNS name is looked up, and an unknown or malformed one
gets a 404 (see [How a request becomes a tenant](#how-a-request-becomes-a-tenant)). A host your proxy redirects before it reaches the frontend (a `www.` alias) does not need to be
listed, and neither does the API host. The Revel deployments use `letsrevel.io` in production and
`beta.letsrevel.io` on beta.

See [`runbooks/deployment.md`](runbooks/deployment.md) for single-host and multi-host compose and
Kubernetes examples.

## Reverse proxy and TLS

The frontend only reads the forwarded host and scheme, so most of serving custom domains happens in
the proxy. This is how the reference deployment does it (Caddy behind Cloudflare,
[letsrevel/infra#67](https://github.com/letsrevel/infra/issues/67)). Another setup needs the same
properties.

- **Forwarded headers are overwritten, never passed through.** Every frontend upstream sets
  `X-Forwarded-Host` to the request's own host and `X-Forwarded-Proto` to `https`. In Caddy that
  is `header_up X-Forwarded-Host {host}` and `header_up X-Forwarded-Proto https`. They live in one
  shared snippet that both the platform site and the custom-domain site import, so the two cannot
  drift apart. Caddy trusts Cloudflare's ranges as proxies and would otherwise forward a
  client-sent `X-Forwarded-Host` unchanged. The frontend survives a spoofed host (it only changes
  which organization is shown), but SvelteKit's same-origin check on form actions is only as good
  as that header.
- **One catch-all site for custom domains.** It only receives hostnames that no named site claims.
  Its certificates are issued on demand (Let's Encrypt, HTTP-01 only, because the TLS-ALPN challenge
  cannot pass through Cloudflare's proxy). Before issuing one, Caddy asks the backend
  (`GET /api/tls/ask?domain=<host>`), which answers 200 only for an active domain of an
  organization with custom domains enabled. Nobody can make the server request certificates for
  arbitrary names. The zone's SSL mode stays Full (strict).
- **HSTS differs per site.** The platform keeps `max-age=31536000; includeSubDomains; preload`.
  The custom-domain site sends `max-age=86400` with neither, because those domains are not ours.
- **CNAME target and fallback origin.** Organizations point a CNAME at the backend's
  `CUSTOM_DOMAIN_CNAME_TARGET`: `customers.letsrevel.io` in production, `customers-beta.letsrevel.io`
  on beta. That name is the zone's Cloudflare for SaaS fallback origin, and a request for the name
  itself redirects to the platform. Cloudflare allows one fallback origin per zone, so production
  and beta cannot both serve custom domains at the same time.
- **The customer's CNAME stays DNS only.** If the organization's DNS is at Cloudflare, the record
  must be "DNS only" (grey cloud) for good. A proxied record makes public DNS answer with
  Cloudflare's IPs instead of the CNAME, and validation fails.
- **Turnstile.** Each custom domain has to be added to the Turnstile widget's hostname list by hand
  for now. Otherwise the widget, and so sign-up, fails on that domain.
- **Protected media.** The media CORS header echoes what the backend allows (its dynamic CORS
  accepts active custom domains) instead of a fixed platform origin, so file downloads work on
  custom domains too.
- **No buffering.** As on the platform, SSR responses stream: the proxy must not buffer them.

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

## Known limits and follow-ups

- **No per-tenant SSO.** The OIDC callback is pinned to the platform host, so SSO buttons are hidden
  on custom domains. Email and password login still works. Per-tenant OIDC is not supported.
- **PWA icons.** The manifest lists the backend's 150x150 logo thumbnail and the full logo with
  `sizes: any`. Installability checks want 192px and 512px icons, which would need backend-generated
  sizes.
- **Remaining "Revel" copy.** Nine messages and the dashboard and account page titles take
  `{brand}`. Copy about the account and the legal entity intentionally still says Revel. Platform-only
  pages (admin, landing, referral, developer apps) are not parameterized; several still have a
  literal "- Revel" title, for example the referral pages, and the unused keys mentioned above stay as
  they are.
- **Cache lag.** Domain changes take up to 60 s to be seen by each frontend replica (see the cache
  table above).
