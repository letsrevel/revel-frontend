/**
 * Login-mid-cart transition detector (#853 Task 5, fixed post-review). Pure,
 * rune-free state machine: reports a genuine false→true transition on the
 * LIVE auth store exactly once, and never on the bootstrap catch-up of an
 * already-authenticated visitor.
 *
 * The trap this exists to avoid: `wasAuthenticated` is seeded from the SSR
 * truth (`data.isAuthenticated`), which is reliable, but the first several
 * `check()` calls may observe `authStore.isAuthenticated` still `false`
 * while the client auth store's bootstrap-gate refresh is in flight (see
 * `auth.svelte.ts`) — even for a genuinely authenticated visitor. A bare
 * `wasAuthenticated = nowAuthenticated` assignment on every call would let
 * that stale `false` read clobber the `true` SSR seed; the eventual
 * bootstrap resolution (`false` → `true`) would then look EXACTLY like a
 * guest logging in, and wipe a real authenticated buyer's cart mid-checkout.
 *
 * The fix: `wasAuthenticated` can only ever move false → true, never back —
 * `check()` writes `true` when it observes `true`, and leaves a `true` seed
 * alone when it observes `false`. So the SSR-seeded `true` survives any
 * number of `false` reads before the live store catches up, and a
 * genuinely-guest session (seeded `false`) still fires exactly once on its
 * first real sign-in.
 */
export function createSignInDetector(seededAuthenticated: boolean) {
	let wasAuthenticated = seededAuthenticated;

	return {
		/**
		 * Call on every observation of the live auth state. Returns `true`
		 * exactly on a genuine false→true transition (never on a bootstrap
		 * catch-up read, never on a repeated `true`, never on `false`).
		 */
		check(nowAuthenticated: boolean): boolean {
			const justSignedIn = nowAuthenticated && !wasAuthenticated;
			if (nowAuthenticated) wasAuthenticated = true;
			return justSignedIn;
		}
	};
}
