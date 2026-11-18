import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Cookies } from '@sveltejs/kit';

vi.mock('$lib/api/client', () => ({
	authObtainToken: vi.fn(),
	authObtainTokenWithOtp: vi.fn(),
	accountResendVerificationEmail: vi.fn()
}));
vi.mock('$lib/server/token-claim', () => ({
	claimPendingTokens: vi.fn().mockResolvedValue({}),
	setClaimFlashCookie: vi.fn()
}));

import {
	accountResendVerificationEmail,
	authObtainToken,
	authObtainTokenWithOtp
} from '$lib/api/client';
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

describe('unverified email handling', () => {
	const refused = {
		response: { ok: false, status: 403 },
		error: { detail: 'translated text', code: 'email_not_verified' }
	};

	function event(fields: Record<string, string>, search = ''): ActionEvent {
		return {
			request: form(fields),
			fetch: vi.fn(),
			cookies: fakeCookies().cookies,
			url: new URL(`https://example.test/login${search}`),
			locals: {}
		} as unknown as ActionEvent;
	}

	it('login surfaces the unverified state on 403 email_not_verified', async () => {
		vi.mocked(authObtainToken).mockResolvedValue(refused as never);
		const result = await actions.login(event(credentials));
		expect(result).toMatchObject({
			status: 403,
			data: { emailNotVerified: true, email: credentials.email }
		});
	});

	it('login does not match on the translated detail text', async () => {
		vi.mocked(authObtainToken).mockResolvedValue({
			response: { ok: false, status: 403 },
			error: { detail: 'email_not_verified' }
		} as never);
		const result = await actions.login(event(credentials));
		expect(result).toMatchObject({ status: 400, data: { errors: { form: 'email_not_verified' } } });
	});

	it('login keeps the generic error for other failures', async () => {
		vi.mocked(authObtainToken).mockResolvedValue({
			response: { ok: false, status: 401 },
			error: { detail: 'Invalid credentials' }
		} as never);
		const result = await actions.login(event(credentials));
		expect(result).toMatchObject({
			status: 400,
			data: { errors: { form: 'Invalid credentials' }, email: credentials.email }
		});
		expect(JSON.stringify(result)).not.toContain('emailNotVerified');
	});

	it('verify2FA surfaces the unverified state on 403 email_not_verified', async () => {
		vi.mocked(authObtainTokenWithOtp).mockResolvedValue(refused as never);
		const result = await actions.verify2FA(
			event({ code: '123456', tempToken: 'temp', email: credentials.email })
		);
		expect(result).toMatchObject({
			status: 403,
			data: { emailNotVerified: true, email: credentials.email }
		});
	});

	it('verify2FA keeps the invalid-code error for other failures', async () => {
		vi.mocked(authObtainTokenWithOtp).mockResolvedValue({
			response: { ok: false, status: 400 },
			error: { detail: 'Bad code' }
		} as never);
		const result = await actions.verify2FA(event({ code: '123456', tempToken: 'temp' }));
		expect(result).toMatchObject({
			status: 400,
			data: { errors: { code: 'Bad code' }, requires2FA: true, tempToken: 'temp' }
		});
	});

	it('resendVerification posts the entered email and a safe returnUrl', async () => {
		vi.mocked(accountResendVerificationEmail).mockResolvedValue({
			response: { ok: true, status: 200 },
			data: 'Verification email sent.'
		} as never);
		const result = await actions.resendVerification(
			event({ email: ' a@example.com ' }, '?returnUrl=%2Fevents%2Fx')
		);
		expect(accountResendVerificationEmail).toHaveBeenCalledWith(
			expect.objectContaining({ body: { email: 'a@example.com', return_url: '/events/x' } })
		);
		expect(result).toMatchObject({ resendSent: true, emailNotVerified: true });
	});

	it('resendVerification drops an unsafe returnUrl', async () => {
		vi.mocked(accountResendVerificationEmail).mockResolvedValue({
			response: { ok: true, status: 200 },
			data: 'ok'
		} as never);
		await actions.resendVerification(
			event({ email: 'a@example.com' }, '?returnUrl=https%3A%2F%2Fevil.test')
		);
		expect(accountResendVerificationEmail).toHaveBeenCalledWith(
			expect.objectContaining({ body: { email: 'a@example.com' } })
		);
	});

	it('resendVerification reports a failed send', async () => {
		vi.mocked(accountResendVerificationEmail).mockResolvedValue({
			response: { ok: false, status: 422 },
			error: { detail: [] }
		} as never);
		const result = await actions.resendVerification(event({ email: 'a@example.com' }));
		expect(result).toMatchObject({ status: 400, data: { resendError: true } });
	});

	it('resendVerification refuses an empty email without calling the API', async () => {
		vi.mocked(accountResendVerificationEmail).mockReset();
		const result = await actions.resendVerification(event({ email: '' }));
		expect(accountResendVerificationEmail).not.toHaveBeenCalled();
		expect(result).toMatchObject({ status: 400, data: { resendError: true } });
	});
});
