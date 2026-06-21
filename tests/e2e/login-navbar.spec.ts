import { test, expect, type Page } from '@playwright/test';

// Regression test for #485 — "Navbar shows logged-out state after login until a
// manual refresh".
//
// The login action sets the auth cookies and issues a 303 redirect. When that
// redirect is followed as a *client-side* navigation, the root layout's server
// `load` is not re-run, so its `auth.hasAccessToken` flag stays `false` and the
// navbar keeps rendering the logged-out chrome (Login / Sign Up) until a manual
// refresh. The fix follows the post-login redirect with a full-page navigation
// (mirroring the logout flow) so SSR re-runs with the fresh cookie and the
// navbar reflects the authenticated session immediately.
//
// This test asserts the navbar is authenticated right after login WITHOUT any
// page.reload(). It uses the demo-account dropdown, so it only runs against a
// backend in demo mode (and skips on Firefox, whose cold dev-server load is too
// slow — same rationale as recurring-series-dashboard.spec.ts).

const ALICE_EMAIL = 'alice.owner@example.com';

async function loginViaDemoDropdown(page: Page): Promise<void> {
	await page.goto('/login', { timeout: 90_000 });

	// The demo-account dropdown is only rendered when the backend reports
	// `demo: true`. If it's missing the backend isn't in demo mode.
	const demoSelect = page.locator('#demo-account');
	await demoSelect.waitFor({ state: 'visible', timeout: 20_000 });

	await demoSelect.selectOption(ALICE_EMAIL);
	await page.getByRole('button', { name: /^sign in as/i }).click();

	// Login redirects to /dashboard (or the returnUrl).
	await page.waitForURL(/\/dashboard(\/|$|\?)|\/org\//, { timeout: 20_000 });
}

test.describe('Login navbar sync (#485)', () => {
	// Desktop-only. The assertions target the desktop navbar — the user-menu
	// button and the "Login" link live in `hidden md:block` / `hidden md:flex`
	// wrappers (Header.svelte), and on mobile both sit behind a hamburger toggle.
	// The post-login bootstrap path under test is viewport-independent, so the
	// desktop projects give full coverage. Firefox is additionally excluded
	// because its cold-load against the dev server exceeds Playwright timeouts.
	test.skip(
		({ browserName, isMobile }) => isMobile || browserName === 'firefox',
		'Desktop-only navbar assertions; Firefox cold dev-server load also times out.'
	);

	test('navbar reflects the authenticated session immediately after login, without a reload', async ({
		page
	}) => {
		test.setTimeout(120_000);

		await loginViaDemoDropdown(page);

		// No page.reload(): the authenticated chrome (user menu) must appear and
		// the logged-out "Login" link must disappear purely as a result of the
		// login navigation. Before the fix the navbar stayed logged-out here until
		// a manual refresh.
		await expect(page.getByRole('button', { name: 'User menu' })).toBeVisible({
			timeout: 15_000
		});
		await expect(page.getByRole('link', { name: 'Login', exact: true })).toHaveCount(0);
	});
});
