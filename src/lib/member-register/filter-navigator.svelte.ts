import { untrack } from 'svelte';
import { filtersToSearch, type RegisterFilters } from './filters';

export interface FilterNavigatorOptions {
	/** The filters currently reflected by the URL (reactive in the caller). */
	current: () => RegisterFilters;
	/** Performs one navigation to `?qs`. Resolves when the navigation has settled. */
	navigate: (search: string, opts: { replace: boolean }) => Promise<void>;
	/** Called when a navigation rejects; pending state has already been dropped. */
	onError?: (error: unknown) => void;
}

export interface PatchOptions {
	/**
	 * History rule: every filter navigation REPLACES the current entry (so Back
	 * leaves the page rather than stepping through each keystroke or select), except
	 * pagination, which passes `push: true` so Back returns to the previous page.
	 * If any patch coalesced into one navigation asks to push, that navigation pushes.
	 */
	push?: boolean;
}

/**
 * Applies filter PATCHES to the latest intended state and coalesces navigations.
 *
 * `intended` is `pending ?? current()`: what the UI should show right now, even
 * while a `goto` is still in flight and the URL lags behind. While a navigation
 * is in flight, further patches merge into `pending`; when it settles, if
 * `pending` differs from what was just navigated to, ONE more navigation goes
 * to the latest `pending`, otherwise `pending` is cleared. On a rejected
 * navigation `pending` is dropped (the URL is the truth again) and `onError` fires.
 */
export function createFilterNavigator(options: FilterNavigatorOptions) {
	let pending = $state<RegisterFilters | null>(null);
	let inFlight = false;
	let pushRequested = false;

	async function drain(): Promise<void> {
		inFlight = true;
		try {
			while (pending) {
				const search = filtersToSearch(pending);
				const push = pushRequested;
				pushRequested = false;
				await options.navigate(search, { replace: !push });
				if (pending && filtersToSearch(pending) === search) {
					// Settled on what was just sent: drop a push request that coalesced into it,
					// or the next unrelated change would push history (e.g. Next then Prev).
					pending = null;
					pushRequested = false;
				}
			}
		} catch (error) {
			pending = null;
			pushRequested = false;
			options.onError?.(error);
		} finally {
			inFlight = false;
		}
	}

	function patch(change: Partial<RegisterFilters>, opts?: PatchOptions): void {
		// Read untracked: `patch` is called from effects, and tracking `pending` / the
		// URL filters there (while also writing `pending`) would loop the effect.
		const { base, current } = untrack(() => ({
			base: pending ?? options.current(),
			current: options.current()
		}));
		const next: RegisterFilters = { ...base, ...change };
		if (!inFlight && filtersToSearch(next) === filtersToSearch(current)) return;
		pending = next;
		if (opts?.push) pushRequested = true;
		if (!inFlight) void drain();
	}

	return {
		/** The filters the UI should reflect: pending while navigating, else the URL's. */
		get intended(): RegisterFilters {
			return pending ?? options.current();
		},
		/** True while a filter change is queued or in flight (corrections should wait). */
		get isPending(): boolean {
			return pending !== null;
		},
		patch
	};
}
