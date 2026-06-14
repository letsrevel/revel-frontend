/**
 * Runtime CSP helpers.
 *
 * The CSP in svelte.config.js is generated at BUILD time and cannot know the
 * backend API origin, which is configured at RUNTIME via PUBLIC_API_URL (#396).
 * `appendCspApiOrigin` augments the build-time policy with the runtime origin so
 * a single prebuilt image works against any backend.
 */

/** Directives that must allow the backend API origin (fetches, images, media). */
export const CSP_API_DIRECTIVES = new Set(['img-src', 'media-src', 'connect-src']);

/**
 * Append `origin` to the API-dependent directives of a CSP header value.
 *
 * Returns the original string unchanged when `origin` is not an http(s) origin or
 * when every target directive already lists it, so callers can cheaply detect a
 * no-op. Directives not in {@link CSP_API_DIRECTIVES} are preserved verbatim
 * (including the SvelteKit script nonce).
 */
export function appendCspApiOrigin(csp: string, origin: string): string {
	if (!/^https?:\/\//.test(origin)) return csp;

	return csp
		.split(';')
		.map((directive) => {
			const trimmed = directive.trim();
			if (!trimmed) return '';
			const tokens = trimmed.split(/\s+/);
			const name = tokens[0];
			if (CSP_API_DIRECTIVES.has(name) && !tokens.includes(origin)) {
				return `${trimmed} ${origin}`;
			}
			return trimmed;
		})
		.filter(Boolean)
		.join('; ');
}
