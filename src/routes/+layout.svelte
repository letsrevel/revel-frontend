<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { ModeWatcher } from 'mode-watcher';
	import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';
	import { authStore } from '$lib/stores/auth.svelte';
	import { appStore } from '$lib/stores/app.svelte';
	import { Toaster, toast } from 'svelte-sonner';
	import { extractErrorMessage, isAuthError } from '$lib/utils/errors';
	import DemoBanner from '$lib/components/common/DemoBanner.svelte';
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
			},
			mutations: {
				// Global error handler for all mutations
				// Individual mutations can override this with their own onError
				onError: (error: unknown) => {
					// Skip auth errors (401/403) - these are handled by the auth interceptor
					if (isAuthError(error)) {
						return;
					}

					// Extract user-friendly error message
					const message = extractErrorMessage(error);

					// Show toast notification to user
					toast.error('Action failed', {
						description: message
					});
				}
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
	let previousServerToken = $state<string | null>(null);
	let initializationPromise = $state<Promise<void> | null>(null);

	$effect(() => {
		const serverAccessToken = data.auth.accessToken;
		const hasRefreshToken = data.auth.hasRefreshToken;
		const currentAccessToken = authStore.accessToken;

		// Only trigger effect if the server token has actually changed
		if (serverAccessToken === previousServerToken) {
			return;
		}

		console.log('[ROOT LAYOUT] Auth sync effect triggered', {
			hasServerToken: !!serverAccessToken,
			hasRefreshToken,
			hasCurrentToken: !!currentAccessToken,
			previousServerToken: !!previousServerToken
		});

		previousServerToken = serverAccessToken;

		// Case 1: Server has token, but we don't (login or page refresh)
		if (serverAccessToken && !currentAccessToken) {
			console.log('[ROOT LAYOUT] Server provided access token, initializing auth');
			authStore.setAccessToken(serverAccessToken);

			// Prevent multiple simultaneous initializations
			if (!initializationPromise) {
				// Fetch user data and permissions
				initializationPromise = authStore
					.initialize()
					.catch((err) => {
						console.error('[ROOT LAYOUT] Auth initialization failed:', err);

						// Check if ad blocker is blocking the request
						if (err instanceof TypeError && err.message === 'Failed to fetch') {
							import('$lib/config/api').then(({ API_BASE_URL_DISPLAY }) => {
								import('svelte-sonner').then(({ toast }) => {
									toast.error('API Blocked', {
										description: `Please disable your ad blocker for ${API_BASE_URL_DISPLAY} to use all features.`,
										duration: 10000
									});
								});
							});
						}
					})
					.finally(() => {
						initializationPromise = null;
					});
			}
		}
		// Case 2: Server has no token, but we do (logout)
		else if (!serverAccessToken && currentAccessToken) {
			console.log('[ROOT LAYOUT] No server token, clearing auth state (logout)');
			authStore.logout();
			initializationPromise = null;
		}
		// Case 3: Both have tokens (normal navigation while authenticated)
		else if (serverAccessToken && currentAccessToken) {
			console.log('[ROOT LAYOUT] Both server and client have tokens (already authenticated)');
			// Token refresh is handled by interceptor and auto-refresh timer
		}
		// Case 4: No access token but has refresh token (access token expired, need to refresh)
		// This happens when user returns after the 1-hour access token expired
		// but the 30-day refresh token is still valid (Remember Me was checked)
		else if (!serverAccessToken && hasRefreshToken && !currentAccessToken) {
			console.log(
				'[ROOT LAYOUT] No access token but refresh token exists, attempting token refresh'
			);

			// Prevent multiple simultaneous refresh attempts
			if (!initializationPromise) {
				initializationPromise = authStore
					.refreshAccessToken()
					.then(async () => {
						console.log('[ROOT LAYOUT] Token refresh successful, initializing auth');
						// After successful refresh, fetch user data
						await authStore.initialize();
					})
					.catch((err) => {
						console.error('[ROOT LAYOUT] Token refresh failed:', err);
						// User will remain logged out - refresh token may be expired or invalid
					})
					.finally(() => {
						initializationPromise = null;
					});
			}
		}
		// Case 5: Neither has token (browsing as guest)
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
	<DemoBanner />
	{@render children()}
</QueryClientProvider>
