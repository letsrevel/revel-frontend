/**
 * Re-export the generated client and SDK
 * The SDK functions handle auth automatically via client configuration
 */
export * from './generated/sdk.gen';
export { client } from './generated/client.gen';
