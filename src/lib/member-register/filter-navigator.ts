import { filtersToSearch, type RegisterFilters } from './filters';

export interface FilterNavigatorOptions {
	/** The filters currently reflected by the URL. */
	current: () => RegisterFilters;
	/** Performs one navigation to `?qs`. Resolves when the navigation has settled. */
	navigate: (search: string, opts: { replace: boolean }) => Promise<void>;
	/** Called once every queued navigation has settled (URL is the truth again). */
	onSettled?: () => void;
}

/**
 * Applies filter patches to the LATEST intended state and serialises the
 * navigations. A second change fired before the first navigation settles is
 * merged onto the first (not onto the stale URL-derived filters), and the
 * navigations run one after the other, so the URL always ends up holding the
 * combined result.
 */
export function createFilterNavigator(options: FilterNavigatorOptions) {
	let pending: RegisterFilters | null = null;
	let queued = 0;
	let chain: Promise<void> = Promise.resolve();

	function apply(patch: Partial<RegisterFilters>, opts?: { replace?: boolean }): void {
		const next: RegisterFilters = { ...(pending ?? options.current()), ...patch };
		pending = next;
		const search = filtersToSearch(next);
		queued += 1;
		chain = chain
			.then(() => options.navigate(search, { replace: opts?.replace ?? false }))
			.catch(() => undefined)
			.then(() => {
				queued -= 1;
				if (queued === 0) {
					pending = null;
					options.onSettled?.();
				}
			});
	}

	return { apply };
}
