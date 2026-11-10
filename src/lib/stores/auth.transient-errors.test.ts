import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('$lib/api/client', () => ({
	authObtainToken: vi.fn(),
	authObtainTokenWithOtp: vi.fn(),
	accountMe: vi.fn(),
	permissionMyPermissions: vi.fn()
}));

import { accountMe, permissionMyPermissions } from '$lib/api/client';

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
		vi.mocked(accountMe)
			.mockRejectedValueOnce(new TypeError('Failed to fetch'))
			.mockResolvedValueOnce(okUser());

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

		await vi.advanceTimersByTimeAsync(2_000);
		expect(permissionMyPermissions).toHaveBeenCalledTimes(3); // one retry, not two
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
