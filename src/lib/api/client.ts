/**
 * Re-export the generated client and SDK
 * The SDK functions handle auth automatically via client configuration
 */
import { client as generatedClient } from './generated/client.gen';
import { authStore } from '$lib/stores/auth.svelte';
import { API_BASE_URL } from '$lib/config/api';

// Configure the client base settings
generatedClient.setConfig({
	baseUrl: API_BASE_URL,
	// Include credentials (cookies) in all requests (for refresh tokens)
	credentials: 'include'
});

// Track if we're currently refreshing the token to prevent multiple simultaneous refresh calls
let isRefreshing = false;
// Queue of requests waiting for token refresh to complete
let failedRequestsQueue: Array<{
	resolve: (value: Response) => void;
	reject: (error: unknown) => void;
	request: Request;
	options: any;
}> = [];

/**
 * Process all queued requests after token refresh completes
 */
function processQueue(error: unknown | null, token: string | null = null) {
	failedRequestsQueue.forEach((promise) => {
		if (error) {
			promise.reject(error);
		} else {
			// Retry the request with the new token
			const newRequest = promise.request.clone();
			if (token) {
				newRequest.headers.set('Authorization', `Bearer ${token}`);
			}
			fetch(newRequest)
				.then((response) => promise.resolve(response))
				.catch((err) => promise.reject(err));
		}
	});
	failedRequestsQueue = [];
}

// Use request interceptor to inject Authorization header dynamically
// This is necessary because the generated client does not support header functions
generatedClient.interceptors.request.use((request, _options) => {
	// Get the current access token from auth store
	const token = authStore.accessToken;

	if (token) {
		request.headers.set('Authorization', `Bearer ${token}`);
	}

	return request;
});

/**
 * Response interceptor to handle 401 errors and refresh token automatically
 *
 * IMPORTANT: This is the PRIMARY mechanism for token refresh. It:
 * 1. Detects 401 (Unauthorized) errors from API calls
 * 2. Calls /api/auth/refresh which uses the httpOnly refresh token cookie
 * 3. The backend returns NEW access and refresh tokens (rotating tokens)
 * 4. Updates the auth store with the new access token
 * 5. Retries the original request with the new token
 *
 * Race condition protection:
 * - Uses `isRefreshing` flag to prevent multiple simultaneous refresh calls
 * - Queues requests that arrive during refresh
 * - Processes queue after refresh completes
 *
 * This prevents using a blacklisted refresh token which would cause logout.
 */
generatedClient.interceptors.response.use(async (response, request, options) => {
	// If response is not 401, return as-is
	if (response.status !== 401) {
		return response;
	}

	// Skip token refresh for auth endpoints to prevent infinite loops
	const isAuthEndpoint =
		request.url.includes('/auth/token') ||
		request.url.includes('/auth/refresh') ||
		request.url.includes('/auth/login');

	if (isAuthEndpoint) {
		console.log('[API CLIENT] 401 on auth endpoint, not refreshing');
		return response;
	}

	// IMPORTANT: Only attempt token refresh if user was previously authenticated
	// If there's no auth state at all, don't try to refresh (prevents infinite loops)
	if (!authStore.accessToken && !authStore.isAuthenticated) {
		console.log('[API CLIENT] No auth state exists, not attempting refresh');
		return response;
	}

	console.log('[API CLIENT] Received 401 on:', request.url);

	// If we're already refreshing, queue this request
	if (isRefreshing) {
		console.log('[API CLIENT] Token refresh in progress, queuing request');
		return new Promise((resolve, reject) => {
			failedRequestsQueue.push({ resolve, reject, request, options });
		});
	}

	console.log('[API CLIENT] Starting token refresh');
	isRefreshing = true;

	try {
		// Attempt to refresh the token via our server-side endpoint
		// The refresh token is in httpOnly cookie, so client can't access it directly
		// Our server endpoint will:
		// 1. Read the refresh token from cookie
		// 2. Call backend /api/auth/refresh
		// 3. Save NEW access and refresh tokens to cookies
		// 4. Return new access token to client
		const refreshResponse = await fetch('/api/auth/refresh', {
			method: 'POST',
			credentials: 'include' // Include cookies
		});

		if (!refreshResponse.ok) {
			console.error('[API CLIENT] Token refresh failed with status:', refreshResponse.status);
			// Clear auth state and process queue with error
			authStore.logout();
			processQueue(new Error('Token refresh failed'), null);
			isRefreshing = false;
			return response; // Return original 401 response
		}

		const data = await refreshResponse.json();

		if (!data || !data.access) {
			console.error('[API CLIENT] Token refresh failed: no access token returned');
			// Clear auth state and process queue with error
			authStore.logout();
			processQueue(new Error('Token refresh failed'), null);
			isRefreshing = false;
			return response; // Return original 401 response
		}

		console.log('[API CLIENT] Token refresh successful, updating store and retrying requests');

		// Update the access token in the store (this also schedules next auto-refresh)
		authStore.setAccessToken(data.access);

		// Process all queued requests with the new token
		const queueLength = failedRequestsQueue.length;
		if (queueLength > 0) {
			console.log(`[API CLIENT] Processing ${queueLength} queued requests`);
		}
		processQueue(null, data.access);

		// Retry the original request with the new token
		const newRequest = request.clone();
		newRequest.headers.set('Authorization', `Bearer ${data.access}`);

		isRefreshing = false;

		// Return the retried request response
		return fetch(newRequest);
	} catch (error) {
		console.error('[API CLIENT] Token refresh error:', error);
		// Clear auth state and process queue with error
		authStore.logout();
		processQueue(error, null);
		isRefreshing = false;
		return response; // Return original 401 response
	}
});

export * from './generated/sdk.gen';
export { generatedClient as client };
