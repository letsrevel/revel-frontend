import type { ParamMatcher } from '@sveltejs/kit';

/**
 * Matches lowercase UUIDs — the exact shape backend #849 puts in Stripe
 * success/cancel return URLs (`str(uuid)`). Lowercase-only on purpose:
 * slugs are lowercase too, and the narrower the match, the smaller the
 * (already negligible) chance of a slug being mistaken for a UUID.
 */
export const match: ParamMatcher = (param) =>
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(param);
