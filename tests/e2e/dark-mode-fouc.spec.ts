import { test, expect } from '@playwright/test';

// Regression test for #440: dark-mode users saw a light flash (FOUC) on SSR
// loads. The fix is a synchronous, nonced inline script in app.html that applies
// the `dark` class before first paint. mode-watcher injects an equivalent
// snippet, but it carries no nonce and is blocked by the production CSP
// (script-src 'self'), so it never ran — hence the flash.
//
// These tests run against the production build+preview server (see
// playwright.config.ts), where CSP is enforced — the only place the bug
// reproduces. They would fail on `main` (no nonced anti-FOUC script).

test.describe('dark-mode anti-FOUC (#440)', () => {
	test('serves a nonced anti-FOUC script that the CSP allow-lists', async ({ request }) => {
		const response = await request.get('/');
		expect(response.ok()).toBeTruthy();

		const html = await response.text();

		// The synchronous anti-FOUC script must be present, must read the
		// mode-watcher storage key, and must NOT be deferred/async.
		const scriptMatch = html.match(
			/<script nonce="([^"]+)">([\s\S]*?mode-watcher-mode[\s\S]*?)<\/script>/
		);
		if (!scriptMatch) {
			throw new Error('anti-FOUC inline script with a nonce is not present in the served HTML');
		}
		const [scriptTag, nonce] = scriptMatch;
		expect(scriptTag).not.toMatch(/\b(defer|async)\b/);
		expect(nonce.length).toBeGreaterThan(0);

		// The CSP must allow that exact nonce, or the browser blocks the script.
		const csp = response.headers()['content-security-policy'];
		expect(csp, 'a CSP header is present in production').toBeTruthy();
		expect(csp).toContain(`'nonce-${nonce}'`);
	});

	test('applies the dark class before hydration for a dark-mode user', async ({ page }) => {
		// Seed the mode-watcher preference before any document script runs, so the
		// inline anti-FOUC script sees it on the very first paint.
		await page.addInitScript(() => {
			window.localStorage.setItem('mode-watcher-mode', 'dark');
		});

		await page.goto('/');

		const root = page.locator('html');
		await expect(root).toHaveClass(/\bdark\b/);
		await expect(root).toHaveCSS('color-scheme', 'dark');
	});

	test('does not force dark on an explicit light-mode user', async ({ page }) => {
		await page.addInitScript(() => {
			window.localStorage.setItem('mode-watcher-mode', 'light');
		});

		await page.goto('/');

		await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
		await expect(page.locator('html')).toHaveCSS('color-scheme', 'light');
	});
});
