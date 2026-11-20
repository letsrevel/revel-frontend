import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/api/client', () => ({
	otpSetupOtp: vi.fn(),
	otpEnableOtp: vi.fn(),
	otpDisableOtp: vi.fn(),
	accountMe: vi.fn(),
	accountEmailChangeRequest: vi.fn()
}));

import { otpEnableOtp, otpDisableOtp } from '$lib/api/client';
import { actions } from './+page.server';

type ActionEvent = Parameters<NonNullable<(typeof actions)['verify']>>[0];

function event(): ActionEvent {
	return {
		request: new Request('https://example.test/account/security', {
			method: 'POST',
			body: new URLSearchParams({ code: '123456' })
		}),
		cookies: { get: () => 'token' }
	} as unknown as ActionEvent;
}

type Result = { status: number; data: { errors: { code: string }; totpLocked?: boolean } };

const lockedResponse = {
	response: { ok: false, status: 429, headers: new Headers({ 'Retry-After': '300' }) },
	error: { detail: 'x', code: 'totp_locked' }
};
const throttledResponse = {
	response: { ok: false, status: 429, headers: new Headers() },
	error: { detail: 'Too many requests' }
};
const wrongCode = {
	response: { ok: false, status: 403, headers: new Headers() },
	error: { detail: 'Invalid OTP' }
};

beforeEach(() => {
	vi.mocked(otpEnableOtp).mockReset();
	vi.mocked(otpDisableOtp).mockReset();
});

describe.each([
	['verify', otpEnableOtp],
	['disable', otpDisableOtp]
] as const)('%s action', (name, api) => {
	const run = () => (actions[name] as (e: ActionEvent) => Promise<Result>)(event());

	it('totp_locked -> 429 with the paused message and totpLocked flag', async () => {
		vi.mocked(api).mockResolvedValue(lockedResponse as never);
		const result = await run();
		expect(result.status).toBe(429);
		expect(result.data.totpLocked).toBe(true);
		expect(result.data.errors.code).toContain('5');
	});

	it('429 without code -> generic rate limit, input stays enabled', async () => {
		vi.mocked(api).mockResolvedValue(throttledResponse as never);
		const result = await run();
		expect(result.status).toBe(429);
		expect(result.data.totpLocked).toBeUndefined();
		expect(result.data.errors.code).toBeTruthy();
	});

	it('a wrong code keeps the existing 403', async () => {
		vi.mocked(api).mockResolvedValue(wrongCode as never);
		const result = await run();
		expect(result.status).toBe(403);
		expect(result.data.totpLocked).toBeUndefined();
	});
});
