import type { BrowserContext, Page } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import { uiLogin } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import { fetchWithRetry, getBackendUrl } from '../../support/api';

// #1191 / #1199 — refresh-token rotation vs. reload, and server-side logout.
//
// The backend rotates the refresh token on every refresh (R1 -> R2). Before
// revel-backend#1357 a reload landing mid-rotation presented the already
// blacklisted R1 and ended on /login. The backend now accepts the PREVIOUS
// token once, within REFRESH_TOKEN_REUSE_GRACE_SECONDS (30 s), and hands out a
// fresh pair; a second reuse, a reuse after the window, or any reuse after
// logout is a plain 401. Logout (POST /api/auth/logout, called by the /logout
// action) revokes the whole login lineage.
//
// Each test signs in through the UI so it owns a private login lineage:
// revoking it cannot touch the persona sessions other specs share.

async function cookieValue(context: BrowserContext, name: string): Promise<string> {
	const cookie = (await context.cookies()).find((c) => c.name === name);
	if (!cookie) throw new Error(`cookie ${name} missing`);
	return cookie.value;
}

async function backendRefresh(refresh: string): Promise<number> {
	const res = await fetchWithRetry(getBackendUrl('/api/auth/refresh'), {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ refresh })
	});
	return res.status;
}

async function confirmLogout(page: Page): Promise<void> {
	await gotoHydrated(page, '/logout');
	await page.locator('#main-content').getByRole('button', { name: 'Log Out' }).click();
	await page.waitForURL(/logged_out=true/);
}

test.describe('J3 session: refresh grace & server-side logout (#1191, #1199) @p0', () => {
	test('a reload while the refresh response is lost keeps the user signed in', async ({
		page,
		context
	}) => {
		await uiLogin(page, 'member');
		await gotoHydrated(page, '/dashboard');
		await waitForClientAuth(page);

		// Settled session: remember exactly what the browser holds.
		const r1 = await cookieValue(context, 'refresh_token');
		const access = await cookieValue(context, 'access_token');

		// Simulate "the reload lands mid-rotation": let the refresh reach the
		// backend (R1 is rotated to R2 and R1 is spent), then DROP the response so
		// the browser never receives the Set-Cookie. This is exactly what a
		// navigation cancelling an in-flight fetch does.
		let r2: string | null = null;
		await page.route('**/api/auth/refresh', async (route) => {
			if (route.request().method() !== 'POST') return route.continue();
			const response = await route.fetch();
			for (const h of response.headersArray()) {
				if (h.name.toLowerCase() !== 'set-cookie') continue;
				const m = /^refresh_token=([^;]+)/.exec(h.value);
				if (m) r2 = m[1];
			}
			await route.abort('failed');
		});

		await page.reload();
		await expect.poll(() => r2, { timeout: 15_000 }).not.toBeNull();
		await page.unroute('**/api/auth/refresh');

		// route.fetch shares the context's cookie jar, which would hand the browser
		// the rotated cookie after all. Put back what a lost response leaves: the
		// OLD tokens.
		await context.clearCookies({ name: 'refresh_token' });
		await context.clearCookies({ name: 'access_token' });
		await context.addCookies(
			[
				{ name: 'refresh_token', value: r1 },
				{ name: 'access_token', value: access }
			].map((c) => ({
				...c,
				domain: 'localhost',
				path: '/',
				httpOnly: true,
				secure: false,
				sameSite: 'Lax' as const,
				expires: Math.round(Date.now() / 1000) + 60 * 60
			}))
		);

		// The reload that follows presents the spent R1: the grace window turns it
		// into one fresh pair instead of a sign-out.
		await page.goto('/dashboard');
		await page.locator('body[data-hydrated="true"]').waitFor({ state: 'attached' });
		await waitForClientAuth(page);
		await expect(page).toHaveURL(/\/dashboard(\/|$|\?)/);
		expect(new URL(page.url()).pathname).not.toBe('/login');
		expect(await cookieValue(context, 'refresh_token')).not.toBe(r1);

		// The grace hands out a pair of its own; the original successor stays valid.
		expect(r2).not.toBeNull();
		expect(await backendRefresh(r2 as unknown as string)).toBe(200);
	});

	test('logging out revokes the refresh token the browser held', async ({ page, browser }) => {
		await uiLogin(page, 'member');
		await gotoHydrated(page, '/dashboard');
		await waitForClientAuth(page);
		const r1 = await cookieValue(page.context(), 'refresh_token');

		await confirmLogout(page);

		// Server-side: the token is dead, not merely forgotten by this browser.
		expect(await backendRefresh(r1)).toBe(401);

		// A "stolen copy" of the cookie gets nowhere in a fresh context.
		const stolen = await browser.newContext();
		try {
			await stolen.addCookies([
				{
					name: 'refresh_token',
					value: r1,
					domain: 'localhost',
					path: '/',
					httpOnly: true,
					secure: false,
					sameSite: 'Lax',
					expires: Math.round(Date.now() / 1000) + 60 * 60
				}
			]);
			const thief = await stolen.newPage();
			await thief.goto('/dashboard');
			await expect(thief).toHaveURL(/\/login/);
		} finally {
			await stolen.close();
		}
	});
});
