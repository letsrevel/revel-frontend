import * as m from '$lib/paraglide/messages.js';
import type { AuthorizationErrorResponse } from '$lib/api/generated/types.gen';

/**
 * RFC 6749 §4.1.2.1 / OIDC Core §3.1.2.6 codes the consent endpoints can
 * answer with as a 400 `{detail, error}` body, plus Revel's own
 * `consent_required` (the consent ticket expired or was missing). oauthlib
 * passes any code through, so the map stays open-ended: unknown codes get
 * the generic headline and the backend's `detail` does the explaining.
 * `access_denied` and `login_required` never arrive as a 400 body (a denial
 * is a redirect back to the app), which is why they are absent.
 *
 * Modelled on `oidc-errors.ts`: message FUNCTIONS in a map, called at render.
 */
export type OAuthErrorCode =
	| 'invalid_request'
	| 'unauthorized_client'
	| 'unsupported_response_type'
	| 'invalid_scope'
	| 'invalid_target'
	| 'server_error'
	| 'temporarily_unavailable'
	| 'invalid_client'
	| 'consent_required'
	| 'interaction_required';

const HEADLINES: Record<OAuthErrorCode, () => string> = {
	// Phase-neutral on purpose: on GET it means an unknown client_id, a
	// mismatched redirect_uri or missing PKCE; on POST a tampered or mismatched
	// consent ticket. Both read as "the request is invalid".
	invalid_request: m['oauth.error.invalid_request'],
	unauthorized_client: m['oauth.error.unauthorized_client'],
	unsupported_response_type: m['oauth.error.unsupported_response_type'],
	invalid_scope: m['oauth.error.invalid_scope'],
	invalid_target: m['oauth.error.invalid_target'],
	server_error: m['oauth.error.server_error'],
	temporarily_unavailable: m['oauth.error.temporarily_unavailable'],
	invalid_client: m['oauth.error.invalid_client'],
	consent_required: m['oauth.error.consent_required'],
	interaction_required: m['oauth.error.interaction_required']
};

export function isOAuthErrorCode(code: string): code is OAuthErrorCode {
	return Object.prototype.hasOwnProperty.call(HEADLINES, code);
}

/**
 * Narrow the 400 body of `GET`/`POST /api/oauth/authorize`. hey-api hands the
 * parsed body back as `error` directly (no `.body` wrapper).
 */
export function parseAuthorizationError(error: unknown): { code: string; detail: string } | null {
	if (typeof error !== 'object' || error === null) return null;
	const body = error as Partial<AuthorizationErrorResponse>;
	if (typeof body.error !== 'string' || body.error === '') return null;
	return { code: body.error, detail: typeof body.detail === 'string' ? body.detail : '' };
}

/** Headline for the error screen; the page shows `detail` under it. */
export function oauthErrorHeadline(code: string): string {
	return (isOAuthErrorCode(code) ? HEADLINES[code] : m['oauth.error.generic'])();
}

/** The only code that means "re-fetch and show the consent screen again". */
export function isConsentExpired(code: string): boolean {
	return code === 'consent_required';
}
