import type { BrowserContext } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import { ApiClient } from '../../support/api';
import { createVerifiedUser } from '../../support/factories';
import { pageAs } from '../../support/session';
import { featureEnabled } from '../../support/skip';
import {
	authorizeUrl,
	awaitCallback,
	deleteApp,
	newState,
	pkcePair,
	registerPublicApp,
	type RegisteredApp
} from '../../support/oauth';

// J28 (USER_JOURNEYS.md) — Deny on the consent screen sends the browser back
// to the client with `error=access_denied` and the state echoed, never a code.

test.describe('J28 consent deny @p1', () => {
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

	test('deny → callback carries access_denied and the state, no code', async ({ browser }) => {
		const page = await pageAs(browser, 'user2');
		context = page.context();
		const clientId = (app as RegisteredApp).client_id;
		const state = newState();
		const url = authorizeUrl({ clientId, state, challenge: pkcePair().challenge });

		await page.goto(url);
		const deny = page.getByRole('button', { name: 'Deny' });
		await expect(deny).toBeVisible();

		const { landed } = await awaitCallback(page);
		await deny.click();
		const callback = await landed;
		expect(callback.searchParams.get('error')).toBe('access_denied');
		expect(callback.searchParams.get('state')).toBe(state);
		expect(callback.searchParams.get('code')).toBeNull();
	});
});
