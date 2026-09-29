import { describe, it, expect, vi, beforeEach } from 'vitest';

const listScopesMock = vi.hoisted(() => vi.fn());
const listConnectionsMock = vi.hoisted(() => vi.fn());
const revokeMock = vi.hoisted(() => vi.fn());
const listAppsMock = vi.hoisted(() => vi.fn());
const createAppMock = vi.hoisted(() => vi.fn());
const getAppMock = vi.hoisted(() => vi.fn());
const updateAppMock = vi.hoisted(() => vi.fn());
const deleteAppMock = vi.hoisted(() => vi.fn());
const rotateMock = vi.hoisted(() => vi.fn());
const deactivateMock = vi.hoisted(() => vi.fn());
const activateMock = vi.hoisted(() => vi.fn());
const uploadLogoMock = vi.hoisted(() => vi.fn());
vi.mock('$lib/api/generated/sdk.gen', () => ({
	oauthscopeListScopes: listScopesMock,
	oauthconnectionListConnections: listConnectionsMock,
	oauthconnectionRevoke: revokeMock,
	oauthappListApps: listAppsMock,
	oauthappCreateApp: createAppMock,
	oauthappGetApp: getAppMock,
	oauthappUpdateApp: updateAppMock,
	oauthappDeleteApp: deleteAppMock,
	oauthappRotateSecret: rotateMock,
	oauthappDeactivate: deactivateMock,
	oauthappActivate: activateMock,
	oauthappUploadLogo: uploadLogoMock
}));

import { shouldRetry } from '$lib/api/query-retry';
import {
	EmailUnverifiedError,
	NotFoundError,
	appQuery,
	appsQuery,
	connectionsQuery,
	createApp,
	deleteApp,
	isEmailUnverified,
	isNotFound,
	oauthKeys,
	revokeConnection,
	rotateSecret,
	scopesQuery,
	setAppActive,
	statusOf,
	throwOAuthError,
	updateApp,
	uploadLogo
} from './oauth';

beforeEach(() => {
	listScopesMock.mockReset();
	listConnectionsMock.mockReset();
	revokeMock.mockReset();
	for (const m of [
		listAppsMock,
		createAppMock,
		getAppMock,
		updateAppMock,
		deleteAppMock,
		rotateMock,
		deactivateMock,
		activateMock,
		uploadLogoMock
	])
		m.mockReset();
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
		[404, NotFoundError]
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

	it('throws a 422 body-validation error as-is, never as NotFoundError', () => {
		const body = { detail: [{ loc: ['body', 'payload', 'name'], msg: 'too long' }] };
		let err: unknown;
		try {
			throwOAuthError({ error: body, response: { status: 422 } as Response });
		} catch (e) {
			err = e;
		}
		expect(err).not.toBeInstanceOf(NotFoundError);
		expect(err).toEqual({ detail: [{ loc: ['body', 'payload', 'name'], msg: 'too long' }] });
		expect((err as { __status?: number }).__status).toBe(422);
	});

	it('throws an Error only when there is no body at all', () => {
		expect(() => throwOAuthError({ error: undefined })).toThrow(Error);
	});

	it('throws an Error when the body is not an object', () => {
		let err: unknown;
		try {
			throwOAuthError({ error: 'Bad Gateway', response: { status: 502 } as Response });
		} catch (e) {
			err = e;
		}
		expect(err).toBeInstanceOf(Error);
	});
});

describe('error classes', () => {
	it('narrow by class, never by message text', () => {
		expect(isEmailUnverified(new EmailUnverifiedError())).toBe(true);
		expect(isEmailUnverified(new Error('Email verification required.'))).toBe(false);
		expect(isNotFound(new NotFoundError())).toBe(true);
		expect(isNotFound({ kind: 'not_found' })).toBe(false);
	});

	it('expose their HTTP status so the global retry predicate fails them fast', () => {
		expect(new EmailUnverifiedError().status).toBe(403);
		expect(new NotFoundError().status).toBe(404);
		expect(shouldRetry(0, new EmailUnverifiedError())).toBe(false);
		expect(shouldRetry(0, new NotFoundError())).toBe(false);
		// `status` is not the discriminator: a bare object with it is not a sentinel.
		expect(isNotFound({ status: 404 })).toBe(false);
		expect(isEmailUnverified({ status: 403 })).toBe(false);
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

describe('withStatus / throwOAuthError status marker', () => {
	it('attaches a non-enumerable __status to a thrown body', async () => {
		revokeMock.mockResolvedValue({
			data: undefined,
			error: { detail: 'cap' },
			response: { status: 409 }
		});
		const err = await revokeConnection()
			.mutationFn('x')
			.catch((e: unknown) => e);
		expect(err).toEqual({ detail: 'cap' });
		expect((err as { __status?: number }).__status).toBe(409);
		expect(Object.keys(err as object)).toEqual(['detail']);
	});
});

describe('apps builders', () => {
	const app = {
		id: 'app-1',
		client_id: 'cid',
		name: 'A',
		description: '',
		client_type: 'public',
		allowed_scopes: [],
		redirect_uris: ['https://a.example/cb'],
		homepage_url: '',
		privacy_policy_url: '',
		verified: false,
		is_active: true,
		last_used_at: null,
		logo_url: null,
		registration_source: 'manual',
		connections_count: 0
	};

	it('appsQuery lists and maps 403 to EmailUnverifiedError', async () => {
		listAppsMock.mockResolvedValue({ data: [app], error: undefined, response: { status: 200 } });
		expect(appsQuery().queryKey).toEqual(oauthKeys.apps);
		await expect(appsQuery().queryFn()).resolves.toEqual([app]);
		listAppsMock.mockResolvedValue({
			data: undefined,
			error: { detail: 'Email verification required.' },
			response: { status: 403 }
		});
		await expect(appsQuery().queryFn()).rejects.toBeInstanceOf(EmailUnverifiedError);
	});

	it('appQuery uses the nested key and maps 404/422 to NotFoundError', async () => {
		getAppMock.mockResolvedValue({ data: app, error: undefined, response: { status: 200 } });
		expect(appQuery('app-1').queryKey).toEqual(oauthKeys.app('app-1'));
		await expect(appQuery('app-1').queryFn()).resolves.toEqual(app);
		expect(getAppMock).toHaveBeenCalledWith({ path: { app_id: 'app-1' } });
		getAppMock.mockResolvedValue({
			data: undefined,
			error: { detail: [{ loc: ['path', 'app_id'], msg: 'uuid' }] },
			response: { status: 422 }
		});
		await expect(appQuery('nope').queryFn()).rejects.toBeInstanceOf(NotFoundError);
	});

	it('createApp and rotateSecret never keep their result (gcTime 0) and return the secret once', async () => {
		createAppMock.mockResolvedValue({
			data: { ...app, client_type: 'confidential', client_secret: 's3cret' },
			error: undefined,
			response: { status: 201 }
		});
		const create = createApp();
		expect(create.gcTime).toBe(0);
		await expect(
			create.mutationFn({
				name: 'A',
				description: '',
				client_type: 'confidential',
				redirect_uris: ['https://a.example/cb'],
				allowed_scopes: [],
				homepage_url: '',
				privacy_policy_url: ''
			})
		).resolves.toMatchObject({ client_secret: 's3cret' });
		rotateMock.mockResolvedValue({
			data: { ...app, client_secret: 'n3w' },
			error: undefined,
			response: { status: 200 }
		});
		expect(rotateSecret().gcTime).toBe(0);
		await expect(rotateSecret().mutationFn('app-1')).resolves.toMatchObject({
			client_secret: 'n3w'
		});
		expect(rotateMock).toHaveBeenCalledWith({ path: { app_id: 'app-1' } });
	});

	it('createApp throws the 400/409 body as-is with its status', async () => {
		createAppMock.mockResolvedValue({
			data: undefined,
			error: { errors: { redirect_uris: ['Bad'] } },
			response: { status: 400 }
		});
		const err = await createApp()
			.mutationFn({
				name: 'A',
				description: '',
				client_type: 'public',
				redirect_uris: ['x'],
				allowed_scopes: [],
				homepage_url: '',
				privacy_policy_url: ''
			})
			.catch((e: unknown) => e);
		expect(err).toEqual({ errors: { redirect_uris: ['Bad'] } });
		expect((err as { __status?: number }).__status).toBe(400);
	});

	it('createApp throws a 422 body-validation error as-is with its status', async () => {
		const body = { detail: [{ loc: ['body', 'payload', 'name'], msg: 'too long' }] };
		createAppMock.mockResolvedValue({ data: undefined, error: body, response: { status: 422 } });
		const err = await createApp()
			.mutationFn({
				name: 'A'.repeat(300),
				description: '',
				client_type: 'public',
				redirect_uris: ['https://a.example/cb'],
				allowed_scopes: [],
				homepage_url: '',
				privacy_policy_url: ''
			})
			.catch((e: unknown) => e);
		expect(err).not.toBeInstanceOf(NotFoundError);
		expect(err).toEqual({ detail: [{ loc: ['body', 'payload', 'name'], msg: 'too long' }] });
		expect((err as { __status?: number }).__status).toBe(422);
	});

	it('updateApp PATCHes only the given body; setAppActive picks the endpoint; deleteApp resolves void; uploadLogo sends multipart', async () => {
		updateAppMock.mockResolvedValue({ data: app, error: undefined, response: { status: 200 } });
		await updateApp().mutationFn({ id: 'app-1', body: { description: 'x' } });
		expect(updateAppMock).toHaveBeenCalledWith({
			path: { app_id: 'app-1' },
			body: { description: 'x' }
		});
		deactivateMock.mockResolvedValue({
			data: { ...app, is_active: false },
			error: undefined,
			response: { status: 200 }
		});
		activateMock.mockResolvedValue({ data: app, error: undefined, response: { status: 200 } });
		await expect(setAppActive().mutationFn({ id: 'app-1', active: false })).resolves.toMatchObject({
			is_active: false
		});
		await expect(setAppActive().mutationFn({ id: 'app-1', active: true })).resolves.toMatchObject({
			is_active: true
		});
		expect(deactivateMock).toHaveBeenCalledWith({ path: { app_id: 'app-1' } });
		expect(activateMock).toHaveBeenCalledWith({ path: { app_id: 'app-1' } });
		deleteAppMock.mockResolvedValue({
			data: undefined,
			error: undefined,
			response: { status: 204 }
		});
		await expect(deleteApp().mutationFn('app-1')).resolves.toBeUndefined();
		const file = new File(['x'], 'logo.png', { type: 'image/png' });
		uploadLogoMock.mockResolvedValue({ data: app, error: undefined, response: { status: 200 } });
		await uploadLogo().mutationFn({ id: 'app-1', file });
		expect(uploadLogoMock).toHaveBeenCalledWith({
			path: { app_id: 'app-1' },
			body: { logo: file }
		});
	});
});
