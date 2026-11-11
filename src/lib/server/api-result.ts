/**
 * Helpers for reading the result of a generated SDK call.
 *
 * The hey-api client defaults to `throwOnError: false`: a 4xx/5xx RETURNS
 * `{ data: undefined, error, response }` instead of throwing, so a `try`/`catch`
 * around an SDK call only ever sees network failures. Anything that must
 * behave differently on failure (clear cookies, report success) has to inspect
 * the result with {@link getApiFailure} first.
 */

/** The subset of an SDK result these helpers read. */
export interface ApiResultLike {
	error?: unknown;
	response?: { ok: boolean; status: number };
}

/** A failed API call: the HTTP status and the parsed error body. */
export interface ApiFailure {
	status: number;
	body: unknown;
}

/**
 * Return the failure carried by an SDK result, or `null` when it succeeded.
 * A result fails when it carries an `error` or its response is not 2xx.
 */
export function getApiFailure(result: ApiResultLike): ApiFailure | null {
	const notOk = result.response !== undefined && !result.response.ok;
	if (result.error === undefined && !notOk) return null;
	return { status: result.response?.status ?? 500, body: result.error };
}

/** First element of a string array, if the value is one. */
export function firstString(value: unknown): string | undefined {
	return Array.isArray(value) && typeof value[0] === 'string' ? value[0] : undefined;
}

/** The backend's `{ detail: string }` message, when the body has one. */
export function getDetailMessage(body: unknown): string | undefined {
	if (typeof body === 'object' && body !== null && 'detail' in body) {
		const detail = (body as { detail: unknown }).detail;
		if (typeof detail === 'string' && detail.length > 0) return detail;
	}
	return undefined;
}

/** The `{ errors: { field: [...] } }` field-error object, or `{}`. */
export function getFieldErrors(body: unknown): Record<string, unknown> {
	if (typeof body === 'object' && body !== null && 'errors' in body) {
		const errors = (body as { errors: unknown }).errors;
		if (typeof errors === 'object' && errors !== null) return errors as Record<string, unknown>;
	}
	return {};
}
