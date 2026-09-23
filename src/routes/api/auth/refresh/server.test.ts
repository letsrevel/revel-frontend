import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Cookies } from '@sveltejs/kit';

vi.mock('$lib/api/generated', () => ({
	tokenRefresh: vi.fn()
}));

import { tokenRefresh } from '$lib/api/generated';
import { DELETE, POST } from './+server';

const mockedTokenRefresh = vi.mocked(tokenRefresh);

interface FakeCookies {
	cookies: Cookies;
	jar: Map<string, string>;
	deleted: string[];
}

/** A cookie jar that records writes so assertions can read them back. */
function fakeCookies(initial: Record<string, string> = {}): FakeCookies {
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

function postArgs(cookies: Cookies): Parameters<typeof POST>[0] {
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

	// #950: a rejection only proves THIS request's cookie was stale — another
	// request may already have rotated it — so the response must not delete.
	it('401s WITHOUT deleting cookies when the backend rejects the refresh token', async () => {
		mockedTokenRefresh.mockResolvedValue({
			data: undefined,
			error: { detail: 'Token is blacklisted' },
			response: { status: 401 }
		} as never);

		const { cookies, deleted } = fakeCookies({ refresh_token: 'blacklisted' });
		const response = await POST(postArgs(cookies));

		expect(response.status).toBe(401);
		expect(deleted).toEqual([]);
		const body = (await response.json()) as { rejected: string };
		// A fingerprint, never the token itself.
		expect(body.rejected).toMatch(/^[0-9a-f]{64}$/);
		expect(JSON.stringify(body)).not.toContain('blacklisted');
	});

	it('keeps the winner of two overlapping refreshes', async () => {
		// Two requests carried the same cookie; the first rotates it, the second
		// is rejected because that token is now blacklisted.
		mockedTokenRefresh
			.mockResolvedValueOnce({
				data: { access: 'new-access', refresh: 'new-refresh' },
				error: undefined
			} as never)
			.mockResolvedValueOnce({
				data: undefined,
				error: { detail: 'Token is blacklisted' },
				response: { status: 401 }
			} as never);

		const browser = fakeCookies({ refresh_token: 'old-refresh' });
		const winner = fakeCookies({ refresh_token: 'old-refresh' });
		const loser = fakeCookies({ refresh_token: 'old-refresh' });

		expect((await POST(postArgs(winner.cookies))).status).toBe(200);
		expect((await POST(postArgs(loser.cookies))).status).toBe(401);

		// Apply both responses' cookie writes to the browser, winner first.
		for (const [name, value] of winner.jar) browser.jar.set(name, value);
		for (const name of loser.deleted) browser.jar.delete(name);

		expect(loser.deleted).toEqual([]);
		expect(browser.jar.get('refresh_token')).toBe('new-refresh');
	});

	it('returns 502 with no fingerprint when the backend fails with a 5xx', async () => {
		mockedTokenRefresh.mockResolvedValue({
			data: undefined,
			error: { detail: 'Service Unavailable' },
			response: { status: 503 }
		} as never);

		const { cookies, deleted } = fakeCookies({ refresh_token: 'valid-refresh' });
		const response = await POST(postArgs(cookies));

		// Not a 401, so the client neither heals nor asks DELETE to clear it.
		expect(response.status).toBe(502);
		expect(await response.json()).not.toHaveProperty('rejected');
		expect(deleted).toEqual([]);
	});

	it('keeps the cookies when the refresh request throws (backend unreachable)', async () => {
		mockedTokenRefresh.mockRejectedValue(new Error('ECONNREFUSED'));

		const { cookies, deleted } = fakeCookies({ refresh_token: 'old-refresh' });

		expect(await postStatus(cookies)).toBe(500);
		expect(deleted).toEqual([]);
	});
});

describe('DELETE /api/auth/refresh', () => {
	async function rejectedFingerprintOf(token: string): Promise<string> {
		mockedTokenRefresh.mockResolvedValue({
			data: undefined,
			error: { detail: 'Token is blacklisted' },
			response: { status: 401 }
		} as never);
		const { cookies } = fakeCookies({ refresh_token: token });
		const response = await POST(postArgs(cookies));
		return ((await response.json()) as { rejected: string }).rejected;
	}

	function deleteArgs(cookies: Cookies, body: unknown): Parameters<typeof DELETE>[0] {
		const request = new Request('http://localhost/api/auth/refresh', {
			method: 'DELETE',
			body: JSON.stringify(body)
		});
		return { cookies, request } as unknown as Parameters<typeof DELETE>[0];
	}

	it('clears the cookies when the browser still holds the rejected token', async () => {
		const rejected = await rejectedFingerprintOf('dead-token');
		const { cookies, deleted } = fakeCookies({ refresh_token: 'dead-token' });

		const response = await DELETE(deleteArgs(cookies, { rejected }));

		expect(await response.json()).toEqual({ cleared: true });
		expect(deleted).toEqual(expect.arrayContaining(['refresh_token', 'access_token']));
	});

	it('keeps a refresh cookie that was rotated since the rejection', async () => {
		const rejected = await rejectedFingerprintOf('dead-token');
		const { cookies, deleted } = fakeCookies({ refresh_token: 'fresh-token' });

		const response = await DELETE(deleteArgs(cookies, { rejected }));

		expect(await response.json()).toEqual({ cleared: false });
		expect(deleted).toEqual([]);
	});

	it('ignores a request without a fingerprint', async () => {
		const { cookies, deleted } = fakeCookies({ refresh_token: 'token' });

		await DELETE(deleteArgs(cookies, {}));

		expect(deleted).toEqual([]);
	});
});
