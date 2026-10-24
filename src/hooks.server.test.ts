import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({ env: {} as Record<string, string | undefined> }));

vi.mock('$env/dynamic/private', () => ({ env: mocks.env }));
vi.mock('$lib/config/api', () => ({ API_BASE_URL: 'https://api.example.com' }));
vi.mock('$lib/server/metrics', () => ({ startMetricsServer: vi.fn() }));

import { handleFetch } from './hooks.server';

const API = 'https://api.example.com/api/tenant/lookup?host=x';

function run(request: Request, fetchImpl: (r: Request) => Promise<Response>) {
	return handleFetch({
		event: {
			locals: { tenant: null, requestId: 'rid-1' },
			url: new URL('https://app.example.com/'),
			getClientAddress: () => '203.0.113.9'
		},
		request,
		fetch: fetchImpl
	} as unknown as Parameters<typeof handleFetch>[0]);
}

describe('handleFetch INTERNAL_API_URL rewrite', () => {
	beforeEach(() => {
		mocks.env.INTERNAL_API_URL = 'http://web:8000';
	});

	it('carries the caller signal onto the rebuilt request so aborting it aborts the internal fetch', async () => {
		const controller = new AbortController();
		const original = new Request(API, { signal: controller.signal });
		const seen: Request[] = [];
		await run(original, async (r) => {
			seen.push(r);
			return new Response('ok');
		});

		expect(seen).toHaveLength(1);
		expect(seen[0].url).toBe('http://web:8000/api/tenant/lookup?host=x');
		expect(seen[0].signal.aborted).toBe(false);
		controller.abort();
		expect(seen[0].signal.aborted).toBe(true);
	});

	it('propagates an already-fired timeout signal', async () => {
		const original = new Request(API, { signal: AbortSignal.abort() });
		const seen: Request[] = [];
		await run(original, async (r) => {
			seen.push(r);
			return new Response('ok');
		});
		expect(seen[0].signal.aborted).toBe(true);
	});
});
