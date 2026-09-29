import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import { API_URL, ApiClient, fetchWithRetry } from './api';
import { uniqueName } from './factories';

/** Loopback http is legal for a PUBLIC client; port 47123 is outside the browsers' restricted-port list. */
export const OAUTH_CALLBACK = 'http://127.0.0.1:47123/callback';
/** `me:read` is what lets the token call GET /api/account/me. */
export const OAUTH_SCOPES = ['openid', 'profile', 'me:read'];

export interface RegisteredApp {
	id: string;
	client_id: string;
	name: string;
}

interface AppResponse {
	id: string;
	client_id: string;
	name: string;
}

export async function registerPublicApp(
	api: ApiClient,
	opts: { name?: string; redirectUri?: string; scopes?: string[] } = {}
): Promise<RegisteredApp> {
	const name = opts.name ?? uniqueName('OAuthApp');
	const created = await api.post<AppResponse>('/api/oauth/apps/', {
		name,
		description: 'E2E test client',
		client_type: 'public',
		redirect_uris: [opts.redirectUri ?? OAUTH_CALLBACK],
		allowed_scopes: opts.scopes ?? OAUTH_SCOPES,
		homepage_url: '',
		privacy_policy_url: ''
	});
	return { id: created.id, client_id: created.client_id, name };
}

/** Best-effort: the per-user cap is 10 and every spec registers its own app. */
export async function deleteApp(api: ApiClient, id: string): Promise<void> {
	try {
		await api.delete<void>(`/api/oauth/apps/${id}`);
	} catch {
		// Already gone (a spec deleted it through the UI) or the backend is down.
	}
}

export function pkcePair(): { verifier: string; challenge: string } {
	const verifier = randomBytes(48).toString('base64url');
	const challenge = createHash('sha256').update(verifier).digest('base64url');
	return { verifier, challenge };
}

/**
 * The client's authorization request, as the app would build it. `resource`
 * may repeat and MUST equal the issuer origin (`API_URL`), or the token is
 * bound elsewhere and a second request is not a prior grant.
 */
export function authorizeUrl(p: {
	clientId: string;
	redirectUri?: string;
	scope?: string[];
	state: string;
	challenge: string;
	resource?: string[];
	prompt?: string;
}): string {
	const query = new URLSearchParams();
	query.set('client_id', p.clientId);
	query.set('response_type', 'code');
	query.set('redirect_uri', p.redirectUri ?? OAUTH_CALLBACK);
	query.set('scope', (p.scope ?? OAUTH_SCOPES).join(' '));
	query.set('state', p.state);
	query.set('code_challenge', p.challenge);
	query.set('code_challenge_method', 'S256');
	for (const r of p.resource ?? [API_URL]) query.append('resource', r);
	if (p.prompt) query.set('prompt', p.prompt);
	return `/oauth/authorize?${query.toString()}`;
}

/**
 * Catch the browser being sent to the client's redirect URI. Nothing listens
 * on that port, so the route is fulfilled locally; the promise resolves with
 * the URL the browser navigated to (code/state or error in its query).
 * Register BEFORE triggering the navigation.
 */
export function awaitCallback(page: Page, redirectUri = OAUTH_CALLBACK): Promise<URL> {
	return new Promise<URL>((resolve, reject) => {
		page
			.route(`${redirectUri}*`, async (route) => {
				resolve(new URL(route.request().url()));
				await route.fulfill({
					status: 200,
					contentType: 'text/html',
					body: '<html><body>callback</body></html>'
				});
			})
			.catch(reject);
	});
}

export async function exchangeCode(p: {
	code: string;
	verifier: string;
	clientId: string;
	redirectUri?: string;
}): Promise<{ access_token: string; token_type: string; scope?: string }> {
	const body = new URLSearchParams({
		grant_type: 'authorization_code',
		code: p.code,
		redirect_uri: p.redirectUri ?? OAUTH_CALLBACK,
		client_id: p.clientId,
		code_verifier: p.verifier
	});
	const response = await fetchWithRetry(`${API_URL}/o/token`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: body.toString()
	});
	const text = await response.text();
	if (!response.ok) throw new Error(`POST /o/token ${response.status}: ${text.slice(0, 300)}`);
	return JSON.parse(text) as { access_token: string; token_type: string; scope?: string };
}

export const newState = (): string => randomUUID();
