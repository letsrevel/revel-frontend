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

	it('is monotonic: a later false observation (logout without reload) never lowers it', () => {
		const auth = createLiveAuth(false);

		expect(auth.observe(true)).toBe(true);
		// Flap back to false and true again — the detector stays quiet and the
		// live flag never drops (the page's SSR data is stale either way; a
		// signed-out buyer gets fresh truth on the next navigation/reload).
		expect(auth.observe(false)).toBe(false);
		expect(auth.isAuthenticated).toBe(true);
		expect(auth.observe(true)).toBe(false);
		expect(auth.isAuthenticated).toBe(true);
	});

	it('seeded true: staying true from the very first observation never fires', () => {
		const auth = createLiveAuth(true);

		expect(auth.observe(true)).toBe(false);
		expect(auth.observe(true)).toBe(false);
		expect(auth.isAuthenticated).toBe(true);
	});
});
