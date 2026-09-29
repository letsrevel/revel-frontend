import type { BrowserContext, Locator, Page } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import { API_URL, ApiClient, fetchWithRetry } from '../../support/api';
import { createVerifiedUser, uniqueName, type ThrowawayUser } from '../../support/factories';
import { PERSONAS } from '../../support/personas';
import { pageAs } from '../../support/session';
import { featureEnabled } from '../../support/skip';
import {
	OAUTH_SCOPES,
	authorizeForCode,
	authorizeUrl,
	deleteApp,
	exchangeCode,
	newState,
	pkcePair,
	requestToken
} from '../../support/oauth';

// J28 (USER_JOURNEYS.md) — a confidential client: registered through the UI
// with an https redirect URI, its secret shown exactly once, proven at the
// token endpoint, rotated from the danger zone (again shown once), and the old
// secret refused afterwards while the new one works. The consenting user is
// the seeded `user` persona; the developer is a throwaway (10-app cap).

/** Not a loopback host, so only a confidential client's https rule applies. Nothing listens there: `awaitCallback` fulfils it. */
const HTTPS_CALLBACK = 'https://client.example/callback';
/** DOT's generator: 128 chars of [A-Za-z0-9]. Loosened to the brief's shape so a generator change still reads as a secret. */
const SECRET_SHAPE = /^[A-Za-z0-9_-]{20,}$/;
/** Registry labels of `OAUTH_SCOPES` (backend `oauth/scopes.py`), which name the form's checkboxes. */
const SCOPE_LABELS = [
	'Sign you in',
	'See your name and picture',
	'See your profile, tickets, RSVPs, memberships, invoices and payments'
];

/** Filter by text: on mobile the (closed) nav drawer is also a role="dialog". */
function confirmDialog(page: Page, title: string): Locator {
	return page.getByRole('alertdialog').or(page.getByRole('dialog')).filter({ hasText: title });
}

async function expectMe(accessToken: string): Promise<void> {
	const me = await fetchWithRetry(`${API_URL}/api/account/me`, {
		headers: { Authorization: `Bearer ${accessToken}` }
	});
	expect(me.status).toBe(200);
	expect(((await me.json()) as { email: string }).email).toBe(PERSONAS.user.email);
}

/** The detail page has settled (the app query resolved), so an absence check means something. */
async function expectDetailLoaded(page: Page, name: string): Promise<void> {
	await expect(page.getByRole('heading', { level: 1, name, exact: true })).toBeVisible();
	await expect(page.locator('#developer-app-client-id')).not.toHaveValue('');
}

test.describe('J28 confidential developer app @p1', () => {
	let dev: ThrowawayUser | undefined;
	let appId: string | undefined;
	const contexts: BrowserContext[] = [];

	test.beforeEach(async () => {
		dev = undefined;
		appId = undefined;
		contexts.length = 0;
		test.skip(
			!(await featureEnabled('oauth_provider')),
			'OAuth provider is switched off on this backend'
		);
		dev = await createVerifiedUser('OAuthDevConf');
	});

	test.afterEach(async () => {
		for (const context of contexts) await context.close();
		if (dev && appId) {
			const api = await ApiClient.login(dev.email, dev.password).catch(() => undefined);
			if (api) await deleteApp(api, appId);
		}
	});

	test('https-only registration → secret once → works → rotate → old refused, new works', async ({
		browser
	}) => {
		const devPage = await pageAs(browser, dev as ThrowawayUser);
		contexts.push(devPage.context());
		const name = uniqueName('Confidential');

		// 1. Register a confidential client through the UI.
		await devPage.goto('/account/developer-apps/new');
		await devPage.getByLabel('Name', { exact: true }).fill(name);
		await devPage.getByRole('radio', { name: 'Confidential' }).click();
		await expect(devPage.getByRole('radio', { name: 'Confidential' })).toBeChecked();
		for (const label of SCOPE_LABELS) {
			await devPage.getByRole('checkbox', { name: label, exact: true }).check();
		}
		// The form pre-ticks org:read for a new app; this client asks for nothing organizer-side.
		await devPage
			.getByRole('checkbox', { name: 'See your organizations, events and settings', exact: true })
			.uncheck();

		// 1a. Loopback http is legal only for a PUBLIC client: refused inline, nothing sent.
		const posts: string[] = [];
		devPage.on('request', (r) => {
			if (r.method() === 'POST' && new URL(r.url()).pathname.startsWith('/api/oauth/apps'))
				posts.push(r.url());
		});
		const uri = devPage.getByLabel('Redirect URI 1', { exact: true });
		await uri.fill('http://127.0.0.1:47123/callback');
		await devPage.getByRole('button', { name: 'Register app' }).click();
		await expect(uri).toHaveAttribute('aria-invalid', 'true');
		// The error text equals the confidential hint, so pin it as THIS input's description.
		await expect(uri).toHaveAccessibleDescription('Confidential apps must use https.');
		await expect(uri).toBeFocused();
		expect(posts).toEqual([]);

		// 1b. https is accepted.
		await uri.fill(HTTPS_CALLBACK);
		await devPage.getByRole('button', { name: 'Register app' }).click();

		// 2. The one-time reveal. It lives on /new (the app id comes with "I've saved it").
		const reveal = devPage.getByRole('heading', { level: 2, name: 'Save your client secret' });
		await expect(reveal).toBeVisible();
		await expect(devPage.getByText("You won't see this again.")).toBeVisible();
		const clientId = await devPage.getByRole('textbox', { name: 'Client ID' }).inputValue();
		const s1 = await devPage.getByRole('textbox', { name: 'Client secret' }).inputValue();
		expect(clientId).not.toBe('');
		expect(s1).toMatch(SECRET_SHAPE);

		await devPage.getByRole('button', { name: "I've saved it" }).click();
		await devPage.waitForURL(/\/account\/developer-apps\/[0-9a-f-]{36}$/);
		appId = new URL(devPage.url()).pathname.split('/').pop();
		await expect(
			devPage.getByTestId('status-badge').filter({ hasText: /^\s*Confidential\s*$/ })
		).toBeVisible();

		// 2b. Never shown again: not on the detail, not after a reload.
		await devPage.reload();
		await expectDetailLoaded(devPage, name);
		await expect(devPage.getByRole('textbox', { name: 'Client secret' })).toHaveCount(0);
		expect(await devPage.content()).not.toContain(s1);

		// 3. S1 authenticates the client: consent → code → token (client_secret_post) → API.
		const userPage = await pageAs(browser, 'user');
		contexts.push(userPage.context());
		const authorize = (challenge: string, state: string) =>
			authorizeUrl({
				clientId,
				redirectUri: HTTPS_CALLBACK,
				scope: OAUTH_SCOPES,
				state,
				challenge
			});

		const first = pkcePair();
		const firstState = newState();
		const firstRun = await authorizeForCode(
			userPage,
			authorize(first.challenge, firstState),
			HTTPS_CALLBACK
		);
		// A brand-new client: the user has never granted it anything.
		expect(firstRun.prompted).toBe(true);
		expect(firstRun.state).toBe(firstState);
		const token = await exchangeCode({
			code: firstRun.code,
			verifier: first.verifier,
			clientId,
			redirectUri: HTTPS_CALLBACK,
			clientSecret: s1
		});
		await expectMe(token.access_token);

		// 4. Rotate from the danger zone → S2 shown once.
		await devPage.getByRole('button', { name: 'Rotate secret' }).click();
		const rotate = confirmDialog(devPage, 'Rotate the client secret?');
		await expect(rotate).toBeVisible();
		await rotate.getByRole('button', { name: 'Rotate secret' }).click();
		await expect(rotate).toBeHidden();
		const secretField = devPage.getByRole('textbox', { name: 'Client secret' });
		await expect(secretField).toHaveValue(SECRET_SHAPE);
		const s2 = await secretField.inputValue();
		expect(s2).not.toBe(s1);

		await devPage.reload();
		await expectDetailLoaded(devPage, name);
		await expect(devPage.getByRole('textbox', { name: 'Client secret' })).toHaveCount(0);
		const html = await devPage.content();
		expect(html).not.toContain(s1);
		expect(html).not.toContain(s2);

		// 5a. The old secret is refused. Rotation leaves the user's grant alone, so this
		// is (normally) auto-approved; either outcome still yields a fresh code.
		const second = pkcePair();
		const secondRun = await authorizeForCode(
			userPage,
			authorize(second.challenge, newState()),
			HTTPS_CALLBACK
		);
		const refused = await requestToken({
			code: secondRun.code,
			verifier: second.verifier,
			clientId,
			redirectUri: HTTPS_CALLBACK,
			clientSecret: s1
		});
		// oauthlib's InvalidClientError is a 401 (RFC 6749 §5.2 allows 400; this backend sends 401).
		expect(refused.status).toBe(401);
		expect(refused.body.error).toBe('invalid_client');

		// 5b. Codes are single-use: a THIRD authorization for the new secret.
		const third = pkcePair();
		const thirdRun = await authorizeForCode(
			userPage,
			authorize(third.challenge, newState()),
			HTTPS_CALLBACK
		);
		const rotated = await exchangeCode({
			code: thirdRun.code,
			verifier: third.verifier,
			clientId,
			redirectUri: HTTPS_CALLBACK,
			clientSecret: s2
		});
		await expectMe(rotated.access_token);
		// The token minted with S1 survives rotation (a client re-key, not a revocation).
		await expectMe(token.access_token);
	});
});
