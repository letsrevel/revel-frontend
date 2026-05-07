# IndexNow integration

Revel pings IndexNow (https://www.indexnow.org/) when public events change so Bing/Yandex re-crawl them within minutes.

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

```
curl -X POST https://letsrevel.io/api/indexnow \
  -H "Authorization: Bearer $INDEXNOW_TRIGGER_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"urls":["https://letsrevel.io/"]}'
```
