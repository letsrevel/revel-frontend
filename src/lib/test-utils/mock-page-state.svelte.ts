/**
 * A reactive stand-in for `$app/state`'s `page`, for tests that must change route
 * params on a mounted component (SvelteKit reuses the component across params).
 * Usage: `vi.mock('$app/state', async () => ({ page: (await import('$lib/test-utils/mock-page-state.svelte')).createMockPage(...) }))`.
 */
export function createMockPage(initial: {
	params: Record<string, string>;
	url: URL;
	data?: Record<string, unknown>;
}) {
	const state = $state({ params: initial.params, url: initial.url, data: initial.data ?? {} });
	return state;
}
