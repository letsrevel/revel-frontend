import type { RequestHandler } from './$types';
import llmsTxt from '$lib/server/llms.txt?raw';

/**
 * /llms.txt: a plain-text, LLM-oriented summary of the platform (https://llmstxt.org).
 *
 * Platform marketing content only. On a white-label tenant host (#1057) it is
 * a 404, so it never appears on a custom domain.
 */
export const GET: RequestHandler = async ({ locals }) => {
	if (locals.tenant) {
		return new Response('Not found', {
			status: 404,
			headers: { 'Content-Type': 'text/plain; charset=utf-8' }
		});
	}

	return new Response(llmsTxt, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800'
		}
	});
};
