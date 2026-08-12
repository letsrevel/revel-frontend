import { describe, it, expect } from 'vitest';
import type { RequestEvent, ResolveOptions } from '@sveltejs/kit';
import { handleDocumentCacheControl } from './document-cache';

function run(response: Response): Promise<Response> {
	return handleDocumentCacheControl({
		event: {} as RequestEvent,
		resolve: (_event: RequestEvent, _opts?: ResolveOptions) => Promise.resolve(response)
	});
}

describe('handleDocumentCacheControl', () => {
	it('defaults HTML documents to private, no-cache', async () => {
		const response = await run(
			new Response('<html></html>', { headers: { 'content-type': 'text/html; charset=utf-8' } })
		);
		expect(response.headers.get('cache-control')).toBe('private, no-cache');
	});

	/**
	 * Only-if-absent: routes that opt into caching (feeds, sitemaps, oembed,
	 * the /embed shell) own their header — the default must never clobber it.
	 */
	it('leaves a route-set Cache-Control alone', async () => {
		const response = await run(
			new Response('<html></html>', {
				headers: {
					'content-type': 'text/html',
					'cache-control': 'public, max-age=3600, stale-while-revalidate=300'
				}
			})
		);
		expect(response.headers.get('cache-control')).toBe(
			'public, max-age=3600, stale-while-revalidate=300'
		);
	});

	it('ignores non-HTML responses', async () => {
		const response = await run(
			new Response('<rss/>', { headers: { 'content-type': 'application/xml' } })
		);
		expect(response.headers.get('cache-control')).toBeNull();
	});
});
