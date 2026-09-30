import { describe, expect, it } from 'vitest';
import { load } from './+page.server';

function run(search: string) {
	return load({
		url: new URL(`http://localhost:5173/unsubscribe${search}`)
	} as unknown as Parameters<typeof load>[0]);
}

function token(claims: Record<string, unknown>): string {
	const enc = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
	return `${enc({ alg: 'HS256' })}.${enc(claims)}.sig`;
}

// The expiry check runs server-side so it uses the server clock (#982 review).
describe('unsubscribe page server load', () => {
	it('reports a missing token', () => {
		expect(run('')).toEqual({ tokenInfo: { status: 'missing' } });
	});

	it('decodes a valid token', () => {
		const t = token({ type: 'email_opt_out', email: 'g@example.com', exp: 4102444800 });
		expect(run(`?token=${t}`)).toMatchObject({
			tokenInfo: { status: 'valid', kind: 'email_opt_out', email: 'g@example.com' }
		});
	});

	it('flags an expired token', () => {
		const t = token({ type: 'unsubscribe', email: 'a@b.c', exp: 1000 });
		expect(run(`?token=${t}`)).toEqual({ tokenInfo: { status: 'expired' } });
	});
});
