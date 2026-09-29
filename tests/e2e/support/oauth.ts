import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import { API_URL, ApiClient } from './api';
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
 * Intercept the client's redirect URI. Nothing listens on that port, so the
 * route is fulfilled locally. Awaits the route registration (so it is live
 * before the click), and `landed` resolves with the callback URL (code/state
 * or error in its query) only after the browser has finished navigating to
 * it, so an immediate `page.goto` cannot abort it (net::ERR_ABORTED).
 * Call BEFORE triggering the navigation.
 *
 * The route stays registered for the page's lifetime. A page reused across
 * several authorizations calls this again: any earlier handler for the same
 * pattern is dropped first, so each call owns a fresh promise.
 */
export async function awaitCallback(
	page: Page,
	redirectUri = OAUTH_CALLBACK
): Promise<{ landed: Promise<URL> }> {
	const pattern = `${redirectUri}*`;
	let resolveUrl!: (u: URL) => void;
	const hit = new Promise<URL>((r) => (resolveUrl = r));
	await page.unroute(pattern);
	await page.route(pattern, async (route) => {
		resolveUrl(new URL(route.request().url()));
		await route.fulfill({
			status: 200,
			contentType: 'text/html',
			body: '<html><body>callback</body></html>'
		});
	});
	const landed = (async () => {
		const url = await hit;
		await page.waitForURL(`${redirectUri}**`);
		return url;
	})();
	// Keep an unhandled rejection from surfacing if a spec never awaits `landed`.
	landed.catch(() => undefined);
	return { landed };
}

export interface TokenResponse {
	access_token: string;
	token_type: string;
	scope?: string;
}

interface TokenRequest {
	code: string;
	verifier: string;
	clientId: string;
	redirectUri?: string;
	/** A confidential client authenticates with its secret as a form field (`client_secret_post`). */
	clientSecret?: string;
}

/**
 * One raw POST /o/token, for specs that assert on a refusal (status + the
 * RFC 6749 `error` code). `exchangeCode` is the happy-path wrapper.
 */
export async function requestToken(
	p: TokenRequest
): Promise<{ status: number; body: Record<string, unknown> }> {
	const body = new URLSearchParams({
		grant_type: 'authorization_code',
		code: p.code,
		redirect_uri: p.redirectUri ?? OAUTH_CALLBACK,
		client_id: p.clientId,
		code_verifier: p.verifier
	});
	if (p.clientSecret !== undefined) body.set('client_secret', p.clientSecret);
	// Plain fetch, never fetchWithRetry: the code is single-use, so a retry after
	// the backend consumed it would mask the real failure behind `invalid_grant`.
	const response = await fetch(`${API_URL}/o/token`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: body.toString()
	});
	const text = await response.text();
	let parsed: Record<string, unknown>;
	try {
		parsed = JSON.parse(text) as Record<string, unknown>;
	} catch {
		parsed = { raw: text.slice(0, 300) };
	}
	return { status: response.status, body: parsed };
}

export async function exchangeCode(p: TokenRequest): Promise<TokenResponse> {
	const { status, body } = await requestToken(p);
	if (status !== 200) {
		throw new Error(`POST /o/token ${status}: ${JSON.stringify(body).slice(0, 300)}`);
	}
	return body as unknown as TokenResponse;
}

/**
 * Drive one authorization to the client's callback and return the code.
 * Handles both outcomes of a request the user may already have granted: the
 * consent screen (click Allow) or auto-approval straight to the callback.
 * `prompted` says which one happened, for specs that pin it.
 */
export async function authorizeForCode(
	page: Page,
	url: string,
	redirectUri = OAUTH_CALLBACK
): Promise<{ code: string; state: string | null; prompted: boolean }> {
	const { landed } = await awaitCallback(page, redirectUri);
	await page.goto(url);
	const allow = page.getByRole('button', { name: 'Allow' });
	const screen = allow.waitFor({ state: 'visible' }).then(() => 'screen' as const);
	// Whichever loses the race is abandoned; keep its rejection (context close) quiet.
	screen.catch(() => undefined);
	const first = await Promise.race([landed.then(() => 'callback' as const), screen]);
	if (first === 'screen') await allow.click();
	const callback = await landed;
	const code = callback.searchParams.get('code');
	if (!code) throw new Error(`Callback carried no code: ${callback.toString()}`);
	return { code, state: callback.searchParams.get('state'), prompted: first === 'screen' };
}

/** Client IDs the API caller (as resource owner) has connected, per GET /api/oauth/connections/. */
export async function connectedClientIds(api: ApiClient): Promise<string[]> {
	const rows = await api.get<{ client_id: string }[]>('/api/oauth/connections/');
	return rows.map((r) => r.client_id);
}

export const newState = (): string => randomUUID();
