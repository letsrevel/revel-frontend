<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { ModeWatcher } from 'mode-watcher';
	import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';
	import { authStore } from '$lib/stores/auth.svelte';
	import { appStore } from '$lib/stores/app.svelte';
	import { Toaster, toast } from 'svelte-sonner';
	import { extractErrorMessage, isAuthError } from '$lib/utils/errors';
	import DemoBanner from '$lib/components/common/DemoBanner.svelte';
	import ImpersonationBanner from '$lib/components/common/ImpersonationBanner.svelte';
	import MaintenanceBanner from '$lib/components/common/MaintenanceBanner.svelte';
	import type { LayoutData } from './$types';
	import * as m from '$lib/paraglide/messages.js';
	import type { ClaimResult } from '$lib/server/token-claim';

	interface Props {
		data: LayoutData;
		children: import('svelte').Snippet;
	}

	const { data, children }: Props = $props();

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

					// Mutations that have already toasted a user-friendly inline
					// message can mark their error with `silent: true` to opt out
					// of this global "Action failed" toast and avoid a duplicate.
					if (
						error &&
						typeof error === 'object' &&
						(error as { silent?: boolean }).silent === true
					) {
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
	 * Sync auth state with the server.
	 *
	 * SECURITY: The server does NOT ship the access token in the SSR payload
	 * (would land in the page HTML and leak via view-source / proxies). Instead
	 * we observe the boolean flags `hasAccessToken` / `hasRefreshToken` and
	 * derive client state from them:
	 *
	 * - has access token, client store empty → call `/api/auth/refresh` to
	 *   mint a fresh access token into the in-memory store. Covers cold
	 *   hydration after login, after impersonation, and after any session
	 *   change on the server (since the new token's value isn't in the HTML,
	 *   the only way to learn it is to ask).
	 * - no access token, client store populated → logout cookies were cleared,
	 *   drop client state.
	 *
	 * The trade-off is one extra POST /api/auth/refresh on first paint per
	 * cold authenticated load. Token refresh after that is handled by the
	 * client-side auto-refresh timer and the 401 interceptor.
	 */
	let previousServerHasToken = $state<boolean | null>(null);
	let initializationPromise = $state<Promise<void> | null>(null);

	$effect(() => {
		const hasServerAccessToken = data.auth.hasAccessToken;
		const hasRefreshToken = data.auth.hasRefreshToken;
		const currentAccessToken = authStore.accessToken;

		// Skip if server-side auth presence hasn't changed.
		if (hasServerAccessToken === previousServerHasToken) {
			return;
		}

		console.log('[ROOT LAYOUT] Auth sync effect triggered', {
			hasServerAccessToken,
			hasRefreshToken,
			hasCurrentToken: !!currentAccessToken,
			previousServerHasToken
		});

		previousServerHasToken = hasServerAccessToken;

		// Case 1: Server says we're authenticated but the in-memory store is
		// empty (cold hydration, login, or impersonation). Mint a fresh access
		// token via the refresh endpoint so we have it in memory.
		if (hasServerAccessToken && !currentAccessToken) {
			console.log('[ROOT LAYOUT] Server has access cookie but client store empty, refreshing');

			if (!initializationPromise) {
				initializationPromise = authStore
					.refreshAccessToken()
					.then(async () => {
						// `refreshAccessToken` sets the token in the store; now fetch
						// user data + permissions (idempotent if already present).
						await authStore.initialize();
					})
					.catch((err) => {
						console.error('[ROOT LAYOUT] Auth bootstrap failed:', err);

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
		// Case 2: Server has no access token, but client store still has one
		// (logout, or session cleared server-side).
		else if (!hasServerAccessToken && currentAccessToken) {
			console.log('[ROOT LAYOUT] No server access cookie, clearing auth state (logout)');
			authStore.logout();
			queryClient.clear();
			initializationPromise = null;
		}
		// Case 3: Both have tokens — already authenticated. Token refresh is
		// handled by the auto-refresh timer and the 401 interceptor. No-op
		// here; we no longer have a server-side token value to compare against.
		else if (hasServerAccessToken && currentAccessToken) {
			console.log('[ROOT LAYOUT] Both server and client have tokens (already authenticated)');
		}
		// Case 4: Access token cookie expired but refresh token is still valid
		// (e.g. "Remember Me" user returning after the 1-hour access window).
		// Same refresh path as case 1 — the in-memory store is empty either
		// way, and `/api/auth/refresh` uses whichever refresh cookie is present.
		else if (!hasServerAccessToken && hasRefreshToken && !currentAccessToken) {
			console.log(
				'[ROOT LAYOUT] No access cookie but refresh cookie exists, attempting token refresh'
			);

			if (!initializationPromise) {
				initializationPromise = authStore
					.refreshAccessToken()
					.then(async () => {
						console.log('[ROOT LAYOUT] Token refresh successful, initializing auth');
						await authStore.initialize();
					})
					.catch((err) => {
						console.error('[ROOT LAYOUT] Token refresh failed:', err);
						// User stays logged out — refresh token expired/invalid.
					})
					.finally(() => {
						initializationPromise = null;
					});
			}
		}
		// Case 5: Neither cookie present (browsing as guest).
		else {
			console.log('[ROOT LAYOUT] No tokens, user not authenticated');
		}
	});

	// Handle flash messages after navigation (including client-side navigation from login)
	// Using afterNavigate instead of onMount because login uses use:enhance for client-side navigation
	afterNavigate(({ from, to }) => {
		console.log('[ROOT LAYOUT] afterNavigate triggered', {
			from: from?.url?.pathname,
			to: to?.url?.pathname,
			allCookies: document.cookie
		});

		// Check for claim flash cookie (from login/signup with pending tokens)
		const claimFlashCookie = document.cookie
			.split('; ')
			.find((row) => row.startsWith('claim_flash='));

		if (claimFlashCookie) {
			try {
				// Cookie value is URL-encoded base64 JSON (SvelteKit URL-encodes cookie values)
				const urlEncodedValue = claimFlashCookie.substring('claim_flash='.length);
				console.log('[ROOT LAYOUT] Found claim_flash cookie (URL-encoded):', urlEncodedValue);
				const base64Value = decodeURIComponent(urlEncodedValue);
				console.log('[ROOT LAYOUT] After URL decode (base64):', base64Value);
				const jsonString = atob(base64Value);
				console.log('[ROOT LAYOUT] Decoded JSON:', jsonString);
				const claims = JSON.parse(jsonString) as ClaimResult[];
				console.log('[ROOT LAYOUT] Parsed claims:', claims);

				// Show toast for each successful claim
				for (const claim of claims) {
					if (claim.success && claim.name) {
						if (claim.type === 'organization') {
							toast.success(m['common.claimSuccess_organization']({ name: claim.name }));
						} else if (claim.type === 'event') {
							toast.success(m['common.claimSuccess_event']({ name: claim.name }));
						}
					}
				}

				// Delete the cookie after reading
				document.cookie = 'claim_flash=; path=/; max-age=0';
				console.log('[ROOT LAYOUT] Processed and cleared claim_flash cookie');
			} catch (error) {
				console.warn('[ROOT LAYOUT] Error processing claim_flash cookie:', error);
				// Clear the cookie even on error
				document.cookie = 'claim_flash=; path=/; max-age=0';
			}
		}
	});

	// Fetch backend version on initial mount
	onMount(async () => {
		await appStore.fetchBackendVersion();
	});
</script>

<svelte:head>
	{#if data.siteVerification?.google}
		<meta name="google-site-verification" content={data.siteVerification.google} />
	{/if}
	{#if data.siteVerification?.bing}
		<meta name="msvalidate.01" content={data.siteVerification.bing} />
	{/if}
</svelte:head>

<ModeWatcher />
<QueryClientProvider client={queryClient}>
	<Toaster richColors position="top-right" />
	<ImpersonationBanner />
	<DemoBanner />
	<MaintenanceBanner />
	{@render children()}
</QueryClientProvider>
