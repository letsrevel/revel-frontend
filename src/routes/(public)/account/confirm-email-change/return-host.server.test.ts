import { describe, it, expect, vi, beforeEach } from 'vitest';

const resolveReturnTarget = vi.hoisted(() => vi.fn());
vi.mock('$lib/server/tenant-canonical', () => ({ resolveReturnTarget }));
vi.mock('$lib/api/generated/sdk.gen', () => ({
	accountEmailChangeConfirm: vi.fn().mockResolvedValue({
		response: { ok: true, status: 200 },
		data: { token: { access: 'a', refresh: 'r' }, user: { email: 'new@example.com' } }
	})
}));
vi.mock('$lib/utils/cookies', () => ({
	getAccessTokenCookieOptions: () => ({ path: '/' }),
	getRefreshTokenCookieOptions: () => ({ path: '/' }),
	getClientCookieOptions: () => ({ path: '/' })
}));
vi.mock('$lib/server/logger', () => ({ log: { error: vi.fn() } }));

import { actions } from './+page.server';

const fetchFn = vi.fn();

function run(extra: Record<string, string> = {}) {
	const body = new FormData();
	body.set('token', 'tok-123');
	for (const [k, v] of Object.entries(extra)) body.set(k, v);
	return actions.confirmEmailChange({
		request: new Request('http://localhost/account/confirm-email-change', {
			method: 'POST',
			body
		}),
		cookies: { get: vi.fn(), set: vi.fn() },
		fetch: fetchFn
	} as unknown as Parameters<typeof actions.confirmEmailChange>[0]);
}

beforeEach(() => resolveReturnTarget.mockReset());

describe('/account/confirm-email-change return_host (#1070)', () => {
	it('returns the validated target so the page links to {origin}/login', async () => {
		const target = { origin: 'https://events.acme.org', name: 'Acme' };
		resolveReturnTarget.mockResolvedValue(target);
		const result = (await run({ return_host: 'events.acme.org' })) as Record<string, unknown>;
		expect(result.success).toBe(true);
		expect(result.returnTo).toEqual(target);
		expect(resolveReturnTarget).toHaveBeenCalledWith('events.acme.org', fetchFn);
		expect(JSON.stringify(result.returnTo)).not.toContain('tok-123');
	});

	it('keeps today behavior for an invalid return_host', async () => {
		resolveReturnTarget.mockResolvedValue(null);
		const result = (await run({ return_host: 'host:8080' })) as Record<string, unknown>;
		expect(result.success).toBe(true);
		expect(result.returnTo).toBeNull();
	});
});
