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

export * from './generated/sdk.gen';
export { generatedClient as client };
