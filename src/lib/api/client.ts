/**
 * Re-export the generated client and SDK
 * The SDK functions handle auth automatically via client configuration
 */
import { client as generatedClient } from './generated/client.gen';

// Get API URL from environment or use default
// @ts-ignore - $env/static/public is generated at build time
import { PUBLIC_API_URL } from '$env/static/public';

// Configure the client to use the environment variable
generatedClient.setConfig({
	baseUrl: (PUBLIC_API_URL as string | undefined) || 'http://localhost:8000'
});

export * from './generated/sdk.gen';
export { generatedClient as client };
