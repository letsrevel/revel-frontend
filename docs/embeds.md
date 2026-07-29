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
