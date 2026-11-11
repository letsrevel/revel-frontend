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

/**
 * Prefixes of the backend's `"Invalid token: {error}"` detail in each locale
 * (backend `token_to_payload`, `.po` catalogs). The text after the prefix is a
 * raw exception message and must never reach the user. The backend sends no
 * machine-readable code for this case, and the detail is translated per
 * Accept-Language, hence one prefix per supported locale.
 */
const INVALID_TOKEN_PREFIXES = [
	'Invalid token:',
	'Ungültiger Token:',
	'Jeton invalide :',
	'Token non valido:',
	'Token no válido:',
	'Token inválido:'
];

/** Is this backend `detail` the "Invalid token: <exception text>" refusal? */
export function isInvalidTokenDetail(detail: string | null): boolean {
	return detail !== null && INVALID_TOKEN_PREFIXES.some((prefix) => detail.startsWith(prefix));
}
