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

/**
 * Replace `frame-ancestors` with `*` so a document may be framed by anyone.
 *
 * The app-wide policy is `frame-ancestors 'none'` (clickjacking defence) and it
 * is baked in at build time, so the embed carve-out has to happen per response
 * — see `handleCsp` in `src/hooks.server.ts`. This is deliberately unrestricted
 * rather than a per-organization domain allowlist: embed pages are public,
 * read-only and anonymous, they carry no credentials and expose nothing a
 * scraper could not already fetch, so an allowlist would add operational cost
 * without adding a security property.
 *
 * If the policy carries no `frame-ancestors` directive the value is returned
 * unchanged — never synthesised — so this can only ever loosen a directive that
 * was already there.
 */
export function relaxCspFrameAncestors(csp: string): string {
	let found = false;
	const relaxed = csp
		.split(';')
		.map((directive) => {
			const trimmed = directive.trim();
			if (!trimmed) return '';
			if (trimmed.split(/\s+/)[0] !== 'frame-ancestors') return trimmed;
			found = true;
			return 'frame-ancestors *';
		})
		.filter(Boolean)
		.join('; ');

	return found ? relaxed : csp;
}
