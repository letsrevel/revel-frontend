import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './tests/e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 2,
	workers: process.env.CI ? 1 : 3,
	reporter: 'html',
	timeout: 30000,
	expect: {
		timeout: 10000
	},
	use: {
		baseURL: 'http://localhost:5173',
		trace: 'on-first-retry',
		actionTimeout: 10000,
		navigationTimeout: 15000
	},

	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] }
		},

		{
			name: 'firefox',
			use: { ...devices['Desktop Firefox'] }
		},

		{
			name: 'webkit',
			use: { ...devices['Desktop Safari'] }
		},

		/* Test against mobile viewports. */
		{
			name: 'Mobile Chrome',
			use: { ...devices['Pixel 5'] }
		},
		{
			name: 'Mobile Safari',
			use: { ...devices['iPhone 12'] }
		}
	],

	webServer: {
		command: 'npm run build && npm run preview',
		port: 5173,
		reuseExistingServer: !process.env.CI
	}
});
