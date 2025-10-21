// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { RevelUserSchema } from '$lib/api';
import '@testing-library/jest-dom/vitest';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user?: (RevelUserSchema & { accessToken?: string }) | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
