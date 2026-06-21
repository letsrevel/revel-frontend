/**
 * Resolve a post-auth redirect target, constrained to same-origin relative
 * paths.
 *
 * Guards against open redirects via a crafted `?returnUrl=…`. This matters
 * because a successful login follows `returnUrl` with a full-page
 * `window.location.href` navigation on the client (see
 * `routes/(public)/login/+page.svelte`), so an unvalidated absolute or
 * protocol-relative value would bounce the freshly-authenticated user off-site.
 *
 * Accepts only values that start with a single `/` that is NOT followed by `/`
 * or `\` — i.e. genuine relative paths. Rejects absolute URLs
 * (`https://evil.com`), protocol-relative URLs (`//evil.com`), backslash
 * variants browsers normalise to protocol-relative (`/\evil.com`), and
 * non-path schemes (`javascript:…`). Anything rejected falls back to `fallback`.
 */
export function safeReturnUrl(raw: string | null | undefined, fallback = '/dashboard'): string {
	return raw && /^\/(?![/\\])/.test(raw) ? raw : fallback;
}
