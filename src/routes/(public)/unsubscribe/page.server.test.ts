import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolveReturnTarget = vi.hoisted(() => vi.fn());
vi.mock('$lib/server/tenant-canonical', () => ({ resolveReturnTarget }));

import { load } from './+page.server';

const fetchFn = vi.fn();

function run(search: string) {
	return load({
		url: new URL(`http://localhost:5173/unsubscribe${search}`),
		fetch: fetchFn
	} as unknown as Parameters<typeof load>[0]);
}

function token(claims: Record<string, unknown>): string {
	const enc = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
	return `${enc({ alg: 'HS256' })}.${enc(claims)}.sig`;
}

beforeEach(() => {
	resolveReturnTarget.mockReset();
	resolveReturnTarget.mockResolvedValue(null);
});

// The expiry check runs server-side so it uses the server clock (#982 review).
describe('unsubscribe page server load', () => {
	it('reports a missing token', async () => {
		expect(await run('')).toEqual({ tokenInfo: { status: 'missing' }, returnTo: null });
	});

	it('decodes a valid token', async () => {
		const t = token({ type: 'email_opt_out', email: 'g@example.com', exp: 4102444800 });
		expect(await run(`?token=${t}`)).toMatchObject({
			tokenInfo: { status: 'valid', kind: 'email_opt_out', email: 'g@example.com' }
		});
	});

	it('flags an expired token', async () => {
		const t = token({ type: 'unsubscribe', email: 'a@b.c', exp: 1000 });
		expect(await run(`?token=${t}`)).toEqual({ tokenInfo: { status: 'expired' }, returnTo: null });
	});

	it('exposes a validated return_host (#1070) as a token-free target', async () => {
		const target = { origin: 'https://events.acme.org', name: 'Acme' };
		resolveReturnTarget.mockResolvedValue(target);
		const result = await run('?token=SECRET&return_host=events.acme.org');
		expect(result.returnTo).toEqual(target);
		expect(resolveReturnTarget).toHaveBeenCalledWith('events.acme.org', fetchFn);
		expect(JSON.stringify(result.returnTo)).not.toContain('SECRET');
	});

	it('ignores an invalid return_host', async () => {
		const result = await run('?token=x&return_host=evil.com%2Fx');
		expect(result.returnTo).toBeNull();
	});
});
