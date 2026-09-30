import { describe, expect, it } from 'vitest';
import { readUnsubscribeToken } from './unsubscribe-token';

const NOW_MS = Date.UTC(2026, 8, 30, 12, 0, 0);
const NOW_S = Math.floor(NOW_MS / 1000);

function base64Url(value: string): string {
	const bytes = new TextEncoder().encode(value);
	return btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
}

function makeToken(claims: Record<string, unknown>): string {
	return `${base64Url('{"alg":"HS256","typ":"JWT"}')}.${base64Url(JSON.stringify(claims))}.sig`;
}

describe('readUnsubscribeToken', () => {
	it('reports a missing token', () => {
		expect(readUnsubscribeToken(null, NOW_MS)).toEqual({ status: 'missing' });
		expect(readUnsubscribeToken('', NOW_MS)).toEqual({ status: 'missing' });
	});

	it('reads an account unsubscribe token with its scope', () => {
		const token = makeToken({
			type: 'unsubscribe',
			user_id: 'u1',
			email: 'ada@example.com',
			exp: NOW_S + 3600,
			jti: 'j',
			aud: 'revel',
			notification_type: 'org_announcement',
			organization_id: 'org-1'
		});
		expect(readUnsubscribeToken(token, NOW_MS)).toEqual({
			status: 'valid',
			kind: 'unsubscribe',
			email: 'ada@example.com',
			notificationType: 'org_announcement',
			organizationId: 'org-1'
		});
	});

	it('treats absent scope claims on older tokens as null', () => {
		const token = makeToken({ type: 'unsubscribe', email: 'a@b.c', exp: NOW_S + 60 });
		expect(readUnsubscribeToken(token, NOW_MS)).toMatchObject({
			status: 'valid',
			kind: 'unsubscribe',
			notificationType: null,
			organizationId: null
		});
	});

	it('reads an invitation opt-out token (no user_id)', () => {
		const token = makeToken({
			type: 'email_opt_out',
			email: 'guest@example.com',
			organization_id: null,
			exp: NOW_S + 60
		});
		expect(readUnsubscribeToken(token, NOW_MS)).toEqual({
			status: 'valid',
			kind: 'email_opt_out',
			email: 'guest@example.com',
			organizationId: null
		});
	});

	it('decodes non-ASCII addresses', () => {
		const token = makeToken({ type: 'unsubscribe', email: 'zoë@exämple.de', exp: NOW_S + 60 });
		expect(readUnsubscribeToken(token, NOW_MS)).toMatchObject({ email: 'zoë@exämple.de' });
	});

	it('reports an expired token', () => {
		const token = makeToken({ type: 'unsubscribe', email: 'a@b.c', exp: NOW_S - 1 });
		expect(readUnsubscribeToken(token, NOW_MS)).toEqual({ status: 'expired' });
	});

	it.each([
		['not a JWT', 'garbage'],
		['bad base64 payload', 'a.@@@.c'],
		['non-JSON payload', `a.${base64Url('nope')}.c`],
		['unknown token type', makeToken({ type: 'access', email: 'a@b.c', exp: NOW_S + 60 })],
		['missing exp', makeToken({ type: 'unsubscribe', email: 'a@b.c' })],
		['missing email', makeToken({ type: 'email_opt_out', exp: NOW_S + 60 })]
	])('reports a malformed token as invalid: %s', (_label, token) => {
		expect(readUnsubscribeToken(token, NOW_MS)).toEqual({ status: 'invalid' });
	});
});
