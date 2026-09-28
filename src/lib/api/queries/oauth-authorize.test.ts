import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the auth store the client interceptor reads, so requests go out at once.
vi.mock('$lib/stores/auth.svelte', () => ({
	authStore: {
		accessToken: 'tok',
		isAuthenticated: true,
		waitForAuthReady: vi.fn().mockResolvedValue(undefined),
		refreshAccessToken: vi.fn().mockResolvedValue(undefined)
	}
}));

import { client } from '$lib/api/client';
import { decideAuthorization, describeAuthorization } from './oauth-authorize';

const SEARCH =
	'?client_id=abc&response_type=code&redirect_uri=https%3A%2F%2Fapp.example%2Fcb&scope=openid%20profile%20org%3Aread&state=xyz&code_challenge=Q&code_challenge_method=S256&resource=http%3A%2F%2Flocalhost%3A8000&resource=https%3A%2F%2Fother.example';

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
	fetchMock = vi.fn();
	client.setConfig({ fetch: fetchMock as unknown as typeof fetch });
});

function requestedUrl(): URL {
	const req = fetchMock.mock.calls[0][0] as Request;
	return new URL(req.url);
}

describe('describeAuthorization', () => {
	it('appends the query string byte-for-byte (repeated resource, pre-encoded values)', async () => {
		fetchMock.mockResolvedValue(
			jsonResponse(200, { redirect_to: 'https://app.example/cb?code=1' })
		);
		await describeAuthorization(SEARCH);
		const url = requestedUrl();
		expect(url.pathname + url.search).toBe('/api/oauth/authorize' + SEARCH);
		expect((fetchMock.mock.calls[0][0] as Request).method).toBe('GET');
	});

	it('returns describe for a consent description', async () => {
		const body = {
			application: {
				name: 'A',
				description: '',
				logo_url: null,
				verified: false,
				registration_source: 'manual',
				homepage_url: '',
				privacy_policy_url: ''
			},
			scopes: [],
			redirect_uri: 'https://app.example/cb',
			state: null,
			consent_ticket: 'ticket'
		};
		fetchMock.mockResolvedValue(jsonResponse(200, body));
		expect(await describeAuthorization(SEARCH)).toEqual({ kind: 'describe', data: body });
	});

	it('returns redirect for a redirect_to body', async () => {
		fetchMock.mockResolvedValue(
			jsonResponse(200, { redirect_to: 'https://app.example/cb?code=1' })
		);
		expect(await describeAuthorization(SEARCH)).toEqual({
			kind: 'redirect',
			redirectTo: 'https://app.example/cb?code=1'
		});
	});

	it('returns error with code and detail for a 400 body', async () => {
		fetchMock.mockResolvedValue(
			jsonResponse(400, { detail: 'Bad scope.', error: 'invalid_scope' })
		);
		expect(await describeAuthorization(SEARCH)).toEqual({
			kind: 'error',
			code: 'invalid_scope',
			detail: 'Bad scope.'
		});
	});

	it('returns unauthenticated for a 401 and failure for anything else', async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse(401, { detail: 'Unauthorized' }));
		expect(await describeAuthorization(SEARCH)).toEqual({ kind: 'unauthenticated' });
		fetchMock.mockResolvedValueOnce(jsonResponse(404, { detail: 'Not found.' }));
		expect(await describeAuthorization(SEARCH)).toEqual({ kind: 'failure' });
		fetchMock.mockRejectedValueOnce(new TypeError('network'));
		expect(await describeAuthorization(SEARCH)).toEqual({ kind: 'failure' });
	});
});

describe('decideAuthorization', () => {
	it('POSTs the decision to the same verbatim URL', async () => {
		fetchMock.mockResolvedValue(
			jsonResponse(200, { redirect_to: 'https://app.example/cb?code=1' })
		);
		const result = await decideAuthorization(SEARCH, { allow: true, consent_ticket: 't' });
		const req = fetchMock.mock.calls[0][0] as Request;
		const url = new URL(req.url);
		expect(req.method).toBe('POST');
		expect(url.pathname + url.search).toBe('/api/oauth/authorize' + SEARCH);
		expect(await req.clone().json()).toEqual({ allow: true, consent_ticket: 't' });
		expect(result).toEqual({ kind: 'redirect', redirectTo: 'https://app.example/cb?code=1' });
	});

	it('maps consent_required and invalid_request 400s to error results', async () => {
		fetchMock.mockResolvedValue(
			jsonResponse(400, { detail: 'Expired.', error: 'consent_required' })
		);
		expect(await decideAuthorization(SEARCH, { allow: false })).toEqual({
			kind: 'error',
			code: 'consent_required',
			detail: 'Expired.'
		});
	});
});
