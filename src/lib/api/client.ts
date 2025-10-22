/**
 * Re-export the generated client and SDK
 * The SDK functions handle auth automatically via client configuration
 */
import { client as generatedClient } from './generated/client.gen';
import { authStore } from '$lib/stores/auth.svelte';

// Get API URL from environment or use default
// @ts-ignore - $env/static/public is generated at build time
import { PUBLIC_API_URL } from '$env/static/public';

// Configure the client base settings
generatedClient.setConfig({
	baseUrl: (PUBLIC_API_URL as string | undefined) || 'http://localhost:8000',
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

// Add response interceptor to handle 401 errors and refresh token automatically
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

	console.log('[API CLIENT] Received 401, attempting token refresh');

	// If we're already refreshing, queue this request
	if (isRefreshing) {
		console.log('[API CLIENT] Token refresh in progress, queuing request');
		return new Promise((resolve, reject) => {
			failedRequestsQueue.push({ resolve, reject, request, options });
		});
	}

	isRefreshing = true;

	try {
		// Attempt to refresh the token via our server-side endpoint
		// The refresh token is in httpOnly cookie, so client can't access it directly
		// Our server endpoint will read it and call the backend
		const refreshResponse = await fetch('/api/auth/refresh', {
			method: 'POST',
			credentials: 'include' // Include cookies
		});

		if (!refreshResponse.ok) {
			console.error('[API CLIENT] Token refresh failed:', refreshResponse.status);
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

		console.log('[API CLIENT] Token refresh successful');

		// Update the access token in the store
		authStore.setAccessToken(data.access);

		// Process all queued requests with the new token
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
