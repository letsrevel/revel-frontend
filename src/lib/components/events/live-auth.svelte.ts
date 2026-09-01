/**
 * Live authentication truth for the cart purchase flow (#853, Copilot finding
 * on #863). The page's SSR `data.isAuthenticated` is a trustworthy per-request
 * seed but static for the page's lifetime — a guest who signs in without a
 * full reload (login in another tab, client-side navigation back) would keep
 * being branched as a guest by every checkout decision that captured it:
 * `needsSheet` would force the sheet, and confirm would check out via the
 * guest controller (`/checkout/public`) with a stale anonymous identity.
 *
 * This wraps `createSignInDetector` (which reports the genuine false→true
 * transition exactly once, immune to the auth-store bootstrap catch-up — see
 * its module doc) with a reactive `isAuthenticated`: SSR-seeded `true`, OR
 * the detector has fired. The seed survives bootstrap noise (`false` reads
 * before the live store hydrates), but a `false` observed AFTER the live
 * store has confirmed a session is a real in-place logout —
 * `authStore.logout()` runs without navigating on refresh failure and
 * impersonation-token expiry — and lowers the value, so confirm can't submit
 * to the authenticated endpoint with no token (#869 review). A store that
 * never confirms keeps the seed: that read is indistinguishable from
 * bootstrap noise, and matches every other `data.isAuthenticated` read on
 * the page. A sign-in after a lowering raises `isAuthenticated` again, but
 * the one-shot transition report stays once-ever (the clear-anonymous-cart
 * branch fires only on the FIRST sign-in — a guest cart rebuilt after a
 * logout-then-relogin on the same mounted page is a residual edge).
 *
 * `observe()` forwards the detector's one-shot result so the caller's effect
 * can also run the clear-anonymous-cart branch off the SAME check — the
 * transition must never be consumed twice.
 */
import { createSignInDetector } from './sign-in-detector';

export interface LiveAuth {
	/** Live truth: seeded SSR `true` or an observed sign-in, lowered again by
	 * a `false` observed after the live store confirmed a session. */
	readonly isAuthenticated: boolean;
	/**
	 * Call on every observation of the live auth store. Returns `true` exactly
	 * once, on the genuine false→true transition (the detector's contract).
	 */
	observe(nowAuthenticated: boolean): boolean;
}

export function createLiveAuth(seededAuthenticated: boolean): LiveAuth {
	const detector = createSignInDetector(seededAuthenticated);
	let sawSignIn = $state(false);
	// The live store confirmed a session at least once — from then on a false
	// read is a real logout, not bootstrap noise. Plain field: only ever read
	// inside observe(), never from a reactive context.
	let sessionConfirmed = false;
	let signedOut = $state(false);

	return {
		get isAuthenticated() {
			if (signedOut) return false;
			return seededAuthenticated || sawSignIn;
		},
		observe(nowAuthenticated: boolean): boolean {
			const justSignedIn = detector.check(nowAuthenticated);
			if (justSignedIn) sawSignIn = true;
			if (nowAuthenticated) {
				sessionConfirmed = true;
				signedOut = false;
			} else if (sessionConfirmed) {
				signedOut = true;
			}
			return justSignedIn;
		}
	};
}
