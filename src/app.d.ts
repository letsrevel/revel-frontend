// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
/// <reference types="@sveltejs/kit" />
import type { RevelUserSchema } from '$lib/api';
import '@testing-library/jest-dom/vitest';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			// User can be full RevelUserSchema (from API) or minimal JWT data (from token decode)
			user?:
				| (RevelUserSchema & { accessToken?: string })
				| { id: string; email: string; accessToken?: string }
				| null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
