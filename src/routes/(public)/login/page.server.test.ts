import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Cookies } from '@sveltejs/kit';

vi.mock('$lib/api/client', () => ({
	authObtainToken: vi.fn(),
	authObtainTokenWithOtp: vi.fn()
}));
vi.mock('$lib/server/token-claim', () => ({
	claimPendingTokens: vi.fn().mockResolvedValue({}),
	setClaimFlashCookie: vi.fn()
}));

import { authObtainToken, authObtainTokenWithOtp } from '$lib/api/client';
import { actions } from './+page.server';

function fakeCookies() {
	const options = new Map<string, Record<string, unknown>>();
	const values = new Map<string, string>();
	const cookies = {
		set: vi.fn((name: string, value: string, opts: Record<string, unknown>) => {
			values.set(name, value);
			options.set(name, opts);
		})
	} as unknown as Cookies;
	return { cookies, options, values };
}

function form(fields: Record<string, string>): Request {
	const body = new URLSearchParams(fields);
	return new Request('https://example.test/login', { method: 'POST', body });
}

type ActionEvent = Parameters<typeof actions.login>[0];

async function run(
	action: 'login' | 'verify2FA',
	fields: Record<string, string>,
	tenant?: unknown
): Promise<{ options: Map<string, Record<string, unknown>>; values: Map<string, string> }> {
	const { cookies, options, values } = fakeCookies();
	const event = {
		request: form(fields),
		fetch: vi.fn(),
		cookies,
		url: new URL('https://example.test/login'),
		locals: { tenant }
	} as unknown as ActionEvent;
	try {
		await actions[action](event);
	} catch (err) {
		// establishSession is followed by a redirect; anything else is a real failure.
		if ((err as { status?: number }).status !== 303) throw err;
	}
	return { options, values };
}

const credentials = { email: 'a@example.com', password: 'hunter2hunter2' };

beforeEach(() => {
	vi.mocked(authObtainToken).mockReset();
	vi.mocked(authObtainTokenWithOtp).mockReset();
	vi.mocked(authObtainToken).mockResolvedValue({
		response: { ok: true },
		data: { access: 'acc', refresh: 'ref' }
	} as never);
	vi.mocked(authObtainTokenWithOtp).mockResolvedValue({
		response: { ok: true },
		data: { access: 'acc', refresh: 'ref' }
	} as never);
});

describe('login action session lifetime', () => {
	it('persists the refresh cookie on the platform host when "remember me" is ticked', async () => {
		const { options, values } = await run('login', { ...credentials, rememberMe: 'on' });
		expect(options.get('refresh_token')?.maxAge).toBe(60 * 60 * 24 * 30);
		expect(values.get('remember_me')).toBe('true');
	});

	it('never persists the session on a tenant host, even with "remember me"', async () => {
		const { options, values } = await run(
			'login',
			{ ...credentials, rememberMe: 'on' },
			{ slug: 'acme' }
		);
		expect(options.get('refresh_token')?.maxAge).toBeUndefined();
		expect(values.get('remember_me')).toBe('false');
	});
});

describe('verify2FA action session lifetime', () => {
	const otp = { code: '123456', tempToken: 'temp', rememberMe: 'true' };

	it('persists the refresh cookie on the platform host', async () => {
		const { options, values } = await run('verify2FA', otp);
		expect(options.get('refresh_token')?.maxAge).toBe(60 * 60 * 24 * 30);
		expect(values.get('remember_me')).toBe('true');
	});

	it('never persists the session on a tenant host', async () => {
		const { options, values } = await run('verify2FA', otp, { slug: 'acme' });
		expect(options.get('refresh_token')?.maxAge).toBeUndefined();
		expect(values.get('remember_me')).toBe('false');
	});
});
