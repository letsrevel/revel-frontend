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

The Lighthouse CI workflow (`.github/workflows/lighthouse.yml`) runs three rounds against each URL on every PR. The first run after this PR merges produces:

1. Public report URLs from `temporary-public-storage` upload target
2. Per-metric numbers (Performance / LCP / CLS / INP / Accessibility / SEO scores)

Copy those numbers into the table below, then write the findings.

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

## Lighthouse budgets (set in `lighthouserc.cjs`)

These were chosen as aspirational targets — if the first run can't hit them, soften them by 10% (do not weaken the SEO target below 1.0):

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
