import { describe, it, expect } from 'vitest';
import { requiresAuth, loginRedirectPath, AUTH_ROUTE_ID_PREFIX } from './auth-guard';
import { safeReturnUrl } from '$lib/utils/safe-redirect';

describe('requiresAuth', () => {
	// Pins the literal SvelteKit route-group id. If the `(auth)` directory is
	// ever renamed, this fails loudly here instead of silently unprotecting all
	// ~60 pages in the group — the guard would just stop matching and every
	// authenticated route would start serving guests again.
	it('pins the route-group prefix to the (auth) directory', () => {
		expect(AUTH_ROUTE_ID_PREFIX).toBe('/(auth)');
	});

	it.each([
		'/(auth)/account/memberships',
		'/(auth)/dashboard',
		'/(auth)/org/[slug]/admin',
		'/(auth)/org/[slug]/admin/venues/[venue_id]/designer'
	])('protects %s', (routeId) => {
		expect(requiresAuth(routeId)).toBe(true);
	});

	it.each(['/(public)/login', '/(public)/org/[slug]', '/(public)/events/[id]', '/'])(
		'leaves %s public',
		(routeId) => {
			expect(requiresAuth(routeId)).toBe(false);
		}
	);

	// `event.route.id` is null when SvelteKit matched nothing. Redirecting those
	// would send every 404 and static-asset miss to the login page rather than
	// the error page — and, for a guest, would make the whole site look
	// login-walled the moment they hit a dead link.
	it.each([null, undefined])('does not protect an unmatched route (%s)', (routeId) => {
		expect(requiresAuth(routeId)).toBe(false);
	});

	// A public route whose path merely CONTAINS the group name must not match:
	// the prefix is anchored at the start of the id, not searched for.
	it('does not match a route that merely contains the group name', () => {
		expect(requiresAuth('/(public)/docs/(auth)/overview')).toBe(false);
	});
});

describe('loginRedirectPath', () => {
	it('sends the visitor to login carrying where they were going', () => {
		expect(loginRedirectPath({ pathname: '/account/memberships', search: '' })).toBe(
			'/login?returnUrl=%2Faccount%2Fmemberships'
		);
	});

	// The seven subscription_* notification CTAs land here with tracking params;
	// dropping the query would lose them, and interpolating it RAW would let its
	// own `?`/`&` be re-parsed as sibling params on the login URL.
	it('encodes the query string instead of leaking it into the login URL', () => {
		const path = loginRedirectPath({
			pathname: '/account/memberships',
			search: '?utm_source=email&utm_campaign=dunning'
		});
		expect(path).toBe(
			'/login?returnUrl=%2Faccount%2Fmemberships%3Futm_source%3Demail%26utm_campaign%3Ddunning'
		);
		// Exactly one real parameter on the login URL — the rest is inside it.
		expect([...new URL(path, 'https://x.test').searchParams.keys()]).toEqual(['returnUrl']);
	});

	/**
	 * The two halves of the round trip have to agree: this builds `returnUrl`,
	 * and the login page's actions read it back through `safeReturnUrl`, which
	 * rejects anything that is not a same-origin relative path. A value this
	 * function produces must survive that check, or the guard would silently
	 * dump every redirected visitor on `/dashboard` instead of the page the
	 * notification pointed them at.
	 */
	it.each([
		['/account/memberships', ''],
		['/dashboard', ''],
		['/org/some-org/admin/members', '?tab=payments'],
		['/account/memberships', '?utm_source=email']
	])('round-trips %s%s through safeReturnUrl', (pathname, search) => {
		const built = loginRedirectPath({ pathname, search });
		const returned = new URL(built, 'https://x.test').searchParams.get('returnUrl');
		expect(safeReturnUrl(returned)).toBe(`${pathname}${search}`);
	});
});
