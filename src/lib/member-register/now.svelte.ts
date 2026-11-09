/**
 * A coarse reactive clock. Call during component init: it ticks while the
 * component is mounted and clears its interval on unmount, so time-dependent
 * row rules (e.g. "valid_from has passed") update without a refetch.
 */
export function useNow(intervalMs = 60_000): { readonly current: Date } {
	let ms = $state(Date.now());
	$effect(() => {
		const id = setInterval(() => (ms = Date.now()), intervalMs);
		return () => clearInterval(id);
	});
	return {
		get current() {
			// eslint-disable-next-line svelte/prefer-svelte-reactivity -- read-only snapshot of reactive `ms`, never mutated
			return new Date(ms);
		}
	};
}
