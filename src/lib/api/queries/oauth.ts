import {
	oauthconnectionListConnections as listConnections,
	oauthconnectionRevoke as revoke,
	oauthscopeListScopes as listScopes
} from '$lib/api/generated/sdk.gen';
import type { AuthorizeScopeSchema, OAuthConnectionSchema } from '$lib/api/generated/types.gen';

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
 * queries and mutations plus `fieldErrorsFrom`. Keep every mutationFn
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

/** Sentinel for a 404 (unknown/foreign app, or the provider is switched off) and a 422 (non-UUID id). */
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

/**
 * Map a failed hey-api result onto the shared sentinels BY STATUS (never by
 * the localized `detail` text). Every other failure throws the backend body
 * AS-IS (e.g. a 400 `{ errors }` or a 409 `{ detail }`), unwrapped, so callers
 * can read its fields off the thrown value; an `Error` is created only when
 * there is no body at all.
 */
export function throwOAuthError(res: { error: unknown; response?: Response }): never {
	const status = statusOf(res);
	if (status === 403) throw new EmailUnverifiedError();
	if (status === 404 || status === 422) throw new NotFoundError();
	throw res.error ?? new Error('request failed');
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
