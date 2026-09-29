import type { BrowserContext, Locator, Page } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import { API_URL, ApiClient, fetchWithRetry } from '../../support/api';
import { createVerifiedUser, type ThrowawayUser } from '../../support/factories';
import { PERSONAS } from '../../support/personas';
import { pageAs } from '../../support/session';
import { featureEnabled } from '../../support/skip';
import {
	OAUTH_CALLBACK,
	authorizeForCode,
	authorizeUrl,
	connectedClientIds,
	deleteApp,
	exchangeCode,
	newState,
	pkcePair,
	registerPublicApp,
	type RegisteredApp
} from '../../support/oauth';

// J28 (USER_JOURNEYS.md) — a developer edits a live app: rename, a second
// redirect URI, and a narrowed scope set. Client-side validation blocks a bad
// URI without a request. Narrowing the scopes revokes every credential that
// held the removed scope (token_service.revoke_scoped_tokens): the user's old
// token dies, the app drops off Connected apps, and the next authorization
// asks again. The developer is a throwaway (10-app cap); the consenting user
// is the seeded `user` persona.

/** Kept: `me:read` is what lets the token call GET /api/account/me. */
const KEPT = 'me:read';
/** Removed by the edit. */
const REMOVED = 'profile';
const KEPT_LABEL = 'See your profile, tickets, RSVPs, memberships, invoices and payments';
const REMOVED_LABEL = 'See your name and picture';
const SECOND_URI = 'http://localhost:47124/cb';

/** Filter by text: on mobile the (closed) nav drawer is also a role="dialog". */
function confirmDialog(page: Page, title: string): Locator {
	return page.getByRole('alertdialog').or(page.getByRole('dialog')).filter({ hasText: title });
}

function meWith(accessToken: string): Promise<Response> {
	return fetchWithRetry(`${API_URL}/api/account/me`, {
		headers: { Authorization: `Bearer ${accessToken}` }
	});
}

/** Connected apps has settled: either some card or the empty state is on screen. */
async function openConnectedApps(page: Page): Promise<void> {
	await page.goto('/account/connected-apps');
	await expect(
		page.getByRole('article').or(page.getByText('No apps are connected to your account.')).first()
	).toBeVisible();
}

test.describe('J28 developer app edit @p1', () => {
	let devApi: ApiClient | undefined;
	let dev: ThrowawayUser | undefined;
	let app: RegisteredApp | undefined;
	const contexts: BrowserContext[] = [];

	test.beforeEach(async () => {
		dev = undefined;
		devApi = undefined;
		app = undefined;
		contexts.length = 0;
		test.skip(
			!(await featureEnabled('oauth_provider')),
			'OAuth provider is switched off on this backend'
		);
		dev = await createVerifiedUser('OAuthDevEdit');
		devApi = await ApiClient.login(dev.email, dev.password);
		app = await registerPublicApp(devApi, { scopes: [KEPT, REMOVED] });
	});

	test.afterEach(async () => {
		for (const context of contexts) await context.close();
		if (devApi && app) await deleteApp(devApi, app.id);
	});

	test('rename + second URI + drop a scope → old token revoked, consent asked again', async ({
		browser
	}) => {
		const registered = app as RegisteredApp;
		const renamed = `${registered.name} (renamed)`;

		// 1. The user consents to both scopes; the token works; Connected apps lists it.
		const userPage = await pageAs(browser, 'user');
		contexts.push(userPage.context());
		const pair = pkcePair();
		const run = await authorizeForCode(
			userPage,
			authorizeUrl({
				clientId: registered.client_id,
				scope: [KEPT, REMOVED],
				state: newState(),
				challenge: pair.challenge
			})
		);
		expect(run.prompted).toBe(true);
		const token = await exchangeCode({
			code: run.code,
			verifier: pair.verifier,
			clientId: registered.client_id
		});
		expect(token.scope?.split(' ').sort()).toEqual([KEPT, REMOVED].sort());
		const before = await meWith(token.access_token);
		expect(before.status).toBe(200);
		expect(((await before.json()) as { email: string }).email).toBe(PERSONAS.user.email);

		await openConnectedApps(userPage);
		await expect(
			userPage.getByRole('article', { name: registered.name, exact: true })
		).toBeVisible();

		// 2. The developer opens the detail page.
		const devPage = await pageAs(browser, dev as ThrowawayUser);
		contexts.push(devPage.context());
		await devPage.goto(`/account/developer-apps/${registered.id}`);
		await expect(
			devPage.getByRole('heading', { level: 1, name: registered.name, exact: true })
		).toBeVisible();

		const patches: string[] = [];
		devPage.on('request', (r) => {
			if (r.method() === 'PATCH' && new URL(r.url()).pathname.startsWith('/api/oauth/apps'))
				patches.push(r.url());
		});
		const nameField = devPage.getByLabel('Name', { exact: true });
		const uri1 = devPage.getByLabel('Redirect URI 1', { exact: true });
		const uri2 = devPage.getByLabel('Redirect URI 2', { exact: true });
		const kept = devPage.getByRole('checkbox', { name: KEPT_LABEL, exact: true });
		const removed = devPage.getByRole('checkbox', { name: REMOVED_LABEL, exact: true });
		const save = devPage.getByRole('button', { name: 'Save changes' });
		await expect(nameField).toHaveValue(registered.name);
		await expect(kept).toBeChecked();
		await expect(removed).toBeChecked();

		await nameField.fill(renamed);
		await devPage.getByRole('button', { name: 'Add another URI' }).click();

		// 3. A malformed URI is refused client-side: inline error, focus on it, no PATCH.
		await uri2.fill('not a url');
		await save.click();
		await expect(uri2).toHaveAttribute('aria-invalid', 'true');
		await expect(uri2).toBeFocused();
		await expect(
			devPage.getByRole('heading', { level: 1, name: registered.name, exact: true })
		).toBeVisible();
		expect(patches).toEqual([]);

		// 4. Fix it, drop the scope, save. Removing a scope asks first (it signs users out).
		await uri2.fill(SECOND_URI);
		await removed.uncheck();
		await expect(removed).not.toBeChecked();
		await save.click();
		const warn = confirmDialog(devPage, 'Remove permissions?');
		await expect(warn).toBeVisible();
		await expect(warn).toContainText(REMOVED);
		expect(patches).toEqual([]);
		const patched = devPage.waitForResponse(
			(r) =>
				r.request().method() === 'PATCH' &&
				new URL(r.url()).pathname.startsWith(`/api/oauth/apps/${registered.id}`)
		);
		await warn.getByRole('button', { name: 'Remove and save' }).click();
		expect((await patched).status()).toBe(200);
		await expect(devPage.getByText('Changes saved.')).toBeVisible();
		await expect(
			devPage.getByRole('heading', { level: 1, name: renamed, exact: true })
		).toBeVisible();
		expect(patches).toHaveLength(1);

		// 5. The saved values survive a reload.
		await devPage.reload();
		await expect(
			devPage.getByRole('heading', { level: 1, name: renamed, exact: true })
		).toBeVisible();
		await expect(nameField).toHaveValue(renamed);
		await expect(uri1).toHaveValue(OAUTH_CALLBACK);
		await expect(uri2).toHaveValue(SECOND_URI);
		await expect(kept).toBeChecked();
		await expect(removed).not.toBeChecked();

		// 6. The scope shrink revoked the user's token (it held the removed scope).
		expect((await meWith(token.access_token)).status).toBe(401);

		// 7. No credential is left, so nothing is connected (API truth and the UI) …
		const userApi = await ApiClient.login(PERSONAS.user.email, PERSONAS.user.password);
		expect(await connectedClientIds(userApi)).not.toContain(registered.client_id);
		await openConnectedApps(userPage);
		await expect(userPage.getByRole('article', { name: renamed, exact: true })).toHaveCount(0);
		await expect(userPage.getByRole('article', { name: registered.name, exact: true })).toHaveCount(
			0
		);

		// 8. … and even the surviving scope alone is not a prior grant: consent again.
		const again = pkcePair();
		const rerun = await authorizeForCode(
			userPage,
			authorizeUrl({
				clientId: registered.client_id,
				scope: [KEPT],
				state: newState(),
				challenge: again.challenge
			})
		);
		expect(rerun.prompted).toBe(true);
	});
});
