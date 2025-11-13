/// <reference types="@sveltejs/kit" />

// Ensure environment types are available for generated client
declare module '$env/static/public' {
	export const PUBLIC_API_URL: string;
	export const PUBLIC_VERSION: string;
}
