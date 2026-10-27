# Task 4 report: launchpad route

Implemented `/org/[slug]/admin/welcome`: `+page.server.ts` (owner-only, 303 to dashboard for staff, returns `{ setupCounts }` via `loadSetupCounts`), `+page.svelte` (bg-secondary band, Sticker, PageHeader poster onBand, -mt-12 pull-up onto an opaque bg-card shell holding SetupActions + VisibilityStrip, "Later" links, skip link, noindex), `page.server.test.ts`, `orgSetup.welcome.*` keys (10) in all six locales.

TDD: RED = test file failed to import `./+page.server` (no tests); GREEN = 2/2 pass after implementing.
Verify: vitest welcome 2/2; `make fix && make check` green; svelte-autofixer clean (run on a representative snippet of the page's reactive/resolve patterns).

Notes: `accessToken: x` literal in a load trips the no-ssr-token guard, so the token is passed to loadSetupCounts via a shorthand local. Missing `user.accessToken` yields 401. Redirect href built with resolve(). Page uses `$page.data.organization ?? data.organization` for progress. No new translucent recipes (no COMPOSITED_PAIRS change).
Concerns: "laterDescription" and "laterLogo" both link to /admin/settings; pageTitle takes `{name}`.
