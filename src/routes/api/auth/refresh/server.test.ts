import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Cookies } from '@sveltejs/kit';

vi.mock('$lib/api/generated', () => ({
	tokenRefresh: vi.fn()
}));

import { tokenRefresh } from '$lib/api/generated';
import { POST } from './+server';

const mockedTokenRefresh = vi.mocked(tokenRefresh);

/** A cookie jar that records writes so assertions can read them back. */
function fakeCookies(initial: Record<string, string> = {}) {
	const jar = new Map<string, string>(Object.entries(initial));
	const deleted: string[] = [];
	const cookies = {
		get: vi.fn((name: string) => jar.get(name)),
		set: vi.fn((name: string, value: string) => {
			jar.set(name, value);
		}),
		delete: vi.fn((name: string) => {
			jar.delete(name);
			deleted.push(name);
		})
	} as unknown as Cookies;
	return { cookies, jar, deleted };
}

/** The request-scoped fetch SvelteKit hands the handler; `handleFetch` wraps it. */
const requestFetch = vi.fn() as unknown as typeof fetch;

function postArgs(cookies: Cookies) {
	return { cookies, fetch: requestFetch } as unknown as Parameters<typeof POST>[0];
}

/** Run POST and return the HTTP status, whether it resolved or threw. */
async function postStatus(cookies: Cookies): Promise<number> {
	try {
		return (await POST(postArgs(cookies))).status;
	} catch (err) {
		const httpError = err as { status?: number };
		if (typeof httpError.status === 'number') return httpError.status;
		throw err;
	}
}

beforeEach(() => {
	mockedTokenRefresh.mockReset();
});

describe('POST /api/auth/refresh', () => {
	it('forwards the request-scoped fetch so handleFetch can rewrite to INTERNAL_API_URL (#883)', async () => {
		mockedTokenRefresh.mockResolvedValue({
			data: { access: 'new-access', refresh: 'new-refresh' },
			error: undefined
		} as never);

		const { cookies } = fakeCookies({ refresh_token: 'old-refresh' });
		const response = await POST(postArgs(cookies));

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ access: 'new-access' });
		// The generated client defaults to globalThis.fetch when `fetch` is
		// omitted, which bypasses handleFetch entirely — the bug in #883.
		expect(mockedTokenRefresh).toHaveBeenCalledWith(
			expect.objectContaining({ body: { refresh: 'old-refresh' }, fetch: requestFetch })
		);
	});

	it('stores the rotated refresh token and never returns it to the client', async () => {
		mockedTokenRefresh.mockResolvedValue({
			data: { access: 'new-access', refresh: 'new-refresh' },
			error: undefined
		} as never);

		const { cookies, jar } = fakeCookies({ refresh_token: 'old-refresh', remember_me: 'true' });
		const body = await (await POST(postArgs(cookies))).json();

		expect(jar.get('access_token')).toBe('new-access');
		expect(jar.get('refresh_token')).toBe('new-refresh');
		expect(body).not.toHaveProperty('refresh');
	});

	it('401s without calling the backend when there is no refresh cookie', async () => {
		const { cookies, deleted } = fakeCookies();

		expect(await postStatus(cookies)).toBe(401);
		expect(mockedTokenRefresh).not.toHaveBeenCalled();
		expect(deleted).toContain('access_token');
	});

	it('401s and clears both cookies when the backend rejects the refresh token', async () => {
		mockedTokenRefresh.mockResolvedValue({
			data: undefined,
			error: { detail: 'Token is blacklisted' }
		} as never);

		const { cookies, deleted } = fakeCookies({ refresh_token: 'blacklisted' });

		expect(await postStatus(cookies)).toBe(401);
		expect(deleted).toEqual(expect.arrayContaining(['refresh_token', 'access_token']));
	});

	it('clears the cookies when the refresh request throws (backend unreachable)', async () => {
		mockedTokenRefresh.mockRejectedValue(new Error('ECONNREFUSED'));

		const { cookies, deleted } = fakeCookies({ refresh_token: 'old-refresh' });

		expect(await postStatus(cookies)).toBe(500);
		expect(deleted).toEqual(expect.arrayContaining(['refresh_token', 'access_token']));
	});
});
