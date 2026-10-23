import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { tenantManifest } from '$lib/seo/manifest';

/** `GET /manifest.webmanifest`: tenant hosts only; the platform keeps its static `/manifest.json`. */
export const GET: RequestHandler = async ({ locals }) => {
	// The platform keeps its static /manifest.json; this route is tenant-only.
	if (!locals.tenant) error(404, 'Not found');

	return new Response(JSON.stringify(tenantManifest(locals.tenant)), {
		headers: {
			'Content-Type': 'application/manifest+json; charset=utf-8',
			'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400'
		}
	});
};
