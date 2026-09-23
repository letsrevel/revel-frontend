import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { REFRESH_LOCK_NAME, requestTokenRefresh, withRefreshLock } from './auth-refresh';

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});
}

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
	fetchMock.mockReset();
	vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

function methods(): (string | undefined)[] {
	return fetchMock.mock.calls.map(([, init]) => init?.method);
}

describe('requestTokenRefresh', () => {
	it('returns the first response when the refresh succeeds', async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse(200, { access: 'a' }));

		const response = await requestTokenRefresh(0);

		expect(response.status).toBe(200);
		expect(methods()).toEqual(['POST']);
	});

	// #950: a request that lost the rotation race 401s; by the retry the
	// winner's cookie has landed and the refresh succeeds.
	it('heals a lost rotation race with one retry', async () => {
		fetchMock
			.mockResolvedValueOnce(jsonResponse(401, { message: 'x', rejected: 'fp-old' }))
			.mockResolvedValueOnce(jsonResponse(200, { access: 'a' }));

		const response = await requestTokenRefresh(0);

		expect(response.status).toBe(200);
		// Nothing is cleared: the fresh cookie must survive.
		expect(methods()).toEqual(['POST', 'POST']);
	});

	it('asks the server to clear the cookie only after the retry is rejected too', async () => {
		fetchMock
			.mockResolvedValueOnce(jsonResponse(401, { message: 'x', rejected: 'fp-1' }))
			.mockResolvedValueOnce(jsonResponse(401, { message: 'x', rejected: 'fp-2' }))
			.mockResolvedValueOnce(jsonResponse(200, { cleared: true }));

		const response = await requestTokenRefresh(0);

		expect(response.status).toBe(401);
		expect(methods()).toEqual(['POST', 'POST', 'DELETE']);
		const [, init] = fetchMock.mock.calls[2];
		// The fingerprint of the token the RETRY carried — the browser's current one.
		expect(JSON.parse(String(init?.body))).toEqual({ rejected: 'fp-2' });
	});

	it('does not call DELETE when the 401 carries no fingerprint (no cookie at all)', async () => {
		fetchMock
			.mockResolvedValueOnce(jsonResponse(401, { message: 'No refresh token available' }))
			.mockResolvedValueOnce(jsonResponse(401, { message: 'No refresh token available' }));

		await requestTokenRefresh(0);

		expect(methods()).toEqual(['POST', 'POST']);
	});

	it('does not retry non-401 failures', async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse(500, { message: 'boom' }));

		const response = await requestTokenRefresh(0);

		expect(response.status).toBe(500);
		expect(methods()).toEqual(['POST']);
	});
});

describe('withRefreshLock', () => {
	it('runs under the cross-tab Web Lock when available', async () => {
		const request = vi.fn((_name: string, fn: () => Promise<unknown>) => fn());
		vi.stubGlobal('navigator', { locks: { request } });

		expect(await withRefreshLock(async () => 'done')).toBe('done');
		expect(request).toHaveBeenCalledWith(REFRESH_LOCK_NAME, expect.any(Function));
	});

	it('serialises concurrent refreshes that share the lock', async () => {
		// A minimal exclusive lock, standing in for navigator.locks across tabs.
		let tail: Promise<unknown> = Promise.resolve();
		const request = (_name: string, fn: () => Promise<unknown>): Promise<unknown> => {
			const run = tail.then(fn);
			tail = run.catch(() => undefined);
			return run;
		};
		vi.stubGlobal('navigator', { locks: { request } });

		const events: string[] = [];
		const job = (id: string) => async () => {
			events.push(`start ${id}`);
			await new Promise((r) => setTimeout(r, 5));
			events.push(`end ${id}`);
		};

		await Promise.all([withRefreshLock(job('a')), withRefreshLock(job('b'))]);

		expect(events).toEqual(['start a', 'end a', 'start b', 'end b']);
	});

	it('runs unlocked where the Web Locks API is unsupported', async () => {
		vi.stubGlobal('navigator', {});

		expect(await withRefreshLock(async () => 'done')).toBe('done');
	});
});
