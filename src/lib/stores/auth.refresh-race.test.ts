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

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
	vi.resetModules();
	fetchMock.mockReset();
	vi.stubGlobal('fetch', fetchMock);
	vi.mocked(accountMe).mockResolvedValue({ data: { id: 'u1' } } as never);
	vi.mocked(permissionMyPermissions).mockResolvedValue({ data: {} } as never);
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

// #950: the refresh that loses the rotation race must not end the session.
describe('authStore refresh race', () => {
	it('stays authenticated when the first refresh loses the rotation race', async () => {
		vi.useFakeTimers();
		const { authStore } = await import('./auth.svelte');
		const access = fakeJwt();
		fetchMock
			.mockResolvedValueOnce(jsonResponse(401, { message: 'x', rejected: 'fp-old' }))
			.mockResolvedValueOnce(jsonResponse(200, { access }));

		const refresh = authStore.refreshAccessToken();
		await vi.advanceTimersByTimeAsync(500);
		await refresh;

		expect(authStore.accessToken).toBe(access);
		expect(authStore.isAuthenticated).toBe(true);
		authStore.logout();
	});

	it('logs out when the retry is rejected as well', async () => {
		vi.useFakeTimers();
		const { authStore } = await import('./auth.svelte');
		fetchMock
			.mockResolvedValueOnce(jsonResponse(401, { message: 'x', rejected: 'fp' }))
			.mockResolvedValueOnce(jsonResponse(401, { message: 'x', rejected: 'fp' }))
			.mockResolvedValueOnce(jsonResponse(200, { cleared: true }));

		const refresh = authStore.refreshAccessToken();
		const outcome = expect(refresh).rejects.toThrow('401');
		await vi.advanceTimersByTimeAsync(500);
		await outcome;

		expect(authStore.isAuthenticated).toBe(false);
	});
});
