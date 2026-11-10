import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('$lib/api/client', () => ({
	authObtainToken: vi.fn(),
	authObtainTokenWithOtp: vi.fn(),
	accountMe: vi.fn(),
	permissionMyPermissions: vi.fn()
}));

import {
	accountMe,
	authObtainToken,
	authObtainTokenWithOtp,
	permissionMyPermissions
} from '$lib/api/client';

function fakeJwt(): string {
	const payload = btoa(
		JSON.stringify({ user_id: 'u1', exp: Math.floor(Date.now() / 1000) + 3600 })
	);
	return `header.${payload}.sig`;
}

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});
}

/** What hey-api returns for a failed call: the body as `error`, status on `response`. */
function failure(status: number, headers?: Record<string, string>): never {
	return {
		error: { detail: `status ${status}` },
		response: new Response(null, { status, headers })
	} as never;
}

/** hey-api's shape for a fetch failure (throwOnError false). */
function networkFailure(): never {
	return {
		error: new TypeError('Failed to fetch'),
		response: undefined,
		data: undefined
	} as never;
}

const USER = { id: 'u1' };
const PERMS = { organization_permissions: {} };
const okUser = (): never => ({ data: USER }) as never;
const okPerms = (): never => ({ data: PERMS }) as never;

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
	vi.resetModules();
	vi.useFakeTimers();
	fetchMock.mockReset();
	vi.stubGlobal('fetch', fetchMock);
	vi.mocked(authObtainToken).mockReset();
	vi.mocked(authObtainTokenWithOtp).mockReset();
	vi.mocked(accountMe).mockReset().mockResolvedValue(okUser());
	vi.mocked(permissionMyPermissions).mockReset().mockResolvedValue(okPerms());
	vi.spyOn(console, 'error').mockImplementation(() => undefined);
	vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

async function loadStore() {
	const { authStore } = await import('./auth.svelte');
	return authStore;
}

// #1207: a successful refresh followed by a throttled / failing user or
// permissions fetch must not end the session.
describe('authStore transient user/permission fetch failures (#1207)', () => {
	it('keeps the session on a permissions 429 and retries after Retry-After', async () => {
		const store = await loadStore();
		const access = fakeJwt();
		fetchMock.mockResolvedValueOnce(jsonResponse(200, { access }));
		vi.mocked(permissionMyPermissions)
			.mockResolvedValueOnce(failure(429, { 'Retry-After': '3' }))
			.mockResolvedValueOnce(okPerms());

		await store.refreshAccessToken(); // resolves: the token is valid

		expect(store.accessToken).toBe(access);
		expect(store.isAuthenticated).toBe(true);
		expect(store.user).toEqual(USER);
		expect(store.permissions).toBeNull();
		expect(permissionMyPermissions).toHaveBeenCalledTimes(1);

		await vi.advanceTimersByTimeAsync(2_900);
		expect(permissionMyPermissions).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(200);
		expect(permissionMyPermissions).toHaveBeenCalledTimes(2);
		expect(store.permissions).toEqual(PERMS);
		expect(store.accessToken).toBe(access);
		// The user was already loaded: it is not refetched.
		expect(accountMe).toHaveBeenCalledTimes(1);
		store.logout();
	});

	it('keeps the session on a permissions 503 and retries with backoff', async () => {
		const store = await loadStore();
		const access = fakeJwt();
		fetchMock.mockResolvedValueOnce(jsonResponse(200, { access }));
		vi.mocked(permissionMyPermissions)
			.mockResolvedValueOnce(failure(503))
			.mockResolvedValueOnce(failure(503))
			.mockResolvedValueOnce(okPerms());

		await store.refreshAccessToken();
		expect(store.isAuthenticated).toBe(true);
		expect(store.permissions).toBeNull();

		await vi.advanceTimersByTimeAsync(2_000); // first backoff step
		expect(permissionMyPermissions).toHaveBeenCalledTimes(2);
		expect(store.permissions).toBeNull();
		expect(store.isAuthenticated).toBe(true);

		await vi.advanceTimersByTimeAsync(5_000); // second backoff step
		expect(permissionMyPermissions).toHaveBeenCalledTimes(3);
		expect(store.permissions).toEqual(PERMS);
		store.logout();
	});

	it('keeps the session on a user fetch network error and retries', async () => {
		const store = await loadStore();
		const access = fakeJwt();
		fetchMock.mockResolvedValueOnce(jsonResponse(200, { access }));
		// The real hey-api client never rejects: it RETURNS the error, no response.
		vi.mocked(accountMe).mockResolvedValueOnce(networkFailure()).mockResolvedValueOnce(okUser());

		await store.refreshAccessToken();
		expect(store.isAuthenticated).toBe(true);
		expect(store.user).toBeNull();

		await vi.advanceTimersByTimeAsync(2_000);
		expect(store.user).toEqual(USER);
		expect(store.permissions).toEqual(PERMS);
		store.logout();
	});

	it('logs out when the user fetch returns 401 after a successful refresh', async () => {
		const store = await loadStore();
		fetchMock.mockResolvedValueOnce(jsonResponse(200, { access: fakeJwt() }));
		vi.mocked(accountMe).mockResolvedValueOnce(failure(401));

		await expect(store.refreshAccessToken()).rejects.toThrow();

		expect(store.accessToken).toBeNull();
		expect(store.isAuthenticated).toBe(false);
		await vi.advanceTimersByTimeAsync(120_000);
		expect(accountMe).toHaveBeenCalledTimes(1); // no retry scheduled
	});

	it('logs out when the refresh response is not OK', async () => {
		const store = await loadStore();
		fetchMock.mockResolvedValueOnce(jsonResponse(500, { message: 'boom' }));

		await expect(store.refreshAccessToken()).rejects.toThrow('500');

		expect(store.accessToken).toBeNull();
		expect(store.isAuthenticated).toBe(false);
		expect(accountMe).not.toHaveBeenCalled();
	});

	it('cancels a pending retry when logout() runs', async () => {
		const store = await loadStore();
		fetchMock.mockResolvedValueOnce(jsonResponse(200, { access: fakeJwt() }));
		vi.mocked(permissionMyPermissions).mockResolvedValueOnce(failure(429, { 'Retry-After': '3' }));

		await store.refreshAccessToken();
		expect(permissionMyPermissions).toHaveBeenCalledTimes(1);

		store.logout();
		await vi.advanceTimersByTimeAsync(120_000);

		expect(permissionMyPermissions).toHaveBeenCalledTimes(1);
		expect(store.accessToken).toBeNull();
		expect(store.permissions).toBeNull();
	});

	it('never stacks retries: a second transient failure replaces the pending timer', async () => {
		const store = await loadStore();
		const access = fakeJwt();
		fetchMock.mockImplementation(async () => jsonResponse(200, { access }));
		vi.mocked(permissionMyPermissions).mockImplementation(async () => failure(503));

		await store.refreshAccessToken();
		await store.refreshAccessToken();
		expect(permissionMyPermissions).toHaveBeenCalledTimes(2);

		// Second failure moved to the next rung (5s); the 2s timer was replaced.
		await vi.advanceTimersByTimeAsync(4_900);
		expect(permissionMyPermissions).toHaveBeenCalledTimes(2);
		await vi.advanceTimersByTimeAsync(200);
		expect(permissionMyPermissions).toHaveBeenCalledTimes(3); // one retry, not two
		store.logout();
	});

	it('a bare TypeError (programming bug) is not retried: refresh rejects and logs out', async () => {
		const store = await loadStore();
		fetchMock.mockResolvedValueOnce(jsonResponse(200, { access: fakeJwt() }));
		vi.mocked(accountMe).mockRejectedValueOnce(new TypeError('x is not a function'));

		await expect(store.refreshAccessToken()).rejects.toThrow('x is not a function');

		expect(store.isAuthenticated).toBe(false);
		await vi.advanceTimersByTimeAsync(120_000);
		expect(accountMe).toHaveBeenCalledTimes(1);
	});

	it('resetForSwap() cancels a pending retry and resets the ladder', async () => {
		const store = await loadStore();
		fetchMock.mockImplementation(async () => jsonResponse(200, { access: fakeJwt() }));
		vi.mocked(permissionMyPermissions).mockImplementation(async () => failure(503));

		await store.refreshAccessToken(); // ladder at rung 1 (2s pending)
		store.resetForSwap();
		// A new identity's token lands; the old identity's retry must not fire for it.
		store.setAccessToken(fakeJwt());
		await vi.advanceTimersByTimeAsync(10_000);
		expect(permissionMyPermissions).toHaveBeenCalledTimes(1);

		// New identity starts the ladder over at 2s (not 5s).
		vi.mocked(permissionMyPermissions).mockResolvedValue(okPerms());
		vi.mocked(permissionMyPermissions).mockResolvedValueOnce(failure(503));
		await store.refreshAccessToken();
		await vi.advanceTimersByTimeAsync(2_000);
		expect(store.permissions).toEqual(PERMS);
		store.logout();
	});

	it('walks the ladder across failures and keeps retrying at 60s without a cap', async () => {
		const store = await loadStore();
		fetchMock.mockResolvedValueOnce(jsonResponse(200, { access: fakeJwt() }));
		vi.mocked(permissionMyPermissions).mockImplementation(async () => failure(503));

		await store.refreshAccessToken(); // initial call
		let calls = 1;
		for (const delay of [2_000, 5_000, 15_000, 30_000, 60_000, 60_000, 60_000, 60_000]) {
			await vi.advanceTimersByTimeAsync(delay - 100);
			expect(permissionMyPermissions).toHaveBeenCalledTimes(calls);
			await vi.advanceTimersByTimeAsync(100);
			calls++;
			expect(permissionMyPermissions).toHaveBeenCalledTimes(calls);
		}
		expect(store.isAuthenticated).toBe(true);

		vi.mocked(permissionMyPermissions).mockImplementation(async () => okPerms());
		await vi.advanceTimersByTimeAsync(60_000);
		expect(store.permissions).toEqual(PERMS);
		store.logout();
	});

	it('single-flights hydration: a refresh while a fetch is in flight reuses it', async () => {
		const store = await loadStore();
		fetchMock.mockImplementation(async () => jsonResponse(200, { access: fakeJwt() }));
		let release: () => void = () => undefined;
		vi.mocked(permissionMyPermissions).mockImplementationOnce(
			() => new Promise((resolve) => (release = () => resolve(okPerms()))) as never
		);
		store.setAccessToken(fakeJwt());

		const init = store.initialize();
		await vi.advanceTimersByTimeAsync(0);
		const refresh = store.refreshAccessToken();
		await vi.advanceTimersByTimeAsync(0);
		release();
		await Promise.all([init, refresh]);

		expect(accountMe).toHaveBeenCalledTimes(1);
		expect(permissionMyPermissions).toHaveBeenCalledTimes(1);
		store.logout();
	});

	it('floors Retry-After: 0 at one second', async () => {
		const store = await loadStore();
		fetchMock.mockResolvedValueOnce(jsonResponse(200, { access: fakeJwt() }));
		vi.mocked(permissionMyPermissions)
			.mockResolvedValueOnce(failure(429, { 'Retry-After': '0' }))
			.mockResolvedValueOnce(okPerms());

		await store.refreshAccessToken();
		await vi.advanceTimersByTimeAsync(900);
		expect(permissionMyPermissions).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(200);
		expect(store.permissions).toEqual(PERMS);
		store.logout();
	});

	it('login(): a permissions 429 still succeeds, keeps the token, and retries', async () => {
		const store = await loadStore();
		const access = fakeJwt();
		vi.mocked(authObtainToken).mockResolvedValueOnce({ data: { access } } as never);
		vi.mocked(permissionMyPermissions)
			.mockResolvedValueOnce(failure(429, { 'Retry-After': '3' }))
			.mockResolvedValueOnce(okPerms());

		await store.login('a@b.c', 'pw');

		expect(store.accessToken).toBe(access);
		expect(store.permissions).toBeNull();
		await vi.advanceTimersByTimeAsync(3_000);
		expect(store.permissions).toEqual(PERMS);
		store.logout();
	});

	it('login(): a 401 on the user fetch still rejects the login', async () => {
		const store = await loadStore();
		vi.mocked(authObtainToken).mockResolvedValueOnce({ data: { access: fakeJwt() } } as never);
		vi.mocked(accountMe).mockResolvedValueOnce(failure(401));

		await expect(store.login('a@b.c', 'pw')).rejects.toThrow();
	});

	it('loginWithOTP(): a user fetch 503 still succeeds and retries', async () => {
		const store = await loadStore();
		vi.mocked(authObtainTokenWithOtp).mockResolvedValueOnce({
			data: { access: fakeJwt() }
		} as never);
		vi.mocked(accountMe).mockResolvedValueOnce(failure(503)).mockResolvedValueOnce(okUser());

		await store.loginWithOTP('temp', '123456');

		expect(store.isAuthenticated).toBe(true);
		await vi.advanceTimersByTimeAsync(2_000);
		expect(store.user).toEqual(USER);
		store.logout();
	});

	it('initialize(): a transient permissions failure does not log out and retries', async () => {
		const store = await loadStore();
		const access = fakeJwt();
		store.setAccessToken(access);
		vi.mocked(permissionMyPermissions)
			.mockResolvedValueOnce(failure(429, { 'Retry-After': '3' }))
			.mockResolvedValueOnce(okPerms());

		await store.initialize();

		expect(store.accessToken).toBe(access);
		expect(store.isAuthenticated).toBe(true);
		expect(store.user).toEqual(USER);
		expect(store.permissions).toBeNull();

		await vi.advanceTimersByTimeAsync(3_000);
		expect(store.permissions).toEqual(PERMS);
		store.logout();
	});

	it('initialize(): a 401 on the user fetch still logs out', async () => {
		const store = await loadStore();
		store.setAccessToken(fakeJwt());
		vi.mocked(accountMe).mockResolvedValueOnce(failure(401));

		await store.initialize();

		expect(store.accessToken).toBeNull();
		expect(store.isAuthenticated).toBe(false);
	});
});
