import { describe, it, expect, vi, beforeEach } from 'vitest';

const warning = vi.hoisted(() => vi.fn());
vi.mock('$lib/server/logger', () => ({ log: { debug: vi.fn(), warning, error: vi.fn() } }));

const tokenLogoutMock = vi.hoisted(() => vi.fn());
vi.mock('$lib/api/generated', () => ({ tokenLogout: tokenLogoutMock }));

import {
	clearAuthCookies,
	revokeAndClearSession,
	revokeRefreshToken,
	REVOKE_TIMEOUT_MS
} from './auth-cookies';

function makeEvent(refresh: string | null = 'RT') {
	const cookies = {
		get: vi.fn((name: string) => (name === 'refresh_token' ? (refresh ?? undefined) : undefined)),
		set: vi.fn(),
		delete: vi.fn()
	};
	const fetch = vi.fn();
	return { event: { cookies, fetch } as never, cookies, fetch };
}

describe('auth-cookies', () => {
	beforeEach(() => {
		tokenLogoutMock.mockReset();
		warning.mockReset();
		tokenLogoutMock.mockResolvedValue({ error: undefined, response: { status: 204 } });
	});

	it('revokes with the cookie value, the event fetch and a bounded signal', async () => {
		const { event, fetch } = makeEvent();
		await revokeRefreshToken(event);
		const arg = tokenLogoutMock.mock.calls[0][0];
		expect(arg.body).toEqual({ refresh: 'RT' });
		expect(arg.fetch).toBe(fetch);
		expect(arg.signal).toBeInstanceOf(AbortSignal);
		expect(REVOKE_TIMEOUT_MS).toBeLessThanOrEqual(5000);
	});

	it('does nothing without a refresh cookie', async () => {
		const { event } = makeEvent(null);
		await revokeRefreshToken(event);
		expect(tokenLogoutMock).not.toHaveBeenCalled();
	});

	it('logs at warn and resolves when the backend errors or throws', async () => {
		const { event } = makeEvent();
		tokenLogoutMock.mockResolvedValue({ error: { detail: 'x' }, response: { status: 500 } });
		await expect(revokeRefreshToken(event)).resolves.toBeUndefined();
		tokenLogoutMock.mockRejectedValue(new TypeError('fetch failed'));
		await expect(revokeRefreshToken(event)).resolves.toBeUndefined();
		expect(warning).toHaveBeenCalledTimes(2);
	});

	it('gives up on a hung backend and still clears the cookies (timeout path)', async () => {
		vi.useFakeTimers();
		try {
			tokenLogoutMock.mockImplementation(
				({ signal }: { signal: AbortSignal }) =>
					new Promise((_, reject) => {
						signal.addEventListener('abort', () => reject(signal.reason));
					})
			);
			const { event, cookies } = makeEvent();
			const done = revokeAndClearSession(event);
			await vi.advanceTimersByTimeAsync(REVOKE_TIMEOUT_MS + 10);
			await done;
			expect(warning).toHaveBeenCalledWith('logout_revoke_failed', expect.anything());
			expect(cookies.delete).toHaveBeenCalledTimes(3);
		} finally {
			vi.useRealTimers();
		}
	});

	it('revokes before it clears', async () => {
		const { event, cookies } = makeEvent();
		const order: string[] = [];
		tokenLogoutMock.mockImplementation(async () => {
			order.push('revoke');
			return { error: undefined, response: { status: 204 } };
		});
		cookies.delete.mockImplementation(() => order.push('delete'));
		await revokeAndClearSession(event);
		expect(order).toEqual(['revoke', 'delete', 'delete', 'delete']);
	});

	it('clearAuthCookies deletes access, refresh and remember_me', () => {
		const { cookies } = makeEvent();
		clearAuthCookies(cookies as never);
		expect(cookies.delete.mock.calls.map((c) => c[0])).toEqual([
			'access_token',
			'refresh_token',
			'remember_me'
		]);
	});
});
