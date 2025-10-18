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
		children: import('svelte').Snippet;
	}

	let { data, children }: Props = $props();

	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: 60 * 1000 // 1 minute
			}
		}
	});

	// Reactively sync auth store with server-provided token
	// This handles login, logout, and token refresh during SPA navigation
	$effect(() => {
		const accessToken = data.auth.accessToken;
		const currentToken = authStore.accessToken;

		console.log('[ROOT LAYOUT] Auth sync effect running', {
			hasServerToken: !!accessToken,
			hasClientToken: !!currentToken,
			isAuthenticated: authStore.isAuthenticated,
			serverTokenLength: accessToken?.length || 0
		});

		// Case 1: Server has token, client doesn't (or tokens are different) - Login/Token refresh
		if (accessToken && accessToken !== currentToken) {
			console.log('[ROOT LAYOUT] Syncing token from server');
			authStore.setAccessToken(accessToken);

			// Initialize auth (will fetch user data)
			console.log('[ROOT LAYOUT] Starting auth initialization');
			authStore.initialize().catch((err) => {
				// Check if ad blocker is blocking the request
				if (err instanceof TypeError && err.message === 'Failed to fetch') {
					import('svelte-sonner').then(({ toast }) => {
						toast.error('API Blocked', {
							description: 'Please disable your ad blocker for localhost:8000 to use all features.',
							duration: 10000
						});
					});
				}
			});
		}
		// Case 2: Server has no token, but client still has auth state - Logout
		else if (!accessToken && authStore.isAuthenticated) {
			console.log('[ROOT LAYOUT] Server token cleared, logging out client');
			authStore.logout();
		}
	});

	// Initialize app on mount (one-time setup)
	onMount(async () => {
		console.log('[ROOT LAYOUT] onMount - fetching backend version');
		// Fetch backend version
		await appStore.fetchBackendVersion();
	});
</script>

<ModeWatcher />
<QueryClientProvider client={queryClient}>
	<Toaster richColors position="top-right" />
	{@render children()}
</QueryClientProvider>
