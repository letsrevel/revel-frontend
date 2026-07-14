# E2E Test Suite

Journey-based Playwright suite derived from `revel-backend/USER_JOURNEYS.md`.
Design: `docs/superpowers/specs/2026-07-10-e2e-test-suite-design.md` (local-only; full copy on issue #28).

## Environment contract

Journey specs run against a real local stack and **self-skip politely** (probe of
`GET /api/version`) when it's absent. Regression specs (`regression/`) need only
the built frontend.

| Dependency | Where | Notes |
| --- | --- | --- |
| Backend | `http://localhost:8000` | `make run` in `revel-backend`, DB seeded via `make bootstrap` |
| Reset | `make reset-events && make bootstrap-tests` (backend repo) | `reset_events` clears test pollution and re-runs the main bootstrap, but **not** `bootstrap_test_events` — without `make bootstrap-tests` the j05 eligibility-matrix suite 404s. Bootstrap is **not** re-runnable on a dirty DB; run this before a full suite run for determinism |
| Celery | inline/eager | Questionnaire auto-eval, exports, etc. complete synchronously |
| Mailpit | `http://localhost:8025` | Captures all outbound email; override with `E2E_MAILPIT_URL` |
| Stripe | `stripe listen` forwarding to the backend | Backend `.env` needs `CONNECTED_TEST_STRIPE_ID` **at bootstrap time**, or online checkout fails |
| Frontend | `http://localhost:5173` | Started by Playwright (`pnpm build && pnpm preview`) with `PUBLIC_API_URL=http://localhost:8000` |

## Running

```bash
pnpm test:e2e                      # everything
pnpm test:e2e --grep @p0           # one tier (@p0–@p3)
pnpm test:e2e --project=chromium   # desktop journeys only
pnpm test:e2e tests/e2e/regression # CSP/FOUC guards (no backend needed)
```

## CI

Only the `regression/` specs run in CI: the **Regression E2E** job in
`ci.yml` (CSP/FOUC guards, 5 browsers, no backend) runs on every PR.

The journey suite does **not** run in CI — evaluated and rejected 2026-07-14
(#593): a full-stack release-gate workflow was built and validated, but GH's
4-vCPU runners took 40+ minutes for a suite that runs in ~6 locally, which is
unusable for release turnaround. Instead, `/release` step 10 requires a green
local full-suite run before merging a release PR (release-first discipline:
the backend release this FE release depends on must be cut first). Journey
specs also self-skip on machines without the backend stack, so `pnpm test:e2e`
stays safe everywhere.

## Layout

- `journeys/jNN-*/` — one directory per USER_JOURNEYS.md journey; specs import
  `{ test, expect }` from `../../support/fixtures` and tag describes `@p0`–`@p3`.
- `regression/` — CSP + dark-mode-FOUC guards; full 5-browser matrix; plain
  `@playwright/test`.
- `support/` — personas, backend arrange client (`api.ts`, `factories.ts`),
  Mailpit + Stripe helpers, backend probe.

## Conventions

- **Personas** (`support/personas.ts`) map to `make bootstrap` users (password
  `password123`). Use the `asOwner`/`asMember`/… fixtures for an authenticated
  page — each performs its own API login so every context holds a private
  token pair. Destructive account flows register throwaway users instead.
- **Never share a session between contexts** (e.g. via storageState files):
  the client bootstrap ROTATES the refresh token and blacklists the old one,
  so parallel contexts sharing a pair silently log each other out. Tests that
  explicitly log out should own their session via a UI login (see
  `j03-account/login-logout.spec.ts`).
- **Arrange via API, assert via UI**: set up state with `support/api.ts` /
  factories; only the journey under test goes through the UI.
- **Unique names**: anything a test creates uses `uniqueName()`/`uniqueEmail()`
  so parallel workers and repeated runs never collide. Tests don't clean up —
  the reset command above restores determinism.
- **Selectors**: `getByRole`/`getByLabel` first (the app is WCAG AA —
  semantics identify elements); `data-testid` only as a last resort.
- **Email**: assert through `support/mailpit.ts` with a unique recipient; never
  "the latest message".
- **Check-in**: use the QR scanner modal's manual-entry path (no camera in CI).
