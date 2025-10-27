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
	 * Initialize authentication on mount
	 *
	 * IMPORTANT: We initialize auth ONCE on mount with the server-provided token.
	 * After that, token refresh is handled entirely by:
	 * 1. Client-side API interceptor (catches 401 errors and refreshes)
	 * 2. Client-side auto-refresh timer (proactive refresh before expiry)
	 *
	 * We don't try to sync with server data on every navigation because:
	 * - It causes race conditions with the refresh mechanisms
	 * - Server data is stale (only updated on SSR, not client navigation)
	 * - The refresh endpoint already updates cookies server-side
	 */
	onMount(async () => {
		console.log('[ROOT LAYOUT] onMount - initializing app');

		// Initialize auth if we have a server-provided token
		const accessToken = data.auth.accessToken;
		if (accessToken) {
			console.log('[ROOT LAYOUT] Server provided access token, initializing auth');
			authStore.setAccessToken(accessToken);

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
		} else {
			console.log('[ROOT LAYOUT] No server token, user not authenticated');
		}

		// Fetch backend version
		await appStore.fetchBackendVersion();
	});
</script>

<ModeWatcher />
<QueryClientProvider client={queryClient}>
	<Toaster richColors position="top-right" />
	{@render children()}
</QueryClientProvider>
