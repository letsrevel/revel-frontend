import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as m from '$lib/paraglide/messages.js';

const accountResetPasswordRequest = vi.hoisted(() => vi.fn());
vi.mock('$lib/api/generated', () => ({ accountResetPasswordRequest }));
vi.mock('$lib/server/logger', () => ({ log: { error: vi.fn() } }));

import { actions } from './+page.server';

function run() {
	const body = new FormData();
	body.set('email', 'someone@example.com');
	return actions.resetRequest({
		request: new Request('http://localhost/password-reset', { method: 'POST', body }),
		fetch: vi.fn()
	} as unknown as Parameters<typeof actions.resetRequest>[0]);
}

function resolvesWith(status: number, error?: unknown) {
	accountResetPasswordRequest.mockResolvedValue({
		data: error === undefined ? { message: 'ok' } : undefined,
		error,
		response: new Response(null, { status })
	});
}

beforeEach(() => accountResetPasswordRequest.mockReset());

describe('resetRequest', () => {
	it('surfaces a 429 throttle with the localized rate-limit message', async () => {
		resolvesWith(429, { detail: 'Request was throttled.' });
		const result = await run();
		expect(result).toMatchObject({
			status: 429,
			data: { errors: { form: m['serverErrors.public.resetRequestRateLimited']() } }
		});
		expect(result).not.toHaveProperty('data.success');
	});

	it('keeps the enumeration-safe success for other failures', async () => {
		resolvesWith(404, { detail: 'Not found.' });
		expect(await run()).toEqual({ success: true, email: 'someone@example.com' });
	});

	it('keeps the enumeration-safe success on a network error', async () => {
		accountResetPasswordRequest.mockResolvedValue({
			data: undefined,
			error: new TypeError('fetch failed'),
			response: undefined
		});
		expect(await run()).toEqual({ success: true, email: 'someone@example.com' });
	});

	it('returns success after a 2xx', async () => {
		resolvesWith(200);
		expect(await run()).toEqual({ success: true, email: 'someone@example.com' });
	});
});
