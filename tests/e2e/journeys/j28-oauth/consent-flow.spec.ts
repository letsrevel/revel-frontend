import { test, expect } from '../../support/fixtures';
import { API_URL, ApiClient, fetchWithRetry } from '../../support/api';
import { createVerifiedUser } from '../../support/factories';
import { PERSONAS } from '../../support/personas';
import { pageAs } from '../../support/session';
import { featureEnabled } from '../../support/skip';
import {
	authorizeUrl,
	awaitCallback,
	deleteApp,
	exchangeCode,
	newState,
	OAUTH_CALLBACK,
	pkcePair,
	registerPublicApp,
	type RegisteredApp
} from '../../support/oauth';

// J28.2/28.3 (USER_JOURNEYS.md) — the full authorization-code + PKCE loop:
// consent screen → Allow → callback → token → API call; a repeat request is
// auto-approved; Connected apps lists and removes the grant; the next request
// asks again. The developer is a throwaway user (10-app cap, parallel projects);
// the consenting user is the seeded `user` persona.

test.describe('J28 consent flow @p0', () => {
	let api: ApiClient;
	let app: RegisteredApp;

	test.beforeEach(async () => {
		test.skip(
			!(await featureEnabled('oauth_provider')),
			'OAuth provider is switched off on this backend'
		);
		const dev = await createVerifiedUser('OAuthDev');
		api = await ApiClient.login(dev.email, dev.password);
		app = await registerPublicApp(api);
	});

	test.afterEach(async () => {
		if (api && app) await deleteApp(api, app.id);
	});

	test('allow → code → token → API; prior grant skips the screen; remove → asks again', async ({
		browser
	}) => {
		const page = await pageAs(browser, 'user');
		const { verifier, challenge } = pkcePair();
		const state = newState();
		const url = authorizeUrl({ clientId: app.client_id, state, challenge });

		// 1. Consent screen. Demo backends add their own banner alert, so filter by text.
		await page.goto(url);
		await expect(
			page.getByRole('heading', { level: 1, name: `Connect ${app.name}` })
		).toBeVisible();
		await expect(
			page.getByRole('alert').filter({ hasText: 'Revel has not reviewed this app' })
		).toBeVisible();
		await expect(
			page.getByRole('heading', { level: 2, name: 'Sign in and profile' })
		).toBeVisible();
		await expect(page.getByRole('heading', { level: 2, name: 'Your account' })).toBeVisible();
		await expect(page.getByText('Signed in as')).toBeVisible();
		const allow = page.getByRole('button', { name: 'Allow' });
		const deny = page.getByRole('button', { name: 'Deny' });
		await expect(allow).toBeVisible();
		await expect(deny).toBeVisible();

		// 2. Allow → the browser is sent to the client's callback with code + state.
		const callback = awaitCallback(page);
		await allow.click();
		const landed = await callback;
		// The route resolves before its fulfill commits; let the navigation land
		// so the next goto does not abort it (net::ERR_ABORTED).
		await page.waitForURL(`${OAUTH_CALLBACK}**`);
		expect(landed.searchParams.get('state')).toBe(state);
		const code = landed.searchParams.get('code');
		expect(code).toBeTruthy();

		// 3. The app exchanges the code (PKCE) and calls the API as the user.
		const token = await exchangeCode({ code: code as string, verifier, clientId: app.client_id });
		const me = await fetchWithRetry(`${API_URL}/api/account/me`, {
			headers: { Authorization: `Bearer ${token.access_token}` }
		});
		expect(me.status).toBe(200);
		expect(((await me.json()) as { email: string }).email).toBe(PERSONAS.user.email);

		// 4. The identical request again: prior grant → straight to the callback, no screen.
		const again = awaitCallback(page);
		await page.goto(url);
		expect((await again).searchParams.get('code')).toBeTruthy();
		await page.waitForURL(`${OAUTH_CALLBACK}**`);

		// 5. Connected apps lists it; Remove → confirm → gone.
		await page.goto('/account/connected-apps');
		const card = page.getByRole('article', { name: app.name });
		await expect(card).toBeVisible();
		await expect(card.getByRole('listitem').first()).toContainText('Sign you in');
		await card.getByRole('button', { name: `Remove ${app.name}` }).click();
		// Filter by text: on mobile the (closed) nav drawer is also a role="dialog".
		const dialog = page
			.getByRole('alertdialog')
			.or(page.getByRole('dialog'))
			.filter({ hasText: `Disconnect ${app.name}?` });
		await expect(dialog).toBeVisible();
		await dialog.getByRole('button', { name: 'Disconnect' }).click();
		await expect(card).toHaveCount(0);

		// 6. The next request asks again.
		await page.goto(url);
		await expect(page.getByRole('button', { name: 'Allow' })).toBeVisible();
		await page.context().close();
	});
});
