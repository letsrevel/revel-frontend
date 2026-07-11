/**
 * Create a debounced state value that updates after the specified delay.
 * The getter function must read the source reactive state synchronously
 * to register the Svelte dependency.
 *
 * @param getter - Function that returns the source state to debounce
 * @param delay - Delay in milliseconds (default 300)
 */
export function createDebouncedState<T>(getter: () => T, delay = 300) {
	let debounced = $state(getter());

	$effect(() => {
		const query = getter();
		const timer = setTimeout(() => {
			debounced = query;
		}, delay);
		return () => clearTimeout(timer);
	});

	return {
		get value() {
			return debounced;
		}
	};
}
