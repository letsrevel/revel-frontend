/**
 * Helpers for reading the result of a generated SDK call.
 *
 * The hey-api client defaults to `throwOnError: false`: a 4xx/5xx RETURNS
 * `{ data: undefined, error, response }` instead of throwing, and a network
 * failure RETURNS `{ error: <TypeError>, response: undefined }`. Anything that
 * must behave differently on failure (clear cookies, report success) has to
 * inspect the result with {@link getApiFailure} first.
 *
 * Body narrowing lives in `$lib/utils/api-error-detail` (`backendMessage`,
 * `isErrorDetail`, `isValidationErrorResponse`) and `$lib/utils/errors`
 * (`extractFieldErrors`); do not re-implement it here.
 */
import { linkTokenRejection } from '$lib/utils/api-error-detail';
import type { LinkTokenErrorCode } from '$lib/api/generated/types.gen';

/** The subset of an SDK result these helpers read. */
export interface ApiResultLike {
	error?: unknown;
	response?: { ok: boolean; status: number };
}

/** A failed API call. `network` means no HTTP response was received at all. */
export type ApiFailure =
	{ network: true; status: 0; body: undefined } | { network: false; status: number; body: unknown };

/**
 * Return the failure carried by an SDK result, or `null` when it succeeded.
 * - `error` set without a `response`: the request never got an answer.
 * - a non-2xx `response`: an HTTP failure; `body` is the parsed error body.
 */
export function getApiFailure(result: ApiResultLike): ApiFailure | null {
	if (result.response === undefined) {
		return result.error === undefined ? null : { network: true, status: 0, body: undefined };
	}
	if (result.error === undefined && result.response.ok) return null;
	return { network: false, status: result.response.status, body: result.error };
}

/** Localized copy for a failed link-token call, one string per outcome. */
export interface LinkTokenFailureCopy {
	/** `code: 'invalid_token'`: malformed or tampered link. */
	invalid: string;
	/** `code: 'token_expired'`: the link's lifetime ran out. */
	expired: string;
	/** Shown when a code-less body carries no readable `detail`. */
	fallback: string;
}

/** A failed link-token call's message plus the typed reason behind it. */
export interface LinkTokenFailure {
	message: string;
	/** `undefined` for a code-less refusal showing the backend's own detail. */
	code: LinkTokenErrorCode | undefined;
}

/**
 * The user-facing message for a 400 from an emailed-link endpoint (backend
 * #1373). Branches on the typed `code` (with a legacy "Invalid token:" prefix
 * fallback for older backends); a code-less `ErrorDetail` (blacklisted token,
 * email changed, org mismatch) shows the backend's own `detail`.
 */
export function linkTokenFailureMessage(
	body: unknown,
	copy: LinkTokenFailureCopy
): LinkTokenFailure {
	const { code, detail } = linkTokenRejection(body);
	switch (code) {
		case 'invalid_token':
			return { message: copy.invalid, code };
		case 'token_expired':
			return { message: copy.expired, code };
		default:
			return { message: detail ?? copy.fallback, code: undefined };
	}
}
