import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/api/generated/sdk.gen', () => ({
	accountVerifyEmail: vi.fn()
}));
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

function loadArgs(search: string) {
	return {
		url: new URL(`http://localhost:5173/verify${search}`),
		request: new Request(`http://localhost:5173/verify${search}`),
		cookies: { set: vi.fn(), get: vi.fn(), delete: vi.fn() },
		fetch: vi.fn()
	} as unknown as Parameters<typeof load>[0];
}

async function loadRedirect(search: string): Promise<string> {
	try {
		await load(loadArgs(search));
	} catch (err) {
		const redirect = err as { status?: number; location?: string };
		if (redirect.status === 303 && typeof redirect.location === 'string') return redirect.location;
		throw err;
	}
	throw new Error('load() did not redirect');
}

beforeEach(() => {
	mockedVerify.mockReset();
	mockedVerify.mockResolvedValue({
		data: { user: { id: 'u' }, token: { access: 'acc', refresh: 'ref' } },
		error: undefined,
		response: { ok: true, status: 200 }
	} as never);
});

describe('/verify redirect target', () => {
	it('lands on the profile page when there is no returnUrl', async () => {
		expect(await loadRedirect('?token=t')).toBe('/account/profile');
	});

	it('follows a safe relative returnUrl', async () => {
		const target = '/oauth/authorize?client_id=x&resource=a&resource=b';
		expect(await loadRedirect(`?token=t&returnUrl=${encodeURIComponent(target)}`)).toBe(target);
	});

	it('treats the once-decoded /%2F%2Fevil as a harmless path, not //evil', async () => {
		expect(await loadRedirect('?token=t&returnUrl=%2F%252F%252Fevil')).toBe('/%2F%2Fevil');
	});

	it.each(['https://evil.com', '//evil.com', '/\\evil.com', 'javascript:alert(1)'])(
		'falls back to the profile page for %s',
		async (value) => {
			expect(await loadRedirect(`?token=t&returnUrl=${encodeURIComponent(value)}`)).toBe(
				'/account/profile'
			);
		}
	);

	it('does not redirect when verification fails', async () => {
		mockedVerify.mockResolvedValue({
			data: undefined,
			error: { detail: 'expired' },
			response: { ok: false, status: 400 }
		} as never);
		const result = await load(loadArgs('?token=t&returnUrl=%2Fx'));
		expect(result).toMatchObject({ success: false });
	});
});
