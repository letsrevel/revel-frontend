import { describe, it, expect } from 'vitest';
import { createLiveAuth } from './live-auth.svelte';

describe('createLiveAuth', () => {
	it('seeded true: authenticated from the start, and bootstrap false reads never lower it', () => {
		// SSR-authenticated visitor whose client auth store hasn't hydrated yet:
		// the first several observations of the live store read false.
		const auth = createLiveAuth(true);

		expect(auth.isAuthenticated).toBe(true);
		expect(auth.observe(false)).toBe(false);
		expect(auth.isAuthenticated).toBe(true);
		expect(auth.observe(false)).toBe(false);
		// Bootstrap resolves — not a sign-in.
		expect(auth.observe(true)).toBe(false);
		expect(auth.isAuthenticated).toBe(true);
	});

	it('seeded false: stays guest until a genuine sign-in, then flips authenticated', () => {
		const auth = createLiveAuth(false);

		expect(auth.isAuthenticated).toBe(false);
		expect(auth.observe(false)).toBe(false);
		expect(auth.isAuthenticated).toBe(false);

		// Genuine mid-cart sign-in: observe reports it, and from this point on
		// every checkout decision must treat the buyer as authenticated.
		expect(auth.observe(true)).toBe(true);
		expect(auth.isAuthenticated).toBe(true);
	});

	it('reports the sign-in transition exactly once (no double consumption)', () => {
		const auth = createLiveAuth(false);

		expect(auth.observe(true)).toBe(true);
		expect(auth.observe(true)).toBe(false);
		expect(auth.observe(true)).toBe(false);
		expect(auth.isAuthenticated).toBe(true);
	});

	it('lowers on a false observed AFTER the live store confirmed a session (#869 review)', () => {
		// authStore.logout() runs in place on refresh failure or impersonation
		// expiry, without navigating — the page stays mounted with no token. A
		// false read after a confirmed true is that logout, not bootstrap
		// noise, and checkout branching must stop claiming authenticated (or
		// confirm submits to the authed endpoint with no Authorization header).
		const auth = createLiveAuth(false);

		expect(auth.observe(true)).toBe(true);
		expect(auth.observe(false)).toBe(false);
		expect(auth.isAuthenticated).toBe(false);

		// A later sign-in raises it again (the one-shot transition report
		// stays once-ever — only isAuthenticated recovers).
		expect(auth.observe(true)).toBe(false);
		expect(auth.isAuthenticated).toBe(true);
	});

	it('seeded true: an in-place logout after bootstrap catch-up lowers it (#869 review)', () => {
		const auth = createLiveAuth(true);

		expect(auth.observe(false)).toBe(false); // bootstrap noise
		expect(auth.observe(true)).toBe(false); // catch-up: session confirmed
		expect(auth.isAuthenticated).toBe(true);

		expect(auth.observe(false)).toBe(false); // real logout
		expect(auth.isAuthenticated).toBe(false);
	});

	it('seeded true: a store that NEVER confirms keeps the seed (matches every other SSR read)', () => {
		// Bootstrap-refresh failure: the live store never reaches true. Every
		// false read is indistinguishable from bootstrap noise, so the SSR
		// seed stands — the same stale-true the rest of the page's
		// data.isAuthenticated reads have (pre-existing, out of scope).
		const auth = createLiveAuth(true);

		expect(auth.observe(false)).toBe(false);
		expect(auth.observe(false)).toBe(false);
		expect(auth.isAuthenticated).toBe(true);
	});

	it('seeded true: staying true from the very first observation never fires', () => {
		const auth = createLiveAuth(true);

		expect(auth.observe(true)).toBe(false);
		expect(auth.observe(true)).toBe(false);
		expect(auth.isAuthenticated).toBe(true);
	});
});
