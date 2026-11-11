import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as m from '$lib/paraglide/messages.js';

const accountDeleteAccountConfirm = vi.hoisted(() => vi.fn());
vi.mock('$lib/api/generated', () => ({ accountDeleteAccountConfirm }));
vi.mock('$lib/server/tenant-canonical', () => ({
	resolveReturnTarget: vi.fn().mockResolvedValue(null)
}));
vi.mock('$lib/server/logger', () => ({ log: { error: vi.fn() } }));

import { actions } from './+page.server';

const cookies = { delete: vi.fn() };

function run() {
	const body = new FormData();
	body.set('token', 'tok-123');
	return actions.confirmDeletion({
		request: new Request('http://localhost/account/confirm-deletion', { method: 'POST', body }),
		cookies,
		fetch: vi.fn()
	} as unknown as Parameters<typeof actions.confirmDeletion>[0]);
}

/** The generated client RESOLVES (does not throw) on a 4xx/5xx (throwOnError: false). */
function resolvesWithError(status: number, error: unknown) {
	accountDeleteAccountConfirm.mockResolvedValue({
		data: undefined,
		error,
		response: new Response(null, { status })
	});
}

beforeEach(() => {
	accountDeleteAccountConfirm.mockReset();
	cookies.delete.mockReset();
});

describe('confirmDeletion when the API returns an error result (#1226)', () => {
	it('does not clear cookies or report success for a rejected token (401)', async () => {
		resolvesWithError(401, { detail: 'Token expired' });
		const result = await run();
		expect(result).toMatchObject({
			status: 400,
			data: { errors: { form: m['serverErrors.public.deletionTokenInvalid']() } }
		});
		expect(cookies.delete).not.toHaveBeenCalled();
	});

	it('surfaces the backend detail for a blocked deletion (400)', async () => {
		resolvesWithError(400, { detail: 'You own organizations' });
		const result = await run();
		expect(result).toMatchObject({
			status: 400,
			data: { errors: { form: 'You own organizations' } }
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

	it('still reports a network throw as a failure', async () => {
		accountDeleteAccountConfirm.mockRejectedValue(new TypeError('fetch failed'));
		const result = await run();
		expect(result).toMatchObject({ status: 500 });
		expect(cookies.delete).not.toHaveBeenCalled();
	});

	it('clears the three auth cookies only after a 2xx', async () => {
		accountDeleteAccountConfirm.mockResolvedValue({
			data: { message: 'ok' },
			error: undefined,
			response: new Response(null, { status: 200 })
		});
		const result = await run();
		expect(result).toMatchObject({ success: true });
		expect(cookies.delete).toHaveBeenCalledTimes(3);
	});
});
