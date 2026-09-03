import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Cookies } from '@sveltejs/kit';

vi.mock('$lib/server/token-claim', () => ({
	claimPendingTokens: vi.fn().mockResolvedValue({}),
	setClaimFlashCookie: vi.fn()
}));

import { claimPendingTokens, setClaimFlashCookie } from '$lib/server/token-claim';
import { establishSession } from './session';

function fakeCookies() {
	const jar = new Map<string, { value: string; options: Record<string, unknown> }>();
	return {
		cookies: {
			set: vi.fn((name: string, value: string, options: Record<string, unknown>) => {
				jar.set(name, { value, options });
			})
		} as unknown as Cookies,
		jar
	};
}

const fakeFetch = vi.fn() as unknown as typeof fetch;
const tokens = { access: 'acc-token', refresh: 'ref-token' };

beforeEach(() => {
	vi.mocked(claimPendingTokens).mockClear();
	vi.mocked(setClaimFlashCookie).mockClear();
});

describe('establishSession', () => {
	it('sets the three auth cookies (persistent when rememberMe)', async () => {
		const { cookies, jar } = fakeCookies();
		await establishSession(cookies, tokens, true, fakeFetch);

		expect(jar.get('access_token')?.value).toBe('acc-token');
		expect(jar.get('refresh_token')?.value).toBe('ref-token');
		expect(jar.get('refresh_token')?.options.maxAge).toBe(60 * 60 * 24 * 30);
		expect(jar.get('remember_me')?.value).toBe('true');
	});

	it('uses a session refresh cookie when rememberMe is false', async () => {
		const { cookies, jar } = fakeCookies();
		await establishSession(cookies, tokens, false, fakeFetch);

		expect(jar.get('refresh_token')?.options.maxAge).toBeUndefined();
		expect(jar.get('remember_me')?.value).toBe('false');
	});

	it('claims pending invitation tokens with the fresh access token', async () => {
		const { cookies } = fakeCookies();
		const results = { organization: { success: true, name: 'Org' } };
		vi.mocked(claimPendingTokens).mockResolvedValueOnce(results);

		await establishSession(cookies, tokens, true, fakeFetch);

		expect(claimPendingTokens).toHaveBeenCalledWith(cookies, 'acc-token', fakeFetch);
		expect(setClaimFlashCookie).toHaveBeenCalledWith(cookies, results);
	});
});
