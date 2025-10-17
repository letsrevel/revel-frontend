<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { ModeWatcher } from 'mode-watcher';
	import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';
	import { authStore } from '$lib/stores/auth.svelte';
	import { appStore } from '$lib/stores/app.svelte';
	import { Toaster } from 'svelte-sonner';
	import type { LayoutData } from './$types';

	interface Props {
		data: LayoutData;
	}

	let { data }: Props = $props();

	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: 60 * 1000 // 1 minute
			}
		}
	});

	// Initialize app on mount
	onMount(async () => {
		// If we have an access token from server, set it in auth store
		if (data.auth.accessToken) {
			authStore.setAccessToken(data.auth.accessToken);
		}

		// Initialize auth (will fetch user data if access token exists)
		await authStore.initialize();

		// Fetch backend version
		await appStore.fetchBackendVersion();
	});
</script>

<ModeWatcher />
<QueryClientProvider client={queryClient}>
	<Toaster richColors position="top-right" />
	<slot />
</QueryClientProvider>
