import { describe, expect, it, vi } from 'vitest';
import { createFilterNavigator } from './filter-navigator.svelte';
import { DEFAULT_FILTERS, type RegisterFilters } from './filters';

function deferred(): { promise: Promise<void>; resolve: () => void } {
	let resolve!: () => void;
	const promise = new Promise<void>((r) => (resolve = r));
	return { promise, resolve };
}

describe('createFilterNavigator', () => {
	it('drops a push request that coalesced into the in-flight state (Next then Prev)', async () => {
		let url: RegisterFilters = { ...DEFAULT_FILTERS };
		const first = deferred();
		const navigate = vi
			.fn<(search: string, opts: { replace: boolean }) => Promise<void>>()
			.mockImplementationOnce(async () => {
				await first.promise;
				url = { ...url, open: 'open' };
			})
			.mockResolvedValue(undefined);
		const nav = createFilterNavigator({ current: () => url, navigate });

		nav.patch({ open: 'open' }); // nav 1 in flight (replace)
		nav.patch({ page: 2 }, { push: true }); // Next, mid-flight
		nav.patch({ page: 1 }, { push: true }); // Prev: back to what nav 1 sends
		first.resolve();
		await vi.waitFor(() => expect(nav.isPending).toBe(false));
		expect(navigate).toHaveBeenCalledTimes(1);

		nav.patch({ kind: 'temporary' }); // an unrelated filter change must REPLACE
		await vi.waitFor(() => expect(navigate).toHaveBeenCalledTimes(2));
		expect(navigate.mock.calls[1][1]).toEqual({ replace: true });
	});

	it('exposes isPending while a change is queued or in flight', async () => {
		const gate = deferred();
		const nav = createFilterNavigator({
			current: () => ({ ...DEFAULT_FILTERS }),
			navigate: () => gate.promise
		});
		expect(nav.isPending).toBe(false);
		nav.patch({ open: 'closed' });
		expect(nav.isPending).toBe(true);
		gate.resolve();
		// Settled on exactly what was sent: nothing is pending any more.
		await vi.waitFor(() => expect(nav.isPending).toBe(false));
	});
});
