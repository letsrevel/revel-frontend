import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Cookies } from '@sveltejs/kit';

vi.mock('$lib/api/generated', () => ({ tokenRefresh: vi.fn() }));

import { tokenRefresh } from '$lib/api/generated';
import { REPLAY_WINDOW_MS, resetRefreshRotation, rotateRefreshToken } from './refresh-rotation';
import { POST } from '../../routes/api/auth/refresh/+server';

const mockedRefresh = vi.mocked(tokenRefresh);
const fetchFn = vi.fn() as unknown as typeof fetch;

function ok(access: string, refresh: string): never {
	return { data: { access, refresh }, error: undefined, response: { status: 200 } } as never;
}
function blacklisted(): never {
	return { data: undefined, error: { detail: 'blacklisted' }, response: { status: 401 } } as never;
}

beforeEach(() => {
	resetRefreshRotation();
	mockedRefresh.mockReset();
});
afterEach(() => {
	vi.useRealTimers();
});

describe('rotateRefreshToken (#1191)', () => {
	it('two refreshes in flight with the same token share one backend rotation', async () => {
		let resolve!: (v: never) => void;
		mockedRefresh.mockReturnValue(new Promise((r) => (resolve = r)) as never);

		const a = rotateRefreshToken('R1', fetchFn);
		const b = rotateRefreshToken('R1', fetchFn);
		resolve(ok('A2', 'R2'));

		expect((await a).data?.refresh).toBe('R2');
		expect((await b).data?.refresh).toBe('R2');
		expect(mockedRefresh).toHaveBeenCalledTimes(1);
	});

	it('a reload (SSR refresh) arriving after the client rotation gets R2, not a replay of R1', async () => {
		// The backend blacklists R1 after the first use, as SimpleJWT does.
		mockedRefresh.mockResolvedValueOnce(ok('A2', 'R2')).mockResolvedValue(blacklisted());

		await rotateRefreshToken('R1', fetchFn); // client refresh, its response lost on unload
		const ssr = await rotateRefreshToken('R1', fetchFn); // hooks.server.ts on the reload

		expect(ssr.data?.refresh).toBe('R2');
		expect(mockedRefresh).toHaveBeenCalledTimes(1);
	});

	it('reload mid-refresh: endpoint pending while the SSR hook refreshes the same cookie', async () => {
		let resolve!: (v: never) => void;
		mockedRefresh.mockReturnValue(new Promise((r) => (resolve = r)) as never);
		const jar = new Map([['refresh_token', 'R1']]);
		const cookies = {
			get: (n: string) => jar.get(n),
			set: (n: string, v: string) => void jar.set(n, v),
			delete: (n: string) => void jar.delete(n)
		} as unknown as Cookies;

		const endpoint = POST({ cookies, fetch: fetchFn, locals: {} } as never);
		const ssr = rotateRefreshToken('R1', fetchFn);
		resolve(ok('A2', 'R2'));

		expect((await endpoint).status).toBe(200);
		expect((await ssr).data?.refresh).toBe('R2');
		expect(jar.get('refresh_token')).toBe('R2');
		expect(mockedRefresh).toHaveBeenCalledTimes(1);
	});

	it('never remembers a failure: a dead token is retried against the backend', async () => {
		mockedRefresh.mockResolvedValue(blacklisted());
		await rotateRefreshToken('dead', fetchFn);
		await rotateRefreshToken('dead', fetchFn);
		expect(mockedRefresh).toHaveBeenCalledTimes(2);
	});

	it('forgets a success after the replay window', async () => {
		vi.useFakeTimers();
		mockedRefresh.mockResolvedValue(ok('A2', 'R2'));
		await rotateRefreshToken('R1', fetchFn);
		await vi.advanceTimersByTimeAsync(REPLAY_WINDOW_MS + 1);
		await rotateRefreshToken('R1', fetchFn);
		expect(mockedRefresh).toHaveBeenCalledTimes(2);
	});

	it('keys on the token: a different cookie rotates independently', async () => {
		mockedRefresh.mockResolvedValue(ok('A', 'R'));
		await rotateRefreshToken('R1', fetchFn);
		await rotateRefreshToken('other', fetchFn);
		expect(mockedRefresh).toHaveBeenCalledTimes(2);
	});
});
