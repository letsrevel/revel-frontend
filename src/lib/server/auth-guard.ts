/**
 * Decision helpers for the `(auth)` route-group guard in `hooks.server.ts`.
 *
 * Extracted from the hook itself purely so they can be unit-tested: importing
 * `hooks.server.ts` runs its module side effects (the Prometheus listener, the
 * env-dependent API config), which a test has no business booting.
 *
 * NOT a security boundary — see `handleAuthGuard`'s note. The backend is the
 * sole authority on access; this only decides where to point the browser.
 */

/**
 * Route-group prefix shared by every authenticated page.
 *
 * `event.route.id` carries the route GROUP, so for
 * `src/routes/(auth)/account/memberships/+page.svelte` it is
 * `/(auth)/account/memberships`. Matching on that means the guard tracks the
 * directory layout: moving a page into or out of `(auth)` changes its
 * protection with it, and there is no hand-maintained path list to forget.
 */
export const AUTH_ROUTE_ID_PREFIX = '/(auth)';

/**
 * Does this route live in the authenticated group?
 *
 * `routeId` is `null` when SvelteKit matched no route (static assets, 404s) —
 * those are not protected, and must not be, or unmatched URLs would bounce to
 * login instead of rendering the error page.
 */
export function requiresAuth(routeId: string | null | undefined): boolean {
	return routeId?.startsWith(AUTH_ROUTE_ID_PREFIX) ?? false;
}

/**
 * Where to send a guest who asked for a protected page.
 *
 * The target is carried in `?returnUrl=` because that is the parameter the
 * login page's own actions already read back — through `safeReturnUrl`, which
 * rejects absolute and protocol-relative values so a crafted link cannot bounce
 * a freshly-authenticated user off-site. The 2FA step preserves it too, so the
 * round trip survives a second factor.
 *
 * `search` is included so notification deep links keep their query string.
 * Encoding it is what keeps a `returnUrl` containing its own `?`/`&` from being
 * re-parsed as sibling parameters on the login URL.
 */
export function loginRedirectPath(url: { pathname: string; search: string }): string {
	return `/login?returnUrl=${encodeURIComponent(`${url.pathname}${url.search}`)}`;
}
