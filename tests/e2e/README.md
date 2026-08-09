# E2E Test Suite

Journey-based Playwright suite derived from `revel-backend/USER_JOURNEYS.md`.
Design: `docs/superpowers/specs/2026-07-10-e2e-test-suite-design.md` (local-only; full copy on issue #28).

## Environment contract

Journey specs run against a real local stack and **self-skip politely** (probe of
`GET /api/version`) when it's absent. Regression specs (`regression/`) need only
the built frontend.

| Dependency | Where | Notes |
| --- | --- | --- |
| Backend | `http://localhost:8000` | `make e2e-setup` (this repo) starts it — or manually: `make run-e2e` in `revel-backend` (gunicorn + PgBouncer; plain `make run` exhausts Postgres connections at 4 workers) |
| Reset | `uv run python src/manage.py reset_events --no-input && make seed && make bootstrap-tests` (backend repo) | Included in `make e2e-setup` — or manually: run before a full suite for determinism. Order matters: `reset_events` already re-runs `bootstrap_events` (a following `make bootstrap` fails on duplicates), and `seed` must run **before** `bootstrap-tests` — the seeder's payment/quantity sweeps are global, so seeding last would mutate the test fixtures (e.g. randomly refunding the sold-out event's tickets). The showcase seed (`make seed`) is required by the Teatro Grande specs (`getSeededBestAvailableEvent`).<br>**`reset_db → make bootstrap → make seed` is the WRONG order** and the way this has actually gone wrong: `make bootstrap` chains `bootstrap_test_events`, so a later `make seed` reaches those fixtures. `TicketSeeder._create_payments` selects `Ticket.objects.filter(tier__payment_method=ONLINE, payment__isnull=True)` with no scope at all and rolls some of them REFUNDED → ticket CANCELLED (`cancellation_source=stripe_dashboard`) + `tier.quantity_sold` decremented. Repairing a fixture after that takes BOTH halves — the `Ticket.status` rows *and* the denormalized counter |
| Celery | inline/eager | Questionnaire auto-eval, exports, etc. complete synchronously |
| Mailpit | `http://localhost:8025` | Captures all outbound email; override with `E2E_MAILPIT_URL` |
| Stripe | `stripe listen` forwarding to the backend | Backend `.env` needs `CONNECTED_TEST_STRIPE_ID` **at bootstrap time**, or online checkout fails |
| Frontend | `http://localhost:5173` | Started by Playwright (`pnpm build && pnpm preview`) with `PUBLIC_API_URL=http://localhost:8000` |

## Running

```bash
make e2e                           # backend up + reseeded, then everything
make e2e-setup && make e2e-run     # …as two halves; make e2e-teardown stops the backend
pnpm test:e2e                      # everything
pnpm test:e2e --grep @p0           # one tier (@p0–@p3)
pnpm test:e2e --project=chromium   # desktop journeys only
pnpm test:e2e tests/e2e/regression # CSP/FOUC guards (no backend needed)
```

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
