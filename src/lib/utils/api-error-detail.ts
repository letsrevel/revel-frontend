/**
 * Extract the backend's human-readable `detail` from an SDK error envelope
 * (`response.error`) or any raw error body. Handles the two shapes
 * django-ninja produces: a plain `{ detail: string }` body (e.g. the
 * price-category duplicate-name and tier-referenced delete guards) and a
 * pydantic-style `{ detail: [{ msg }] }` validation list. Returns `null` when
 * no readable detail is present so the caller can fall back to a localized
 * generic message.
 */
export function extractApiErrorDetail(error: unknown): string | null {
	if (!error || typeof error !== 'object') return null;
	const detail = (error as Record<string, unknown>).detail;
	if (typeof detail === 'string' && detail.trim() !== '') return detail;
	if (Array.isArray(detail)) {
		const messages = detail
			.map((item) =>
				item && typeof item === 'object' && typeof (item as { msg?: unknown }).msg === 'string'
					? (item as { msg: string }).msg
					: null
			)
			.filter((msg): msg is string => msg !== null);
		if (messages.length > 0) return messages.join(', ');
	}
	return null;
}

/**
 * Extract a human-readable error string from a membership/subscription
 * endpoint's error envelope. hey-api types these endpoints' errors as
 * `unknown`, so the shape is probed: Ninja hard-blocks carry `message`,
 * DRF-style payloads carry a string `detail`. Returns null when neither is
 * present so callers can fall back to localized generic copy (house rule:
 * fall back with `||`).
 */
export function backendMessage(error: unknown): string | null {
	if (!error || typeof error !== 'object') return null;
	const body = error as { message?: unknown; detail?: unknown };
	if (typeof body.message === 'string' && body.message) return body.message;
	if (typeof body.detail === 'string' && body.detail) return body.detail;
	return null;
}
