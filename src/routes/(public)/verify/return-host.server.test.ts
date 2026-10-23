import { describe, it, expect, vi, beforeEach } from 'vitest';

const resolveReturnHost = vi.hoisted(() => vi.fn());
vi.mock('$lib/server/tenant-canonical', () => ({ resolveReturnHost }));
vi.mock('$lib/api/generated/sdk.gen', () => ({ accountVerifyEmail: vi.fn() }));
vi.mock('$lib/utils/cookies', () => ({
	getAccessTokenCookieOptions: () => ({ path: '/' }),
	getRefreshTokenCookieOptions: () => ({ path: '/' })
}));
vi.mock('$lib/server/token-claim', () => ({
	claimPendingTokens: vi.fn().mockResolvedValue([]),
	setClaimFlashCookie: vi.fn()
}));
vi.mock('$lib/server/logger', () => ({
	log: { debug: vi.fn(), warning: vi.fn(), error: vi.fn() }
}));
vi.mock('$lib/seo', () => ({ buildSeo: () => ({}) }));
vi.mock('$lib/seo/server', () => ({ resolveLang: () => 'en' }));

import { accountVerifyEmail } from '$lib/api/generated/sdk.gen';
import { load } from './+page.server';

const mockedVerify = vi.mocked(accountVerifyEmail);
const fetchFn = vi.fn();

function loadArgs(search: string) {
	return {
		url: new URL(`http://localhost:5173/verify${search}`),
		request: new Request(`http://localhost:5173/verify${search}`),
		cookies: { set: vi.fn(), get: vi.fn(), delete: vi.fn() },
		fetch: fetchFn,
		locals: { tenant: null }
	} as unknown as Parameters<typeof load>[0];
}

async function outcome(search: string): Promise<string | object> {
	try {
		return await load(loadArgs(search));
	} catch (err) {
		const r = err as { status?: number; location?: string };
		if (r.status === 303 && typeof r.location === 'string') return r.location;
		throw err;
	}
}

beforeEach(() => {
	resolveReturnHost.mockReset();
	mockedVerify.mockReset();
	mockedVerify.mockResolvedValue({
		data: { user: { id: 'u' }, token: { access: 'acc', refresh: 'ref' } },
		error: undefined,
		response: { ok: true, status: 200 }
	} as never);
});

describe('/verify return_host (#1070)', () => {
	it('redirects to exactly {origin}/login, with no token or query', async () => {
		resolveReturnHost.mockResolvedValue('https://events.acme.org');
		const target = await outcome('?token=SECRET&returnUrl=%2Fx&return_host=events.acme.org');
		expect(target).toBe('https://events.acme.org/login');
		expect(resolveReturnHost).toHaveBeenCalledWith('events.acme.org', fetchFn);
	});

	it('keeps today behavior for an invalid return_host', async () => {
		resolveReturnHost.mockResolvedValue(null);
		expect(await outcome('?token=t&return_host=evil.com%2Fx')).toBe('/account/profile');
		expect(await outcome('?token=t&returnUrl=%2Fx&return_host=a%40b')).toBe('/x');
	});

	it('does not redirect (or validate) when verification fails', async () => {
		mockedVerify.mockResolvedValue({
			data: undefined,
			error: { detail: 'expired' },
			response: { ok: false, status: 400 }
		} as never);
		resolveReturnHost.mockResolvedValue('https://events.acme.org');
		expect(await outcome('?token=t&return_host=events.acme.org')).toMatchObject({
			success: false
		});
		expect(resolveReturnHost).not.toHaveBeenCalled();
	});
});
