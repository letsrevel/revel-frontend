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

	/**
	 * Sync auth state with server on navigation
	 *
	 * IMPORTANT: This $effect watches data.auth.accessToken and syncs with authStore.
	 * This ensures the UI updates immediately on both login and logout:
	 *
	 * - On logout: Server clears cookies, accessToken becomes null, we clear authStore
	 * - On login: Server sets cookies, accessToken appears, we initialize authStore
	 *
	 * After initial setup, token refresh is handled by:
	 * 1. Client-side API interceptor (catches 401 errors and refreshes)
	 * 2. Client-side auto-refresh timer (proactive refresh before expiry)
	 */
	$effect(() => {
		const serverAccessToken = data.auth.accessToken;
		const currentAccessToken = authStore.accessToken;

		console.log('[ROOT LAYOUT] Auth sync effect triggered', {
			hasServerToken: !!serverAccessToken,
			hasCurrentToken: !!currentAccessToken
		});

		// Case 1: Server has token, but we don't (login or page refresh)
		if (serverAccessToken && !currentAccessToken) {
			console.log('[ROOT LAYOUT] Server provided access token, initializing auth');
			authStore.setAccessToken(serverAccessToken);

			// Fetch user data and permissions
			authStore.initialize().catch((err) => {
				console.error('[ROOT LAYOUT] Auth initialization failed:', err);

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
		// Case 2: Server has no token, but we do (logout)
		else if (!serverAccessToken && currentAccessToken) {
			console.log('[ROOT LAYOUT] No server token, clearing auth state (logout)');
			authStore.logout();
		}
		// Case 3: Both have tokens (normal navigation while authenticated)
		else if (serverAccessToken && currentAccessToken) {
			console.log('[ROOT LAYOUT] Both server and client have tokens (already authenticated)');
			// Token refresh is handled by interceptor and auto-refresh timer
		}
		// Case 4: Neither has token (browsing as guest)
		else {
			console.log('[ROOT LAYOUT] No tokens, user not authenticated');
		}
	});

	// Fetch backend version once on mount
	onMount(async () => {
		console.log('[ROOT LAYOUT] onMount - fetching backend version');
		await appStore.fetchBackendVersion();
	});
</script>

<ModeWatcher />
<QueryClientProvider client={queryClient}>
	<Toaster richColors position="top-right" />
	{@render children()}
</QueryClientProvider>
