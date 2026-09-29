import {
	oauthappActivate as activate,
	oauthappCreateApp as createAppRequest,
	oauthappDeactivate as deactivate,
	oauthappDeleteApp as deleteAppRequest,
	oauthappGetApp as getApp,
	oauthappListApps as listApps,
	oauthappRotateSecret as rotateSecretRequest,
	oauthappUpdateApp as updateAppRequest,
	oauthappUploadLogo as uploadLogoRequest,
	oauthconnectionListConnections as listConnections,
	oauthconnectionRevoke as revoke,
	oauthscopeListScopes as listScopes
} from '$lib/api/generated/sdk.gen';
import type {
	AuthorizeScopeSchema,
	OAuthAppCreatedSchema,
	OAuthAppCreatePayload,
	OAuthAppSchema,
	OAuthAppUpdatePayload,
	OAuthConnectionSchema
} from '$lib/api/generated/types.gen';

/**
 * Query keys and option builders for the OAuth provider surfaces (#953).
 *
 * Unlike `waitlist-offers.ts`, builders take no token getter and no
 * QueryClient: the request interceptor in `$lib/api/client` injects the
 * bearer after `waitForAuthReady()`, and invalidation happens in the caller's
 * `onSuccess`. Builders return plain option objects; callers wrap them:
 * `createQuery(() => scopesQuery())`.
 *
 * PR 2 adds `connectionsQuery` / `revokeConnection`; PR 3 adds the apps
 * queries and mutations (the form-side `fieldErrorsFrom` lives in
 * `$lib/utils/oauth-app-form.ts`). Keep every mutationFn
 * throwing `res.error` (never swallow it) and never write a secret-bearing
 * response into any cache.
 */
export const oauthKeys = {
	all: ['oauth'] as const,
	scopes: ['oauth', 'scopes'] as const,
	connections: ['oauth', 'connections'] as const,
	apps: ['oauth', 'apps'] as const,
	/** Nested under `apps` so invalidating `apps` also refreshes every detail. */
	app: (id: string) => ['oauth', 'apps', id] as const
};

/** Sentinel for a 403 on the developer-apps routes: the user's email is not verified. */
export class EmailUnverifiedError extends Error {
	readonly kind = 'email_unverified';
	constructor() {
		super('email_unverified');
		this.name = 'EmailUnverifiedError';
	}
}

/**
 * Sentinel for a 404 (unknown/foreign app, or the provider is switched off).
 * A 422 maps here ONLY on the app detail read (`appQuery`), where it means a
 * non-UUID path id; everywhere else a 422 is a body-validation error.
 */
export class NotFoundError extends Error {
	readonly kind = 'not_found';
	constructor() {
		super('not_found');
		this.name = 'NotFoundError';
	}
}

export function isEmailUnverified(err: unknown): err is EmailUnverifiedError {
	return err instanceof EmailUnverifiedError;
}

export function isNotFound(err: unknown): err is NotFoundError {
	return err instanceof NotFoundError;
}

/** The HTTP status of a hey-api result, when the request got a response at all. */
export function statusOf(res: { response?: Response }): number | undefined {
	return res.response?.status;
}

/** Attach the HTTP status to a thrown plain body without touching its enumerable keys. */
export function withStatus<T extends object>(body: T, status: number | undefined): T {
	if (status !== undefined)
		Object.defineProperty(body, '__status', {
			value: status,
			enumerable: false,
			configurable: true
		});
	return body;
}

/**
 * Map a failed hey-api result onto the shared sentinels BY STATUS (never by
 * the localized `detail` text): 403 -> `EmailUnverifiedError`, 404 ->
 * `NotFoundError`. Every other failure throws the backend body AS-IS (e.g. a
 * 400 `{ errors }`, a 409 `{ detail }`, or django-ninja's 422 pydantic
 * `{ detail: [{ loc, msg }] }` for an invalid request body), unwrapped, so callers
 * can read its fields off the thrown value, with the status attached as a
 * non-enumerable `__status` (see `withStatus`); an `Error` is created only
 * when there is no object body at all.
 */
export function throwOAuthError(res: { error: unknown; response?: Response }): never {
	const status = statusOf(res);
	if (status === 403) throw new EmailUnverifiedError();
	if (status === 404) throw new NotFoundError();
	if (typeof res.error === 'object' && res.error !== null) throw withStatus(res.error, status);
	throw new Error('request failed');
}

/** The whole scope vocabulary with translated labels; a language switch reloads the app, so it never goes stale. */
export function scopesQuery() {
	return {
		queryKey: oauthKeys.scopes,
		queryFn: async (): Promise<AuthorizeScopeSchema[]> => {
			const res = await listScopes();
			if (res.error || !res.data) throwOAuthError(res);
			return res.data;
		},
		staleTime: Infinity
	};
}

/** The apps the user has authorized, most recently used first. */
export function connectionsQuery() {
	return {
		queryKey: oauthKeys.connections,
		queryFn: async (): Promise<OAuthConnectionSchema[]> => {
			const res = await listConnections();
			if (res.error || !res.data) throwOAuthError(res);
			return res.data;
		}
	};
}

/**
 * Disconnect an app: the backend revokes every token, ID token and pending
 * code the user granted it, so the next authorization shows consent again.
 * Callers invalidate `oauthKeys.connections` in their `onSuccess`.
 */
export function revokeConnection() {
	return {
		mutationFn: async (clientId: string): Promise<void> => {
			const res = await revoke({ path: { client_id: clientId } });
			if (res.error) throwOAuthError(res);
		}
	};
}

export function appsQuery() {
	return {
		queryKey: oauthKeys.apps,
		queryFn: async (): Promise<OAuthAppSchema[]> => {
			const res = await listApps();
			if (res.error || !res.data) throwOAuthError(res);
			return res.data;
		}
	};
}

export function appQuery(id: string) {
	return {
		queryKey: oauthKeys.app(id),
		queryFn: async (): Promise<OAuthAppSchema> => {
			const res = await getApp({ path: { app_id: id } });
			// A non-UUID id is a 422 from the path validator; for this read it means not found.
			if (statusOf(res) === 422) throw new NotFoundError();
			if (res.error || !res.data) throwOAuthError(res);
			return res.data;
		}
	};
}

/**
 * The create response carries the plaintext `client_secret` ONCE. `gcTime: 0`
 * drops it from the MutationCache the moment the mutation settles; the caller
 * keeps it in component state and invalidates `oauthKeys.apps`. Never
 * `setQueryData` with this response.
 */
export function createApp() {
	return {
		mutationFn: async (body: OAuthAppCreatePayload): Promise<OAuthAppCreatedSchema> => {
			const res = await createAppRequest({ body });
			if (res.error || !res.data) throwOAuthError(res);
			return res.data;
		},
		gcTime: 0 as const
	};
}

export function updateApp() {
	return {
		mutationFn: async ({
			id,
			body
		}: {
			id: string;
			body: OAuthAppUpdatePayload;
		}): Promise<OAuthAppSchema> => {
			const res = await updateAppRequest({ path: { app_id: id }, body });
			if (res.error || !res.data) throwOAuthError(res);
			return res.data;
		}
	};
}

export function deleteApp() {
	return {
		mutationFn: async (id: string): Promise<void> => {
			const res = await deleteAppRequest({ path: { app_id: id } });
			if (res.error) throwOAuthError(res);
		}
	};
}

/** Same one-time-secret contract as `createApp`. */
export function rotateSecret() {
	return {
		mutationFn: async (id: string): Promise<OAuthAppCreatedSchema> => {
			const res = await rotateSecretRequest({ path: { app_id: id } });
			if (res.error || !res.data) throwOAuthError(res);
			return res.data;
		},
		gcTime: 0 as const
	};
}

export function setAppActive() {
	return {
		mutationFn: async ({
			id,
			active
		}: {
			id: string;
			active: boolean;
		}): Promise<OAuthAppSchema> => {
			const res = active
				? await activate({ path: { app_id: id } })
				: await deactivate({ path: { app_id: id } });
			if (res.error || !res.data) throwOAuthError(res);
			return res.data;
		}
	};
}

export function uploadLogo() {
	return {
		mutationFn: async ({ id, file }: { id: string; file: File }): Promise<OAuthAppSchema> => {
			const res = await uploadLogoRequest({ path: { app_id: id }, body: { logo: file } });
			if (res.error || !res.data) throwOAuthError(res);
			return res.data;
		}
	};
}
