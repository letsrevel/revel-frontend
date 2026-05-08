# Core Web Vitals Audit — 2026-05

**Branch:** `feature/seo-phase-1-technical-health`
**Date:** 2026-05-07
**Status:** STUB — populated after first Lighthouse CI run on staging/prod

## Pages tested

- `/` (home)
- `/events` (listing)
- `/eventbrite-alternative` (representative landing page)
- `/events/<org>/<event>` (one public event — pick a stable, indexable one)

## How this gets populated

Lighthouse CI was removed from this PR (env config friction; revisit later). For now run Lighthouse manually:

```bash
# Against deployed prod
npx @lhci/cli@latest collect --url=https://letsrevel.io/ --url=https://letsrevel.io/events --url=https://letsrevel.io/eventbrite-alternative --numberOfRuns=3
# Or use https://pagespeed.web.dev/ for a one-off run per URL
```

Capture the per-metric numbers (Performance / LCP / CLS / INP / Accessibility / SEO scores) and copy into the table below.

## Summary

| URL | Performance | LCP (s) | CLS | INP (ms) | Accessibility | SEO | Notes |
|-----|------------|---------|-----|----------|---------------|-----|-------|
| `/` | TBD | TBD | TBD | TBD | TBD | TBD | |
| `/events` | TBD | TBD | TBD | TBD | TBD | TBD | |
| `/eventbrite-alternative` | TBD | TBD | TBD | TBD | TBD | TBD | |
| `/events/<org>/<event>` | TBD | TBD | TBD | TBD | TBD | TBD | |

## Top findings (ranked by impact)

> Populate after the first run. Each finding should describe the issue, which pages are affected, the suggested fix, and an effort estimate (XS/S/M/L).

1. _placeholder — fill from Lighthouse audit results_
2. _placeholder_
3. _placeholder_

## Recommendation

Pending real data. Two options once findings are in hand:

- **Phase 1.5 (recommended if findings are mostly XS/S):** Land a follow-up PR with the CWV fixes before starting Phase 2. Keeps the foundation crisp before adding more code.
- **Roll into Phase 2:** If most findings are M/L (require structural changes — image lazy loading strategy, route-level code splitting, font subsetting), bundle them with the long-tail indexation work.

## Aspirational budgets

When Lighthouse CI is reintroduced (Phase 2 or sooner), these are the targets to assert against — soften by 10% if the first real run can't hit them, but do not weaken the SEO target below 1.0:

| Metric | Budget |
|--------|--------|
| Performance score | ≥ 0.85 |
| Accessibility score | ≥ 0.95 |
| SEO score | = 1.00 |
| Best Practices score | ≥ 0.90 (warn only) |
| LCP | < 2500ms |
| CLS | < 0.1 |
| Time to Interactive | < 3500ms |

## Follow-ups

- File a GitHub issue per finding once this doc is populated, tagged `seo` and `phase-1.5` or `phase-2` per the recommendation above.
