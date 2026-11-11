import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import type { accountResetPassword as AccountResetPassword } from '$lib/api/generated';

/** The SDK result contract; `error` is widened because a network failure carries a TypeError. */
type SdkResult = Awaited<ReturnType<typeof AccountResetPassword>>;
type MockResult = {
	data: SdkResult['data'];
	error: unknown;
	response: SdkResult['response'] | undefined;
};

const accountResetPassword = vi.hoisted(() => vi.fn());
vi.mock('$lib/api/generated', () => ({ accountResetPassword }));
vi.mock('$lib/server/tenant-canonical', () => ({
	resolveReturnTarget: vi.fn().mockResolvedValue(null)
}));
vi.mock('$lib/server/logger', () => ({ log: { error: vi.fn() } }));

import { actions } from './+page.server';

const cookies = { delete: vi.fn(), get: vi.fn(), set: vi.fn() };
const eventFetch = vi.fn();

function run(): ReturnType<typeof actions.resetPassword> {
	const body = new FormData();
	body.set('token', 'tok-123');
	body.set('password', 'Sup3r-secret-pass!');
	body.set('confirmPassword', 'Sup3r-secret-pass!');
	return actions.resetPassword({
		request: new Request('http://localhost/login/reset-password', { method: 'POST', body }),
		fetch: eventFetch,
		cookies
	} as unknown as Parameters<typeof actions.resetPassword>[0]);
}

/** The generated client RESOLVES (does not throw) on a 4xx/5xx (throwOnError: false). */
function resolvesWithError(status: number, error: unknown): void {
	accountResetPassword.mockResolvedValue({
		data: undefined,
		error,
		response: new Response(null, { status })
	} satisfies MockResult);
}

beforeEach(() => {
	accountResetPassword.mockReset();
	cookies.delete.mockReset();
});

describe('resetPassword when the API returns an error result (#1226)', () => {
	it('does not clear the session or report success for a rejected token (401)', async () => {
		resolvesWithError(401, { detail: 'Token expired' });
		const result = await run();
		expect(result).toMatchObject({
			status: 400,
			data: { errors: { form: m['serverErrors.public.resetTokenInvalid']() } }
		});
		expect(cookies.delete).not.toHaveBeenCalled();
	});

	it('shows the invalid copy for code invalid_token (400)', async () => {
		resolvesWithError(400, { detail: 'Invalid token.', code: 'invalid_token' });
		const result = await run();
		expect(result).toMatchObject({
			status: 400,
			data: { errors: { form: m['serverErrors.public.resetTokenInvalid']() }, tokenExpired: false }
		});
		expect(cookies.delete).not.toHaveBeenCalled();
	});

	it('shows the expired copy for code token_expired (400)', async () => {
		resolvesWithError(400, { detail: 'Token has expired.', code: 'token_expired' });
		expect(await run()).toMatchObject({
			status: 400,
			data: { errors: { form: m['serverErrors.public.resetTokenExpired']() }, tokenExpired: true }
		});
	});

	it('shows the backend detail for a code-less 400 (blacklisted token)', async () => {
		resolvesWithError(400, { detail: 'Token has been used.' });
		expect(await run()).toMatchObject({
			status: 400,
			data: { errors: { form: 'Token has been used.' }, tokenExpired: false }
		});
	});

	it('shows backend password-validator messages (__all__) under the password field', async () => {
		resolvesWithError(400, {
			errors: { __all__: ['This password is too common.', 'This password is entirely numeric.'] }
		});
		const result = await run();
		expect(result).toMatchObject({
			status: 400,
			data: {
				errors: { password: 'This password is too common. This password is entirely numeric.' }
			}
		});
		expect(cookies.delete).not.toHaveBeenCalled();
	});

	it('shows the backend detail for a banned account (403)', async () => {
		resolvesWithError(403, { detail: 'This account has been banned.' });
		const result = await run();
		expect(result).toMatchObject({
			status: 403,
			data: { errors: { form: 'This account has been banned.' } }
		});
		expect(cookies.delete).not.toHaveBeenCalled();
	});

	it('falls back to a generic failure for a 500 without clearing cookies', async () => {
		resolvesWithError(500, undefined);
		const result = await run();
		expect(result).toMatchObject({
			status: 500,
			data: { errors: { form: m['serverErrors.public.unexpectedErrorRetryLater']() } }
		});
		expect(cookies.delete).not.toHaveBeenCalled();
	});

	it('treats a resolved network error (no response) as a localized failure', async () => {
		accountResetPassword.mockResolvedValue({
			data: undefined,
			error: new TypeError('fetch failed'),
			response: undefined
		});
		const result = await run();
		expect(result).toMatchObject({
			status: 500,
			data: { errors: { form: m['serverErrors.public.unexpectedErrorRetryLater']() } }
		});
		expect(JSON.stringify(result)).not.toContain('fetch failed');
		expect(cookies.delete).not.toHaveBeenCalled();
	});

	it('clears the session cookies only after a 2xx', async () => {
		accountResetPassword.mockResolvedValue({
			data: { message: 'ok' },
			error: undefined,
			response: new Response(null, { status: 200 })
		});
		const result = await run();
		expect(result).toMatchObject({ success: true });
		expect(cookies.delete).toHaveBeenCalledTimes(3);
	});

	it('passes the event fetch to the SDK call', async () => {
		resolvesWithError(500, undefined);
		await run();
		expect(accountResetPassword.mock.calls[0][0].fetch).toBe(eventFetch);
	});
});
