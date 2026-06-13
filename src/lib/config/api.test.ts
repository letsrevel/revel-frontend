import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * API_BASE_URL is resolved at module-evaluation time from the runtime env
 * ($env/dynamic/public). Each case re-mocks the env and re-imports the module
 * via vi.resetModules() so the top-level const is recomputed.
 */
describe('config/api', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it('falls back to localhost when PUBLIC_API_URL is unset', async () => {
		vi.doMock('$env/dynamic/public', () => ({ env: {} }));
		const { API_BASE_URL, API_BASE_URL_DISPLAY } = await import('./api');
		expect(API_BASE_URL).toBe('http://localhost:8000');
		expect(API_BASE_URL_DISPLAY).toBe('localhost:8000');
	});

	it('uses PUBLIC_API_URL from the runtime env when set', async () => {
		vi.doMock('$env/dynamic/public', () => ({
			env: { PUBLIC_API_URL: 'https://api.example.com' }
		}));
		const { API_BASE_URL, getApiUrl, getBackendUrl } = await import('./api');

		expect(API_BASE_URL).toBe('https://api.example.com');
		expect(getApiUrl('/events')).toBe('https://api.example.com/api/events');
		expect(getApiUrl('events')).toBe('https://api.example.com/api/events');
		expect(getBackendUrl('/media/logo.png')).toBe('https://api.example.com/media/logo.png');
	});

	it('returns already-absolute URLs unchanged', async () => {
		vi.doMock('$env/dynamic/public', () => ({
			env: { PUBLIC_API_URL: 'https://api.example.com' }
		}));
		const { getBackendUrl } = await import('./api');
		expect(getBackendUrl('https://cdn.example.com/x.png')).toBe('https://cdn.example.com/x.png');
		expect(getBackendUrl('http://cdn.example.com/x.png')).toBe('http://cdn.example.com/x.png');
	});
});
