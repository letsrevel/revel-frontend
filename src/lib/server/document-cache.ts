import type { Handle } from '@sveltejs/kit';

/**
 * Documents default to `private, no-cache` when no route claimed otherwise.
 *
 * Without an explicit Cache-Control, browsers apply HEURISTIC caching to SSR
 * HTML — iOS Safari in particular restores such documents across deploys, and
 * the stale document then references hashed assets the new deploy no longer
 * ships: the page renders unstyled until a manual reload (with Safari offering
 * to "reduce privacy protections" over it). `no-cache` still allows storing
 * but forces revalidation, so every deploy is picked up on the next view.
 *
 * Only-if-absent on purpose: feeds, sitemaps, oembed and the /embed shell set
 * their own public caching, and the Caddy vhosts use the same only-if-absent
 * operator (`?Cache-Control`) so the two layers never fight.
 */
export const handleDocumentCacheControl: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	if (
		response.headers.get('content-type')?.includes('text/html') &&
		!response.headers.has('cache-control')
	) {
		response.headers.set('cache-control', 'private, no-cache');
	}
	return response;
};
