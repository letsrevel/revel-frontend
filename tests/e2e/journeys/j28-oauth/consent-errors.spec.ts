import type { BrowserContext } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import { pageAs } from '../../support/session';
import { featureEnabled } from '../../support/skip';
import { OAUTH_CALLBACK, authorizeUrl, newState, pkcePair } from '../../support/oauth';

// J28 (USER_JOURNEYS.md) — an authorization request the provider cannot trust
// (unknown client) renders an error screen on Revel and never redirects: an
// unverified redirect URI must not receive anything.

test.describe('J28 consent errors @p1', () => {
	let context: BrowserContext | undefined;

	test.beforeEach(async () => {
		context = undefined;
		test.skip(
			!(await featureEnabled('oauth_provider')),
			'OAuth provider is switched off on this backend'
		);
	});

	test.afterEach(async () => {
		await context?.close();
	});

	test('unknown client → error screen, no Allow, no redirect', async ({ browser }) => {
		const page = await pageAs(browser, 'user2');
		context = page.context();

		// Record (and swallow) any request to the redirect URI, from the very start.
		const callbackHits: string[] = [];
		await page.route(`${OAUTH_CALLBACK}*`, async (route) => {
			callbackHits.push(route.request().url());
			await route.abort();
		});

		await page.goto(
			authorizeUrl({ clientId: 'not-a-client', state: newState(), challenge: pkcePair().challenge })
		);

		const headline = page.getByTestId('consent-error-headline');
		await expect(headline).toBeVisible();
		await expect(headline).not.toHaveText(/^\s*$/);
		await expect(page.getByRole('button', { name: 'Allow' })).toHaveCount(0);
		expect(new URL(page.url()).pathname).toBe('/oauth/authorize');

		// Observe a real 2 s window: a late client-side redirect would resolve this.
		await expect(page.waitForURL(`${OAUTH_CALLBACK}**`, { timeout: 2_000 })).rejects.toThrow();
		expect(callbackHits).toEqual([]);
		expect(new URL(page.url()).pathname).toBe('/oauth/authorize');
	});
});
