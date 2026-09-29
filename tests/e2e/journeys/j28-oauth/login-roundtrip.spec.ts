import type { BrowserContext } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import { API_URL, ApiClient } from '../../support/api';
import { createVerifiedUser } from '../../support/factories';
import { uiLogin } from '../../support/session';
import { featureEnabled } from '../../support/skip';
import {
	authorizeUrl,
	deleteApp,
	newState,
	pkcePair,
	registerPublicApp,
	type RegisteredApp
} from '../../support/oauth';

// J28 (USER_JOURNEYS.md) — a signed-out user who follows an app's
// authorization link is sent to /login with the full request as returnUrl,
// and lands back on the identical request (repeated `resource` intact) after
// signing in.

test.describe('J28 login round trip @p1', () => {
	let api: ApiClient | undefined;
	let app: RegisteredApp | undefined;
	let context: BrowserContext | undefined;

	test.beforeEach(async () => {
		api = undefined;
		app = undefined;
		context = undefined;
		test.skip(
			!(await featureEnabled('oauth_provider')),
			'OAuth provider is switched off on this backend'
		);
		const dev = await createVerifiedUser('OAuthDev');
		api = await ApiClient.login(dev.email, dev.password);
		app = await registerPublicApp(api);
	});

	test.afterEach(async () => {
		await context?.close();
		if (api && app) await deleteApp(api, app.id);
	});

	test('signed out → login with returnUrl → back on the identical request', async ({ browser }) => {
		context = await browser.newContext();
		const page = await context.newPage();
		const url = authorizeUrl({
			clientId: (app as RegisteredApp).client_id,
			state: newState(),
			challenge: pkcePair().challenge,
			// Sent twice on purpose: a round trip that collapses multi-valued params must show.
			resource: [API_URL, API_URL]
		});

		await page.goto(url);
		await page.waitForURL(/\/login\?returnUrl=/);
		expect(new URL(page.url()).searchParams.get('returnUrl')).toBe(url);

		await uiLogin(page, 'user2', { startAt: page.url(), landsOn: /\/oauth\/authorize\?/ });
		expect(new URL(page.url()).search).toBe(new URL(url, 'http://x').search);
		expect(new URL(page.url()).searchParams.getAll('resource')).toEqual([API_URL, API_URL]);
		await expect(page.getByRole('button', { name: 'Allow' })).toBeVisible();
	});
});
