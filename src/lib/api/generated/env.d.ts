// Type declarations for SvelteKit virtual modules
// This file ensures TypeScript can resolve $env/static/public in the generated API client

declare module '$env/static/public' {
	export const PUBLIC_API_URL: string;
	export const PUBLIC_VERSION: string;
}
