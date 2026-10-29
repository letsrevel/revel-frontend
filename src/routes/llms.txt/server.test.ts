// src/routes/llms.txt/server.test.ts
import { describe, it, expect } from 'vitest';
import { GET } from './+server';

type Event = Parameters<typeof GET>[0];

async function fetchLlms(tenant: unknown = null): Promise<Response> {
	return GET({
		url: new URL('https://letsrevel.io/llms.txt'),
		locals: { tenant }
	} as unknown as Event);
}

describe('GET /llms.txt', () => {
	it('serves the platform llms.txt as plain text on the platform host', async () => {
		const response = await fetchLlms();
		expect(response.status).toBe(200);
		expect(response.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
		expect(response.headers.get('Cache-Control')).toContain('max-age=');
		const body = await response.text();
		expect(body.startsWith('# Revel (letsrevel.io)')).toBe(true);
	});

	it('returns 404 on a white-label tenant host', async () => {
		const response = await fetchLlms({ id: 'tenant-id', slug: 'acme' });
		expect(response.status).toBe(404);
		expect(await response.text()).not.toContain('# Revel (letsrevel.io)');
	});
});
