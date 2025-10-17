import { describe, it, expect, vi, beforeEach } from 'vitest';
import { appStore } from './app.svelte';
import { apiApiVersion } from '$lib/api/client';

// Mock the API client
vi.mock('$lib/api/client', () => ({
	apiApiVersion: vi.fn()
}));

describe('AppStore', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('Initial State', () => {
		it('should start with null backendVersion', () => {
			// Create a new store instance for testing
			const store = new (appStore.constructor as any)();
			expect(store.backendVersion).toBeNull();
		});

		it('should start as not loading', () => {
			const store = new (appStore.constructor as any)();
			expect(store.isLoadingVersion).toBe(false);
		});
	});

	describe('fetchBackendVersion', () => {
		it('should fetch and store backend version', async () => {
			vi.mocked(apiApiVersion).mockResolvedValue({
				data: { version: '0.4.2' },
				error: undefined,
				request: {} as Request,
				response: {} as Response
			});

			const store = new (appStore.constructor as any)();
			await store.fetchBackendVersion();

			expect(store.backendVersion).toBe('0.4.2');
			expect(store.isLoadingVersion).toBe(false);
		});

		it('should set version to Unknown on error', async () => {
			vi.mocked(apiApiVersion).mockResolvedValue({
				data: undefined,
				error: { message: 'Network error' } as any,
				request: {} as Request,
				response: {} as Response
			});

			const store = new (appStore.constructor as any)();
			await store.fetchBackendVersion();

			expect(store.backendVersion).toBe('Unknown');
			expect(store.isLoadingVersion).toBe(false);
		});

		it('should not fetch if already fetched', async () => {
			const store = new (appStore.constructor as any)();

			vi.mocked(apiApiVersion).mockResolvedValue({
				data: { version: '0.4.2' },
				error: undefined,
				request: {} as Request,
				response: {} as Response
			});

			await store.fetchBackendVersion();
			expect(apiApiVersion).toHaveBeenCalledTimes(1);

			// Try fetching again
			await store.fetchBackendVersion();

			// Should still only be called once
			expect(apiApiVersion).toHaveBeenCalledTimes(1);
		});
	});
});
