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
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
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
