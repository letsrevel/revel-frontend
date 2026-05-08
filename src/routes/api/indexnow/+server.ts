import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

interface IndexNowPayload {
	host: string;
	key: string;
	keyLocation: string;
	urlList: string[];
}

export const POST: RequestHandler = async ({ request, fetch, url }) => {
	const sharedSecret = env.INDEXNOW_TRIGGER_SECRET;
	const key = env.INDEXNOW_KEY;
	if (!sharedSecret || !key) throw error(500, 'IndexNow not configured');

	const auth = request.headers.get('authorization');
	if (auth !== `Bearer ${sharedSecret}`) throw error(401, 'Unauthorized');

	const body = await request.json();
	if (!body || !Array.isArray(body.urls) || body.urls.length === 0) {
		throw error(400, 'Expected { urls: string[] } with at least one URL');
	}

	const payload: IndexNowPayload = {
		host: url.host,
		key,
		keyLocation: `${url.origin}/indexnow-${key}.txt`,
		urlList: body.urls
	};

	const res = await fetch('https://api.indexnow.org/indexnow', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	});

	return json({ ok: res.ok, status: res.status, urlCount: body.urls.length });
};
