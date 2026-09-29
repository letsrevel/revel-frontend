import { client } from '$lib/api/client';
import type {
	AuthorizationErrorResponse,
	AuthorizeDecisionPayload,
	AuthorizeDescribeResponse,
	AuthorizeRedirectResponse
} from '$lib/api/generated/types.gen';
import { parseAuthorizationError } from '$lib/utils/oauth-errors';

/**
 * The two consent calls, with the page's own query string appended VERBATIM.
 *
 * Not the generated wrappers: those take `query` as an object, which
 * re-encodes values, reorders keys and collapses the repeated `resource`.
 * The backend re-validates the authorization request on every call and the
 * consent ticket fingerprints redirect URI, scopes, PKCE challenge and
 * resource set, so any change to the string makes the POST fail with
 * `invalid_request`. The configured `client` still runs both interceptors
 * (bearer after `waitForAuthReady`, 401 refresh + retry).
 */
export type AuthorizeResult =
	| { kind: 'describe'; data: AuthorizeDescribeResponse }
	| { kind: 'redirect'; redirectTo: string }
	/** 400 `{detail, error}`: shown on Revel; never followed anywhere. */
	| { kind: 'error'; code: string; detail: string }
	/** 401 that survived the client's refresh path: the session is gone. */
	| { kind: 'unauthenticated' }
	/** Network failure, 404 (provider off), 429, 5xx: retryable. */
	| { kind: 'failure' };

export type DecideResult = Exclude<AuthorizeResult, { kind: 'describe' }>;

type SuccessBody = AuthorizeDescribeResponse | AuthorizeRedirectResponse;

const AUTHORIZE_PATH = '/api/oauth/authorize';

function isRedirect(body: SuccessBody): body is AuthorizeRedirectResponse {
	return 'redirect_to' in body && typeof body.redirect_to === 'string';
}

/** Minimal shape check: a describe body carries a ticket and an application object. */
function isDescribe(body: SuccessBody): body is AuthorizeDescribeResponse {
	const b = body as Partial<Record<keyof AuthorizeDescribeResponse, unknown>>;
	return (
		typeof b.consent_ticket === 'string' &&
		typeof b.application === 'object' &&
		b.application !== null
	);
}

function classify(res: {
	data?: SuccessBody;
	error?: unknown;
	response?: Response;
}): AuthorizeResult {
	if (res.data) {
		if (isRedirect(res.data)) return { kind: 'redirect', redirectTo: res.data.redirect_to };
		if (isDescribe(res.data)) return { kind: 'describe', data: res.data };
		// A 200 that is neither shape is a contract violation: retryable failure.
		return { kind: 'failure' };
	}
	const status = res.response?.status;
	if (status === 401) return { kind: 'unauthenticated' };
	if (status === 400) {
		const parsed = parseAuthorizationError(res.error);
		if (parsed) return { kind: 'error', code: parsed.code, detail: parsed.detail };
	}
	return { kind: 'failure' };
}

export async function describeAuthorization(search: string): Promise<AuthorizeResult> {
	try {
		const res = await client.get<{ 200: SuccessBody }, { 400: AuthorizationErrorResponse }>({
			url: AUTHORIZE_PATH + search
		});
		return classify(res);
	} catch {
		return { kind: 'failure' };
	}
}

export async function decideAuthorization(
	search: string,
	body: AuthorizeDecisionPayload
): Promise<DecideResult> {
	try {
		const res = await client.post<
			{ 200: AuthorizeRedirectResponse },
			{ 400: AuthorizationErrorResponse }
		>({
			url: AUTHORIZE_PATH + search,
			body
		});
		const result = classify(res);
		// A decision always ends in a redirect; a describe body here is a contract violation.
		return result.kind === 'describe' ? { kind: 'failure' } : result;
	} catch {
		return { kind: 'failure' };
	}
}
