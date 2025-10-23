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
				staleTime: 60 * 1000, // 1 minute
				retry: (failureCount, error) => {
					// Don't retry on 401 (unauthorized) - these need user action, not retries
					if (error && typeof error === 'object' && 'status' in error && error.status === 401) {
						return false;
					}
					// Don't retry on 403 (forbidden) - permission errors won't resolve by retrying
					if (error && typeof error === 'object' && 'status' in error && error.status === 403) {
						return false;
					}
					// Retry other errors up to 2 times
					return failureCount < 2;
				},
				refetchOnWindowFocus: false // Prevent automatic refetches that could trigger auth loops
			}
		}
	});

	// Track initialization state to prevent multiple simultaneous initializations
	let isInitialized = $state(false);
	let lastKnownToken = $state<string | null>(null);

	// Reactively sync auth store with server-provided token
	// This handles login, logout, and token refresh during SPA navigation
	$effect(() => {
		const accessToken = data.auth.accessToken;

		console.log('[ROOT LAYOUT] Auth sync effect running', {
			hasServerToken: !!accessToken,
			isInitialized,
			lastKnownToken: lastKnownToken?.slice(0, 20) + '...',
			currentTokenPrefix: accessToken?.slice(0, 20) + '...',
			tokensMatch: accessToken === lastKnownToken
		});

		// Case 1: Server has token and it's different from last known token
		if (accessToken && accessToken !== lastKnownToken) {
			console.log('[ROOT LAYOUT] New token detected, initializing auth');
			lastKnownToken = accessToken;
			authStore.setAccessToken(accessToken);

			// Only initialize if we haven't already
			if (!isInitialized) {
				console.log('[ROOT LAYOUT] First initialization');
				isInitialized = true;
				authStore.initialize().catch((err) => {
					console.error('[ROOT LAYOUT] Auth initialization failed:', err);
					isInitialized = false; // Reset on failure

					// Check if ad blocker is blocking the request
					if (err instanceof TypeError && err.message === 'Failed to fetch') {
						import('svelte-sonner').then(({ toast }) => {
							toast.error('API Blocked', {
								description:
									'Please disable your ad blocker for localhost:8000 to use all features.',
								duration: 10000
							});
						});
					}
				});
			} else {
				console.log('[ROOT LAYOUT] Already initialized, skipping initialize()');
			}
		}
		// Case 2: Server has no token, but client still has auth state - Logout
		else if (!accessToken && authStore.isAuthenticated) {
			console.log('[ROOT LAYOUT] Server token cleared, logging out client');
			lastKnownToken = null;
			isInitialized = false;
			authStore.logout();
		}
		// Case 3: Token hasn't changed - do nothing
		else if (accessToken === lastKnownToken) {
			console.log('[ROOT LAYOUT] Token unchanged, skipping re-initialization');
		}
		// Case 4: No tokens anywhere - user is not authenticated
		// No action needed - user will see public pages or be redirected by route guards
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
