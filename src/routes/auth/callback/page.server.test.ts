import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/api/client', () => ({
	authOidcExchange: vi.fn()
}));
vi.mock('$lib/server/session', () => ({
	establishSession: vi.fn().mockResolvedValue(undefined)
}));
vi.mock('$lib/server/logger', () => ({
	log: { debug: vi.fn(), warning: vi.fn(), error: vi.fn() }
}));

import { authOidcExchange } from '$lib/api/client';
import { establishSession } from '$lib/server/session';
import { load } from './+page.server';

const mockedExchange = vi.mocked(authOidcExchange);

function loadArgs(search: string) {
	return {
		url: new URL(`http://localhost:5173/auth/callback${search}`),
		cookies: { set: vi.fn(), get: vi.fn(), delete: vi.fn() },
		fetch: vi.fn()
	} as unknown as Parameters<typeof load>[0];
}

/** Run load and return the thrown redirect. */
async function loadRedirect(search: string): Promise<{ status: number; location: string }> {
	try {
		await load(loadArgs(search));
	} catch (err) {
		const redirect = err as { status?: number; location?: string };
		if (typeof redirect.status === 'number' && typeof redirect.location === 'string') {
			return { status: redirect.status, location: redirect.location };
		}
		throw err;
	}
	throw new Error('load() did not redirect');
}

beforeEach(() => {
	mockedExchange.mockReset();
	vi.mocked(establishSession).mockClear();
});

describe('/auth/callback load', () => {
	it('redirects to the login error page when the token is missing', async () => {
		expect(await loadRedirect('')).toEqual({ status: 303, location: '/login?error=oidc_state' });
		expect(mockedExchange).not.toHaveBeenCalled();
	});

	it('redirects to the login error page when the exchange is rejected (401)', async () => {
		mockedExchange.mockResolvedValue({
			data: undefined,
			error: { detail: 'invalid' },
			response: { ok: false, status: 401 }
		} as never);

		expect(await loadRedirect('?token=used')).toEqual({
			status: 303,
			location: '/login?error=oidc_state'
		});
		expect(establishSession).not.toHaveBeenCalled();
	});

	it('establishes a persistent session and redirects to return_url', async () => {
		mockedExchange.mockResolvedValue({
			data: { username: 'u', access: 'acc', refresh: 'ref', return_url: '/events' },
			error: undefined,
			response: { ok: true, status: 200 }
		} as never);

		const redirect = await loadRedirect('?token=good');

		expect(mockedExchange).toHaveBeenCalledWith(
			expect.objectContaining({ body: { token: 'good' } })
		);
		expect(establishSession).toHaveBeenCalledWith(
			expect.anything(),
			{ access: 'acc', refresh: 'ref' },
			true,
			expect.anything()
		);
		expect(redirect).toEqual({ status: 303, location: '/events' });
	});

	it('sanitizes a non-relative return_url through safeReturnUrl', async () => {
		mockedExchange.mockResolvedValue({
			data: { username: 'u', access: 'acc', refresh: 'ref', return_url: 'https://evil.example' },
			error: undefined,
			response: { ok: true, status: 200 }
		} as never);

		expect((await loadRedirect('?token=good')).location).toBe('/dashboard');
	});

	it('redirects to the login error page when the exchange throws', async () => {
		mockedExchange.mockRejectedValue(new Error('network'));
		expect(await loadRedirect('?token=x')).toEqual({
			status: 303,
			location: '/login?error=oidc_state'
		});
	});
});
