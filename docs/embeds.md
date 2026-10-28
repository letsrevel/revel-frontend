# Embeddable events (`/embed`)

Organizers put Revel content on their own websites with an iframe. Three surfaces exist,
all rendered server-side, anonymously, and with **no client bundle** (`csr = false`):

| Surface       | Route                                    | `utm_medium` |
| ------------- | ---------------------------------------- | ------------ |
| Event list    | `/embed/{org_slug}`                      | `list`       |
| Single event  | `/embed/{org_slug}/event/{event_slug}`   | `event`      |
| Event series  | `/embed/{org_slug}/series/{series_slug}` | `series`     |

## Query parameters

| Param                                                             | Applies to     | Notes                                                            |
| ----------------------------------------------------------------- | -------------- | ---------------------------------------------------------------- |
| `theme=light\|dark\|auto`                                          | all            | Default `auto` (host's `prefers-color-scheme`)                    |
| `lang=en\|de\|it\|fr`                                              | all            | Resolved without cookies — embeds write none                      |
| `tags`, `city_id`, `event_type`, `event_series`, `include_past`, `order_by`, `page_size` | list, series   | Mirror the public discovery filters; `page_size` is clamped       |
| `utm_content`                                                      | all            | Host page hostname, added by the loader; echoed onto outbound links |
| `src=oembed`                                                       | all            | Set by `/oembed`; switches `utm_medium` to `oembed`               |

## Loader script

```html
<script
	src="https://letsrevel.io/embed-v1.js"
	data-revel-org="my-organization"
	data-revel-theme="auto"
	data-revel-page-size="6"
	async
></script>
```

It replaces itself with the iframe (or appends to `data-revel-target="#selector"`), forwards
the `data-revel-*` attributes as query params, appends `utm_content={location.hostname}`, and
resizes the iframe from `postMessage` height events. Add `data-revel-event` or
`data-revel-series` for the single-event / series surfaces; `data-revel-resize="false"` pins
the height. See the file header in `static/embed-v1.js` for the full attribute list.

Inside the iframe, `static/embed-frame-v1.js` reports the content height and re-applies
`theme=auto` when the host's colour scheme changes.

**Both filenames are the version.** `*.js` is served immutable for a year at the proxy, so
breaking changes ship as `embed-v2.js` / `embed-frame-v2.js` rather than as new bytes.

## oEmbed

`GET /oembed?url=<public Revel page>&format=json[&maxwidth=&maxheight=]` returns a `rich`
response whose `html` is an iframe for the matching surface. It accepts `/events/{org}/{event}`,
`/events/{org}/series/{series}` and `/org/{slug}` on this origin; everything else is a 404, and
a non-`json` `format` is a 501. Event, organization and series pages advertise it with
`<link rel="alternate" type="application/json+oembed">`.

## Custom domains and brand colors

### Organizations with a custom domain

An organization served on its own domain (see [`tenant-mode.md`](tenant-mode.md)) is embedded the
same way. The snippet comes from the admin embed builder, which lives on the platform, so the
iframe and loader `src` point at the **platform origin** (`/embed/{org_slug}...` and
`/embed-v1.js`). Nothing about the snippet changes.

What changes is where the embed links out:

- Links to events, the series and the organization page use `orgOrigin(org, page.data)`, so they open on
  `https://{custom_domain}` (shaped by `PUBLIC_CUSTOM_DOMAIN_URL_TEMPLATE`) instead of the
  platform. This covers the event cards in the list, the header and "more" links, and the single
  event and series surfaces. Without a custom domain, or while tenant mode is off (`PLATFORM_HOSTS`
  unset), they use the origin the embed is served from.
  UTM attribution is appended exactly as before.
- The "Powered by Revel" link goes to `/` on the origin the embed is served from, with the same
  attribution.
- **Embeds never canonical-redirect.** The 301 to the custom domain that org, event and series pages
  get on the platform (when tenant mode is on) is not applied to `/embed/*`, because these are iframed on third-party sites.
  `/embed/{org_slug}` on the platform keeps answering 200.
- On a tenant host only that organization's `/embed/{slug}` is served; another organization's embed
  is a 302 to `/`. `/oembed` on a tenant host returns 404 for another organization's URL.

### Brand colors in embeds

Embed loaders return `brandTheme` from the organization they load (list, event and series), and the
root layout renders `OrgBrandStyle` before its embed branch, so the SSR embed document carries the
organization's color overrides in a `<style data-org-brand>` tag. No client script is involved, which
fits `csr = false`.

- The overrides are keyed on the `.dark` class of `<html>`: `:root:not(.dark)` for light and
  `:root.dark` for dark. An explicit `?theme=dark` stamps that class server-side, `?theme=light`
  leaves it off, and `?theme=auto` leaves the choice to the anti-FOUC script, so the colors follow
  the host page's `prefers-color-scheme` and switch when `embed-frame-v1.js` re-applies the scheme.
- An organization without brand colors gets no override and renders in the default Revel theme.
- The backend guarantees the contrast of each mode's colors; the embed does not adjust them.

## Operational notes

- **Framing**: `frame-ancestors *` is applied to `/embed/*` responses only, in `handleCsp`
  (`src/hooks.server.ts`). Everything else keeps `frame-ancestors 'none'`.
- **Caching**: embed documents and `/oembed` send
  `Cache-Control: public, max-age=3600, stale-while-revalidate=300` plus `Vary: Accept-Language`,
  and set no cookies. Pass-through is the infra side's job (letsrevel/infra#37).
- **Visibility**: every embed load is anonymous. List and series embeds therefore show only
  discoverable events (UNLISTED hidden); a direct single-event embed can show an UNLISTED
  event, consistent with "has the link".
- **Unknown slugs**: the list embed filters via `organization_slug` (backend #822), which
  applies on top of the gated queryset. An unknown or mismatched slug is an empty `200`, so
  the embed renders its empty state rather than an error. Event and series embeds address a
  specific resource, so an unknown slug there is a real 404, rendered by the compact
  `/embed` error page.
- **Theme without JavaScript**: an explicit `?theme` is stamped onto `<html>` server-side along
  with `data-theme-locked`, which tells the anti-FOUC script in `src/app.html` to stand down.
  `localStorage` is partitioned per host page inside a third-party iframe and is never consulted.

## Attribution

Ticket purchases record the `utm_source` / `utm_medium` / `utm_campaign` /
`utm_content` tags present on the page URL at checkout (#880). Nothing is ever
stored on the visitor's device — the tags live in the URL only.

- **Script snippet:** the loader reads the *host page's* query string. If it
  carries a `utm_source`, all four `utm_*` params are forwarded onto the iframe
  and the embed's outbound links use them verbatim, replacing the embed defaults
  entirely — the organizer's own campaign tags win. Otherwise the embed
  convention applies (`utm_source=embed`, `utm_medium=<surface>`,
  `utm_campaign=<org slug>`, `utm_content=<host hostname>`).
- **Raw iframe / oEmbed:** cannot see the host page URL, so they attribute at
  embed level only (embed defaults / `utm_medium=oembed`).
- Organizers see the result as the "Sales by source" breakdown on the event's
  tickets admin page, as `utm_source`/`utm_campaign` list filters, and as four
  UTM columns in the attendee export.
