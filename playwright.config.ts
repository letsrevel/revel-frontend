import { defineConfig, devices } from '@playwright/test';

/**
 * E2E suite configuration — see tests/e2e/README.md for the environment
 * contract (backend + `make bootstrap`, Mailpit, Stripe webhook forwarder).
 *
 * Projects:
 * - `chromium` / `mobile-chrome` run the journey suites (tests/e2e/journeys/)
 *   on desktop + mobile viewports. Journey specs self-skip when no backend is
 *   reachable; persona fixtures log in via the backend API per test.
 * - `regression-*` run the CSP / FOUC regression specs on the full 5-browser
 *   matrix; they only need the built frontend, not a backend.
 *
 * Tiered runs: journey describes are tagged @p0–@p3, e.g.
 *   pnpm test:e2e --grep @p0
 */

const JOURNEY_BROWSERS = [
	{ name: 'chromium', device: devices['Desktop Chrome'] },
	{ name: 'mobile-chrome', device: devices['Pixel 5'] }
];

const REGRESSION_BROWSERS = [
	{ name: 'regression-chromium', device: devices['Desktop Chrome'] },
	{ name: 'regression-firefox', device: devices['Desktop Firefox'] },
	{ name: 'regression-webkit', device: devices['Desktop Safari'] },
	{ name: 'regression-mobile-chrome', device: devices['Pixel 5'] },
	{ name: 'regression-mobile-safari', device: devices['iPhone 12'] }
];

export default defineConfig({
	testDir: './tests/e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	// One local retry. The client-auth rotation race that originally motivated
	// this was fixed app-side (#596: API requests wait for the auth bootstrap
	// gate) — retries: 0 was trialled and no auth flakes remained, but the
	// local dev backend still throws unrelated transients under 4-worker load
	// (django-silk profiling middleware deadlocks in Postgres → sporadic 500s),
	// so one retry stays. Real regressions fail twice.
	retries: process.env.CI ? 2 : 1,
	// The journeys hit ONE local backend; unbounded workers overload it
	// (slow renders, transient 500s). Four is fast and stable.
	// E2E_WORKERS overrides the worker count for constrained environments
	// (e.g. a slow machine or a shared backend). Local default stays 4
	// (PgBouncer backend); CI default stays 1.
	workers: process.env.E2E_WORKERS ? Number(process.env.E2E_WORKERS) : process.env.CI ? 1 : 4,
	// Real-stack renders under parallel load regularly exceed the 5s default,
	// and specs with arrange-heavy retry loops need room beyond the 30s default
	// test timeout (typical tests finish in seconds; these are ceilings).
	timeout: 90_000,
	expect: { timeout: 10_000 },
	reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list'], ['html']],
	use: {
		baseURL: 'http://localhost:5173',
		trace: 'on-first-retry'
	},

	projects: [
		...JOURNEY_BROWSERS.map(({ name, device }) => ({
			name,
			testDir: './tests/e2e/journeys',
			use: { ...device }
		})),
		...REGRESSION_BROWSERS.map(({ name, device }) => ({
			name,
			testDir: './tests/e2e/regression',
			use: { ...device }
		}))
	],

	webServer: {
		command: 'pnpm build && pnpm preview',
		port: 5173,
		// The production build alone takes >60s (worse under load); give
		// build+boot ample room. Local iteration: keep a `pnpm build && pnpm
		// preview` running — reuseExistingServer skips the rebuild entirely.
		timeout: 300_000,
		reuseExistingServer: !process.env.CI,
		env: {
			PUBLIC_API_URL: process.env.PUBLIC_API_URL ?? 'http://localhost:8000'
		}
	}
});
