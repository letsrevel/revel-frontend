<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
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

	// Arm the auth bootstrap gate SYNCHRONOUSLY, before child components (and
	// their queries/mutations) initialize: the $effect below that actually
	// starts the bootstrap runs only AFTER children mounted, so without this a
	// child's request would race the bootstrap and go out without an
	// Authorization header ("Unauthorized" errors / empty list states on cold
	// loads). The API client awaits authStore.waitForAuthReady() per request.
	if (
		browser &&
		(data.auth.hasAccessToken || data.auth.hasRefreshToken) &&
		!authStore.accessToken
	) {
		authStore.markBootstrapPending();
	}

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
					toast.error(m['rootLayout.actionFailed'](), {
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
	let previousFingerprint = $state<string | null | undefined>(undefined);
	let initializationPromise = $state<Promise<void> | null>(null);
	// Incremented every time a bootstrap starts. A session swap that lands while
	// a bootstrap is in flight bumps it (indirectly, via a fresh bootstrap), so
	// the stale in-flight promise can detect it was superseded and bail out
	// instead of loading the previous identity's data.
	let bootstrapGeneration = 0;

	/**
	 * Bootstrap the in-memory access token from the server session. Impersonation
	 * sessions have no refresh cookie, so they adopt the existing access-cookie
	 * token via /api/auth/session-token; everything else mints a fresh token via
	 * /api/auth/refresh. Then loads user data + permissions.
	 */
	function bootstrapAuth(impersonated: boolean): void {
		if (initializationPromise) return;
		const generation = ++bootstrapGeneration;
		const acquire = impersonated ? authStore.loadSessionToken() : authStore.refreshAccessToken();
		initializationPromise = acquire
			.then(async () => {
				// A session swap may have superseded this bootstrap while the token
				// request was in flight — don't load a stale identity's data.
				if (generation !== bootstrapGeneration) return;
				await authStore.initialize();
			})
			.catch((err) => {
				console.error('[ROOT LAYOUT] Auth bootstrap failed:', err);
				// Surface the most common cause (ad blocker eating the request).
				if (err instanceof TypeError && err.message === 'Failed to fetch') {
					import('$lib/config/api').then(({ API_BASE_URL_DISPLAY }) => {
						import('svelte-sonner').then(({ toast }) => {
							toast.error(m['rootLayout.apiBlocked'](), {
								description: m['rootLayout.apiBlockedDescription']({
									url: API_BASE_URL_DISPLAY
								}),
								duration: 10000
							});
						});
					});
				}
			})
			.finally(() => {
				// Only the current bootstrap clears the latch; a superseded one must
				// not release the latch now held by its replacement.
				if (generation === bootstrapGeneration) initializationPromise = null;
			});
	}

	$effect(() => {
		const hasServerAccessToken = data.auth.hasAccessToken;
		const hasRefreshToken = data.auth.hasRefreshToken;
		const fingerprint = data.auth.fingerprint;
		const impersonated = data.auth.impersonated;
		const currentAccessToken = authStore.accessToken;

		// Re-run when the auth presence boolean OR the identity fingerprint
		// changes. The fingerprint catches a server-side session SWAP
		// (impersonation start/stop, login-as-different-user) where the boolean
		// stays `true` but the identity changed — the boolean-only guard used to
		// miss this and leave the stale identity in memory until a hard reload.
		const presenceChanged = hasServerAccessToken !== previousServerHasToken;
		const identityChanged = fingerprint !== previousFingerprint;
		if (!presenceChanged && !identityChanged) {
			return;
		}

		previousServerHasToken = hasServerAccessToken;
		previousFingerprint = fingerprint;

		// Session swap: server identity changed while we still hold a token for
		// the previous identity. Drop the stale in-memory identity (without the
		// logout guard, which would block the bootstrap below) so the new
		// identity is loaded fresh.
		if (hasServerAccessToken && currentAccessToken && identityChanged) {
			authStore.resetForSwap();
			queryClient.clear();
			// Release the latch so the new identity can bootstrap below (Case 1).
			// A bootstrap for the previous identity may still be in flight; its
			// generation guard makes it bail out when it resolves.
			initializationPromise = null;
		}

		// Case 1: Server is authenticated but the in-memory store is empty (cold
		// hydration, login, impersonation, or just-reset swap). Bootstrap the
		// token. Note: read authStore.accessToken fresh here — resetForSwap()
		// above may have just cleared it.
		if (hasServerAccessToken && !authStore.accessToken) {
			bootstrapAuth(impersonated);
		}
		// Case 2: Server has no access token, but client store still has one
		// (logout, or session cleared server-side).
		else if (!hasServerAccessToken && currentAccessToken) {
			authStore.logout();
			queryClient.clear();
			initializationPromise = null;
		}
		// Case 3: Access token cookie expired but refresh token is still valid
		// (e.g. "Remember Me" user returning after the 1-hour access window).
		// Impersonation never lands here (it has no refresh cookie), so refresh
		// is correct.
		else if (!hasServerAccessToken && hasRefreshToken && !authStore.accessToken) {
			bootstrapAuth(false);
		}
		// Case 4 (no-op): already authenticated with an unchanged identity (handled
		// by the auto-refresh timer + 401 interceptor), or browsing as a guest.
	});

	// Handle flash messages after navigation (including client-side navigation from login)
	// Using afterNavigate instead of onMount because login uses use:enhance for client-side navigation
	afterNavigate(() => {
		// Check for claim flash cookie (from login/signup with pending tokens)
		const claimFlashCookie = document.cookie
			.split('; ')
			.find((row) => row.startsWith('claim_flash='));

		if (claimFlashCookie) {
			try {
				// Cookie value is URL-encoded base64 JSON (SvelteKit URL-encodes cookie values)
				const urlEncodedValue = claimFlashCookie.substring('claim_flash='.length);
				const base64Value = decodeURIComponent(urlEncodedValue);
				const binaryString = atob(base64Value);
				const bytes = Uint8Array.from(binaryString, (c) => c.charCodeAt(0));
				const jsonString = new TextDecoder().decode(bytes);
				const claims = JSON.parse(jsonString) as ClaimResult[];

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
			} catch (error) {
				console.warn('[ROOT LAYOUT] Error processing claim_flash cookie:', error);
				// Clear the cookie even on error
				document.cookie = 'claim_flash=; path=/; max-age=0';
			}
		}
	});

	// Fetch backend version on initial mount
	onMount(async () => {
		// Hydration marker: interactions dispatched before hydration are silently
		// lost, so the E2E goto() helper waits for this attribute (tests/e2e).
		document.body.dataset.hydrated = 'true';
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
