import { describe, it, expect, vi, beforeEach } from 'vitest';

const listScopesMock = vi.hoisted(() => vi.fn());
const listConnectionsMock = vi.hoisted(() => vi.fn());
const revokeMock = vi.hoisted(() => vi.fn());
vi.mock('$lib/api/generated/sdk.gen', () => ({
	oauthscopeListScopes: listScopesMock,
	oauthconnectionListConnections: listConnectionsMock,
	oauthconnectionRevoke: revokeMock
}));

import {
	EmailUnverifiedError,
	NotFoundError,
	connectionsQuery,
	isEmailUnverified,
	isNotFound,
	oauthKeys,
	revokeConnection,
	scopesQuery,
	statusOf,
	throwOAuthError
} from './oauth';

beforeEach(() => {
	listScopesMock.mockReset();
	listConnectionsMock.mockReset();
	revokeMock.mockReset();
});

describe('oauthKeys', () => {
	it('nests app(id) under apps so invalidating apps covers every detail', () => {
		expect(oauthKeys.app('abc')).toEqual([...oauthKeys.apps, 'abc']);
		expect(oauthKeys.scopes[0]).toBe(oauthKeys.all[0]);
	});
});

describe('scopesQuery', () => {
	it('returns the vocabulary and never goes stale', async () => {
		listScopesMock.mockResolvedValue({
			data: [{ name: 'openid', label: 'Sign you in', group: 'identity' }],
			error: undefined,
			response: { status: 200 }
		});
		const opts = scopesQuery();
		expect(opts.queryKey).toEqual(oauthKeys.scopes);
		expect(opts.staleTime).toBe(Infinity);
		await expect(opts.queryFn()).resolves.toEqual([
			{ name: 'openid', label: 'Sign you in', group: 'identity' }
		]);
	});

	it('maps a 404 onto the NotFoundError sentinel', async () => {
		listScopesMock.mockResolvedValue({
			data: undefined,
			error: { detail: 'Not found.' },
			response: { status: 404 }
		});
		await expect(scopesQuery().queryFn()).rejects.toBeInstanceOf(NotFoundError);
	});
});

describe('throwOAuthError', () => {
	it.each([
		[403, EmailUnverifiedError],
		[404, NotFoundError],
		[422, NotFoundError]
	])('maps status %i onto its sentinel', (status, Sentinel) => {
		expect(() =>
			throwOAuthError({ error: { detail: 'x' }, response: { status } as Response })
		).toThrow(Sentinel);
	});

	it('throws a 400 validation body as-is so field errors survive', async () => {
		listScopesMock.mockResolvedValue({
			data: undefined,
			error: { errors: { name: ['required'] } },
			response: { status: 400 }
		});
		await expect(scopesQuery().queryFn()).rejects.toEqual({ errors: { name: ['required'] } });
	});

	it('throws a 409 detail body as-is', async () => {
		listScopesMock.mockResolvedValue({
			data: undefined,
			error: { detail: 'You have reached the maximum number of apps.' },
			response: { status: 409 }
		});
		await expect(scopesQuery().queryFn()).rejects.toEqual({
			detail: 'You have reached the maximum number of apps.'
		});
	});

	it('throws an Error only when there is no body at all', () => {
		expect(() => throwOAuthError({ error: undefined })).toThrow(Error);
	});
});

describe('error classes', () => {
	it('narrow by class, never by message text', () => {
		expect(isEmailUnverified(new EmailUnverifiedError())).toBe(true);
		expect(isEmailUnverified(new Error('Email verification required.'))).toBe(false);
		expect(isNotFound(new NotFoundError())).toBe(true);
		expect(isNotFound({ kind: 'not_found' })).toBe(false);
	});

	it('statusOf reads the response status when present', () => {
		expect(statusOf({ response: { status: 403 } as Response })).toBe(403);
		expect(statusOf({})).toBeUndefined();
	});
});

describe('connectionsQuery', () => {
	it('returns the list and uses the connections key', async () => {
		const row = {
			client_id: 'cid',
			application: {
				name: 'A',
				description: '',
				logo_url: null,
				verified: false,
				registration_source: 'dcr',
				homepage_url: '',
				privacy_policy_url: ''
			},
			scopes: ['openid'],
			first_authorized_at: '2026-09-01T10:00:00Z',
			last_used_at: '2026-09-02T10:00:00Z'
		};
		listConnectionsMock.mockResolvedValue({
			data: [row],
			error: undefined,
			response: { status: 200 }
		});
		const opts = connectionsQuery();
		expect(opts.queryKey).toEqual(oauthKeys.connections);
		await expect(opts.queryFn()).resolves.toEqual([row]);
	});

	it('maps a 404 (provider off) onto NotFoundError', async () => {
		listConnectionsMock.mockResolvedValue({
			data: undefined,
			error: { detail: 'Not found.' },
			response: { status: 404 }
		});
		await expect(connectionsQuery().queryFn()).rejects.toBeInstanceOf(NotFoundError);
	});
});

describe('revokeConnection', () => {
	it('DELETEs by client_id and resolves to void on 204', async () => {
		revokeMock.mockResolvedValue({ data: undefined, error: undefined, response: { status: 204 } });
		await expect(revokeConnection().mutationFn('cid-1')).resolves.toBeUndefined();
		expect(revokeMock).toHaveBeenCalledWith({ path: { client_id: 'cid-1' } });
	});

	it('maps a 404 onto NotFoundError', async () => {
		revokeMock.mockResolvedValue({
			data: undefined,
			error: { detail: 'Not found.' },
			response: { status: 404 }
		});
		await expect(revokeConnection().mutationFn('gone')).rejects.toBeInstanceOf(NotFoundError);
	});
});
