<script lang="ts">
	import { QueryClientProvider, type QueryClient } from '@tanstack/svelte-query';
	import type { Component } from 'svelte';

	// Test-only wrapper: nests the component under test inside a real
	// <QueryClientProvider> so `useQueryClient()`/`createMutation` resolve the
	// client from Svelte context. Passing a component as the provider's
	// `children` prop (the older test pattern) does not propagate context under
	// @tanstack/svelte-query v6 — the child must be a true template child.
	let {
		client,
		component,
		props = {}
	}: {
		client: QueryClient;
		component: Component;
		props?: Record<string, unknown>;
	} = $props();

	const Child = $derived(component);
</script>

<QueryClientProvider {client}>
	<Child {...props} />
</QueryClientProvider>
