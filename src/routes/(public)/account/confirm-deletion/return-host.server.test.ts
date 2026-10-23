import { describe, it, expect, vi, beforeEach } from 'vitest';

const resolveReturnTarget = vi.hoisted(() => vi.fn());
vi.mock('$lib/server/tenant-canonical', () => ({ resolveReturnTarget }));
vi.mock('$lib/api/generated', () => ({
	accountDeleteAccountConfirm: vi.fn().mockResolvedValue({})
}));
vi.mock('$lib/server/logger', () => ({ log: { error: vi.fn() } }));

import { actions } from './+page.server';

const fetchFn = vi.fn();

function run(extra: Record<string, string> = {}) {
	const body = new FormData();
	body.set('token', 'tok-123');
	for (const [k, v] of Object.entries(extra)) body.set(k, v);
	return actions.confirmDeletion({
		request: new Request('http://localhost/account/confirm-deletion', { method: 'POST', body }),
		cookies: { delete: vi.fn() },
		fetch: fetchFn
	} as unknown as Parameters<typeof actions.confirmDeletion>[0]);
}

beforeEach(() => resolveReturnTarget.mockReset());

describe('/account/confirm-deletion return_host (#1070)', () => {
	it('returns the validated target so the page links to the tenant root', async () => {
		const target = { origin: 'https://events.acme.org', name: 'Acme' };
		resolveReturnTarget.mockResolvedValue(target);
		const result = await run({ return_host: 'events.acme.org' });
		expect(result).toEqual({ success: true, returnTo: target });
		expect(resolveReturnTarget).toHaveBeenCalledWith('events.acme.org', fetchFn);
		expect(JSON.stringify(result)).not.toContain('tok-123');
	});

	it('keeps today behavior for an invalid return_host', async () => {
		resolveReturnTarget.mockResolvedValue(null);
		expect(await run({ return_host: 'a@b' })).toEqual({ success: true, returnTo: null });
	});
});
