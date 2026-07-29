import type {
	ErrorDetail,
	ResponseMessage,
	ValidationErrorResponse
} from '$lib/api/generated/types.gen';

/**
 * Runtime narrowing for the backend's error bodies (issue #653).
 *
 * Since backend PR #824 the OpenAPI error declarations are honest, so most
 * endpoints type their 4xx bodies as `ErrorDetail`, `ValidationErrorResponse`,
 * or an `anyOf` union of the two. A union has to be *probed* before it is read —
 * `err.detail` on a `ValidationErrorResponse` branch is `undefined`, and reading
 * it unnarrowed is exactly the silent blank-error bug this module exists to
 * prevent. Every guard here is a real predicate: no casts, no `any`.
 *
 * Three shapes arrive in practice:
 *
 * - `{ detail: string }` — `ErrorDetail`, django-ninja's domain refusals.
 * - `{ errors: { field: [msg, …] } }` — `ValidationErrorResponse`, model-level
 *   validation. Values are `string | string[]` per the generated schema.
 * - `{ detail: [{ msg, loc, type }, …] }` — django-ninja's **request**-validation
 *   422. `detail` is a LIST, not a string, and it is *not* `ErrorDetail`. Any
 *   code doing `String(err.detail)` on one renders `[object Object]`; any code
 *   doing `err.detail.toLowerCase()` throws. 422 is systemically under-declared
 *   (backend #826), so it can arrive from an endpoint that does not declare it.
 *
 * A fourth, `{ message: string }` (`ResponseMessage`), is a genuine error body
 * on exactly two endpoints — `POST /events/claim-invitation/{token}` and
 * `POST /organizations/claim-invitation/{token}` — plus assorted 2xx bodies.
 * Everywhere else its declaration was a lie and `.message` was already
 * `undefined` at runtime, so it is probed last.
 */

/** One entry of django-ninja's request-validation 422 `detail` list. */
export interface RequestValidationItem {
	msg: string;
	loc?: (string | number)[];
	type?: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

function nonEmptyString(value: unknown): value is string {
	return typeof value === 'string' && value.trim() !== '';
}

/**
 * Is this the `{ detail: string }` body? Rejects the 422 list shape, which is a
 * different schema that happens to share the key.
 */
export function isErrorDetail(value: unknown): value is ErrorDetail {
	const body = asRecord(value);
	return body !== null && nonEmptyString(body.detail);
}

/**
 * Is this django-ninja's request-validation 422, whose `detail` is a list of
 * `{ msg, loc, type }` objects rather than a string?
 */
export function isRequestValidationError(
	value: unknown
): value is { detail: RequestValidationItem[] } {
	const body = asRecord(value);
	if (!body || !Array.isArray(body.detail) || body.detail.length === 0) return false;
	// EVERY entry must be a readable item, not merely one of them: the predicate
	// promises callers a `RequestValidationItem[]` they can iterate, so a mixed
	// array would make the narrowing a lie — the exact failure mode this module
	// exists to prevent.
	return body.detail.every((item) => {
		const entry = asRecord(item);
		return entry !== null && nonEmptyString(entry.msg);
	});
}

/**
 * Is this the `{ errors: { field: [msg, …] } }` model-validation body?
 *
 * EVERY value must match the declared `string | string[]`, not merely one of
 * them — the predicate promises callers a `ValidationErrorResponse` they can
 * iterate. At least one value must also be readable, so an all-blank map falls
 * through to the caller's own copy instead of rendering as an empty string.
 */
export function isValidationErrorResponse(value: unknown): value is ValidationErrorResponse {
	const body = asRecord(value);
	const errors = body ? asRecord(body.errors) : null;
	if (!errors) return false;
	const values = Object.values(errors);
	if (values.length === 0) return false;
	const wellFormed = values.every(
		(v) => typeof v === 'string' || (Array.isArray(v) && v.every((e) => typeof e === 'string'))
	);
	return (
		wellFormed &&
		values.some((v) => nonEmptyString(v) || (Array.isArray(v) && v.some(nonEmptyString)))
	);
}

/**
 * Is this the `{ message: string }` body? Genuine only on the two
 * claim-invitation endpoints (and on 2xx `ResponseMessage` payloads).
 */
export function isResponseMessage(value: unknown): value is ResponseMessage {
	const body = asRecord(value);
	return body !== null && nonEmptyString(body.message);
}

/** Flatten a `ValidationErrorResponse` into one readable sentence. */
export function extractValidationErrors(error: unknown): string | null {
	if (!isValidationErrorResponse(error)) return null;
	const parts = Object.values(error.errors)
		.flatMap((v) => (Array.isArray(v) ? v : [v]))
		.filter(nonEmptyString);
	return parts.length > 0 ? parts.join(' ') : null;
}

/**
 * Extract the backend's human-readable `detail` from an SDK error envelope
 * (`response.error`) or any raw error body. Handles both `detail` shapes: the
 * plain `{ detail: string }` domain refusal and the request-validation 422
 * `{ detail: [{ msg }, …] }` list. Returns `null` when no readable detail is
 * present so the caller can fall back to a localized generic message.
 */
export function extractApiErrorDetail(error: unknown): string | null {
	if (isErrorDetail(error)) return error.detail;
	if (isRequestValidationError(error)) return error.detail.map((item) => item.msg).join(', ');
	return null;
}

/**
 * Best available human-readable text from any backend error body, probing the
 * shapes in order of how likely they are to be the real one:
 * `detail` (string or 422 list) → `errors` → `message`.
 *
 * `message` is probed last on purpose: it is genuine on only two endpoints, and
 * before backend #824 dozens of endpoints declared it while emitting `detail`.
 * Returns `null` when nothing readable is present so callers can fall back to
 * their own localized copy (house rule: fall back with `||` / `??`).
 */
export function backendMessage(error: unknown): string | null {
	return (
		extractApiErrorDetail(error) ??
		extractValidationErrors(error) ??
		(isResponseMessage(error) ? error.message : null)
	);
}
