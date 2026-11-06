import { resolve } from '$app/paths';

// Whitespace and C0/C1 control characters, forbidden anywhere in a return URL.
// The URL parser (and browsers following a `Location` header) strip tab/newline
// before scheme detection, so `/\t//evil` would resolve to `https://evil/`.
// Mirrors the backend regex
// (`^/(?:[^/\\\s\x00-\x1f\x7f-\x9f][^\s\x00-\x1f\x7f-\x9f]*)?$`).
// eslint-disable-next-line no-control-regex
const FORBIDDEN_IN_RETURN_URL = /[\s\u0000-\u001f\u007f-\u009f]/;

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
 * non-path schemes (`javascript:…`), and any value containing whitespace or a
 * C0/C1 control character anywhere (`/\t//evil` — the URL parser strips the
 * tab and resolves it protocol-relative). Anything rejected falls back to
 * `fallback`.
 */
export function safeReturnUrl(raw: string | null | undefined, fallback = '/dashboard'): string {
	return raw && /^\/(?![/\\])/.test(raw) && !FORBIDDEN_IN_RETURN_URL.test(raw) ? raw : fallback;
}

/** Mirrors the backend's `RegisterUserSchema.return_url` `max_length`. */
export const RETURN_URL_MAX_LENGTH = 2048;

/**
 * The value to send as `return_url` on registration, or `null` to omit it.
 *
 * Stricter than `safeReturnUrl` on purpose: the backend answers 422 to a
 * `return_url` it dislikes, and that 422 fails the WHOLE registration. A
 * value we would not redirect to, or that the backend would refuse, is
 * dropped silently and the user simply registers without a return target.
 */
export function registrationReturnUrl(raw: string | null | undefined): string | null {
	if (!raw || raw.length > RETURN_URL_MAX_LENGTH) return null;
	if (safeReturnUrl(raw, '') === '') return null;
	return raw;
}

/**
 * `href` with `?returnUrl=<encoded>` appended when `returnUrl` is a safe
 * relative path; `href` unchanged otherwise. `href` must not already carry
 * a query string (every caller passes a bare `resolve()` result).
 */
export function withReturnUrl(href: string, returnUrl: string | null | undefined): string {
	const safe = safeReturnUrl(returnUrl, '');
	return safe ? `${href}?returnUrl=${encodeURIComponent(safe)}` : href;
}

/**
 * The sign-in link: `/login?returnUrl=<returnUrl>[&email=<email>]`. This is the
 * ONE way to build a login href; never hand-build the query (the login action
 * only reads `returnUrl` and `email`; `?next=` / `?redirect=` are silently
 * ignored and strand the user on the dashboard). An unsafe or empty
 * `returnUrl` is dropped (see `withReturnUrl`). `email` prefills the form.
 */
export function loginHref(returnUrl?: string | null, opts: { email?: string | null } = {}): string {
	const href = withReturnUrl(resolve('/(public)/login', {}), returnUrl);
	const email = opts.email?.trim();
	if (!email) return href;
	return `${href}${href.includes('?') ? '&' : '?'}email=${encodeURIComponent(email)}`;
}

/** `loginHref` back to the given page (path + query): pass `page.url`. */
export function loginHrefFor(
	url: Pick<URL, 'pathname' | 'search'>,
	opts: { email?: string | null } = {}
): string {
	return loginHref(url.pathname + url.search, opts);
}

// Auth-flow pages: returning to them after signing in is a loop or a dead end.
const AUTH_FLOW_PATH =
	/^\/(login|register|logout|password-reset|verify|account\/confirm-email-change)(\/|$)/;

/**
 * The header/nav "Log in" link. Returns to the current page, except:
 * - on `/` it stays bare, so login keeps its default landing (the dashboard);
 * - on an auth-flow page it forwards that page's own `?returnUrl=` instead,
 *   so register → "Log in" keeps the original destination.
 */
export function navLoginHref(url: Pick<URL, 'pathname' | 'search' | 'searchParams'>): string {
	if (url.pathname === '/') return loginHref();
	if (AUTH_FLOW_PATH.test(url.pathname)) return loginHref(url.searchParams.get('returnUrl'));
	return loginHrefFor(url);
}
