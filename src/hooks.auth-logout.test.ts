import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$env/dynamic/private', () => ({ env: {} }));
vi.mock('$lib/config/api', () => ({ API_BASE_URL: 'https://api.example.com' }));
vi.mock('$lib/server/metrics', () => ({ startMetricsServer: vi.fn() }));

const tokenRefreshMock = vi.hoisted(() => vi.fn());
vi.mock('$lib/api/generated', () => ({ tokenRefresh: tokenRefreshMock }));

import { handleAuth } from './hooks.server';

function run(method: string, pathname: string) {
	const cookies = {
		get: vi.fn((name: string) =>
			name === 'refresh_token' ? 'RT-original' : name === 'access_token' ? 'not-a-jwt' : undefined
		),
		set: vi.fn(),
		delete: vi.fn()
	};
	const resolve = vi.fn(async () => new Response('ok'));
	return {
		cookies,
		promise: handleAuth({
			event: {
				cookies,
				locals: {},
				request: new Request(`http://localhost:5173${pathname}`, { method }),
				url: new URL(`http://localhost:5173${pathname}`),
				params: {},
				fetch: vi.fn()
			},
			resolve
		} as unknown as Parameters<typeof handleAuth>[0])
	};
}

describe('handleAuth: POST /logout', () => {
	beforeEach(() => {
		tokenRefreshMock.mockReset();
		tokenRefreshMock.mockResolvedValue({ data: undefined, error: { detail: 'x' } });
	});

	it('does not rotate the refresh token and leaves the original cookie alone', async () => {
		const { cookies, promise } = run('POST', '/logout');
		await promise;
		expect(tokenRefreshMock).not.toHaveBeenCalled();
		expect(cookies.set).not.toHaveBeenCalled();
		expect(cookies.delete).not.toHaveBeenCalled();
	});

	it('still refreshes on a GET /logout and on other POSTs', async () => {
		await run('GET', '/logout').promise;
		await run('POST', '/login').promise;
		expect(tokenRefreshMock).toHaveBeenCalledTimes(2);
	});
});
