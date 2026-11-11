import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as m from '$lib/paraglide/messages.js';

const accountResetPassword = vi.hoisted(() => vi.fn());
vi.mock('$lib/api/generated', () => ({ accountResetPassword }));
vi.mock('$lib/server/tenant-canonical', () => ({
	resolveReturnTarget: vi.fn().mockResolvedValue(null)
}));
vi.mock('$lib/server/logger', () => ({ log: { error: vi.fn() } }));

import { actions } from './+page.server';

const cookies = { delete: vi.fn(), get: vi.fn(), set: vi.fn() };

function run() {
	const body = new FormData();
	body.set('token', 'tok-123');
	body.set('password', 'Sup3r-secret-pass!');
	body.set('confirmPassword', 'Sup3r-secret-pass!');
	return actions.resetPassword({
		request: new Request('http://localhost/login/reset-password', { method: 'POST', body }),
		fetch: vi.fn(),
		cookies
	} as unknown as Parameters<typeof actions.resetPassword>[0]);
}

/** The generated client RESOLVES (does not throw) on a 4xx/5xx (throwOnError: false). */
function resolvesWithError(status: number, error: unknown) {
	accountResetPassword.mockResolvedValue({
		data: undefined,
		error,
		response: new Response(null, { status })
	});
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

	it('maps 400 field errors to the password field', async () => {
		resolvesWithError(400, { errors: { password1: ['Too common'] } });
		const result = await run();
		expect(result).toMatchObject({ status: 400, data: { errors: { password: 'Too common' } } });
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

	it('still reports a network throw as a failure', async () => {
		accountResetPassword.mockRejectedValue(new TypeError('fetch failed'));
		const result = await run();
		expect(result).toMatchObject({ status: 500 });
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
});
