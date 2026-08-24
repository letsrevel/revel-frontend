import { describe, it, expect } from 'vitest';
import { createSignInDetector } from './sign-in-detector';

describe('createSignInDetector', () => {
	it('seeded true: bootstrap catch-up (false reads before the live store settles) never fires', () => {
		// Simulates an SSR-authenticated visitor whose client auth store hasn't
		// hydrated yet — authStore.isAuthenticated observes false on the first
		// few checks before the bootstrap-gate refresh lands a token.
		const detector = createSignInDetector(true);

		expect(detector.check(false)).toBe(false);
		expect(detector.check(false)).toBe(false);
		// Bootstrap resolves: the live store catches up to the true seed. This
		// MUST NOT be reported as a sign-in — it's the same visitor the SSR
		// truth already knew was authenticated.
		expect(detector.check(true)).toBe(false);
		// Steady state afterwards stays quiet too.
		expect(detector.check(true)).toBe(false);
	});

	it('seeded false: a genuine false→true transition fires exactly once', () => {
		// Simulates a guest session that signs in mid-cart without a full page
		// reload.
		const detector = createSignInDetector(false);

		expect(detector.check(false)).toBe(false);
		expect(detector.check(false)).toBe(false);
		expect(detector.check(true)).toBe(true);
		// Every subsequent check — including a flap back to false and true
		// again (e.g. a logout/login without reload) — stays quiet: once the
		// transition has been reported, it must never re-fire.
		expect(detector.check(true)).toBe(false);
		expect(detector.check(false)).toBe(false);
		expect(detector.check(true)).toBe(false);
	});

	it('seeded true: staying true from the very first check never fires', () => {
		const detector = createSignInDetector(true);

		expect(detector.check(true)).toBe(false);
		expect(detector.check(true)).toBe(false);
	});

	it('seeded false: staying false never fires', () => {
		const detector = createSignInDetector(false);

		expect(detector.check(false)).toBe(false);
		expect(detector.check(false)).toBe(false);
	});
});
