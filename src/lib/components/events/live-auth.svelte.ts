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
 * its module doc) with a monotonic, reactive `isAuthenticated`: SSR-seeded
 * `true`, OR the detector has fired. It never lowers on a later `false`
 * observation — the page's SSR data is stale after any mid-page auth change,
 * and a signed-out buyer gets fresh truth on the next navigation/reload.
 *
 * `observe()` forwards the detector's one-shot result so the caller's effect
 * can also run the clear-anonymous-cart branch off the SAME check — the
 * transition must never be consumed twice.
 */
import { createSignInDetector } from './sign-in-detector';

export interface LiveAuth {
	/** Monotonic live truth: seeded SSR `true`, or a sign-in was observed. */
	readonly isAuthenticated: boolean;
	/**
	 * Call on every observation of the live auth store. Returns `true` exactly
	 * once, on the genuine false→true transition (the detector's contract);
	 * flips `isAuthenticated` permanently at that moment.
	 */
	observe(nowAuthenticated: boolean): boolean;
}

export function createLiveAuth(seededAuthenticated: boolean): LiveAuth {
	const detector = createSignInDetector(seededAuthenticated);
	let sawSignIn = $state(false);

	return {
		get isAuthenticated() {
			return seededAuthenticated || sawSignIn;
		},
		observe(nowAuthenticated: boolean): boolean {
			const justSignedIn = detector.check(nowAuthenticated);
			if (justSignedIn) sawSignIn = true;
			return justSignedIn;
		}
	};
}
