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

E2E does **not** run on regular PRs (FE and BE are developed in parallel;
red-against-released-BE would be noise). Two workflows:

- **`e2e.yml` — release gate.** Runs the full suite (Stripe included) on
  `release/v*` PRs against `ghcr.io/letsrevel/revel:latest` — the released
  backend, i.e. what production runs. Red gate = prod would break: fix on
  `main` (or release the backend first), the release PR updates, the gate
  re-runs. Manual runs: `gh workflow run e2e.yml -f backend_image_tag=<tag>`.
  Pin a backend version for all runs via the `E2E_BACKEND_IMAGE_TAG` repo
  variable. Stack definition: `tests/e2e/ci/compose.yml` + `backend.env`.
- **`ci.yml` → Regression E2E.** The `regression/` specs (CSP/FOUC,
  5 browsers, no backend) run on every PR.

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
