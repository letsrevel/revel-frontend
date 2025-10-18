/**
 * Re-export the generated client and SDK
 * The SDK functions handle auth automatically via client configuration
 */
import { PUBLIC_API_URL } from '$env/static/public';
import { client as generatedClient } from './generated/client.gen';

// Configure the client to use the environment variable
generatedClient.setConfig({
	baseUrl: PUBLIC_API_URL || 'http://localhost:8000'
});

export * from './generated/sdk.gen';
export { generatedClient as client };
