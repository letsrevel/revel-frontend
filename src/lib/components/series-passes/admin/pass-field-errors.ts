import { extractFieldErrors } from '$lib/utils/errors';

/**
 * Flatten a backend validation error into one message per form field.
 *
 * Ninja nests the request body under `payload` (`payload.tier_links.0.tier`), so a
 * leading `payload.` is stripped; every `tier_links*` key lands on the coverage
 * control as `tier_links`. Several messages that map to one key are concatenated,
 * never overwritten.
 */
export function toPassFieldErrors(error: unknown): Record<string, string> {
	const out: Record<string, string> = {};
	for (const { field, messages } of extractFieldErrors(error)) {
		const bare = field.replace(/^payload\./, '');
		const key = bare.startsWith('tier_links') ? 'tier_links' : bare;
		const joined = messages.join(' ');
		out[key] = out[key] ? `${out[key]} ${joined}` : joined;
	}
	return out;
}
