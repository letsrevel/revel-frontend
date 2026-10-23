import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/api', () => ({ eventpublicdiscoveryListEvents: vi.fn() }));
vi.mock('$lib/server/logger', () => ({
	log: { warning: vi.fn(), error: vi.fn(), debug: vi.fn(), info: vi.fn() }
}));
vi.mock('$lib/seo', () => ({ buildSeo: vi.fn(() => ({})) }));
vi.mock('$lib/seo/server', () => ({ resolveLang: vi.fn(() => 'en') }));

import { eventpublicdiscoveryListEvents } from '$lib/api';
import { load } from './+page.server';

const list = vi.mocked(eventpublicdiscoveryListEvents);

function loadEvent(search: string, tenant: { id: string } | null): Parameters<typeof load>[0] {
	return {
		request: new Request('https://example.test/events'),
		url: new URL(`https://example.test/events${search}`),
		fetch: vi.fn(),
		locals: { tenant, user: null }
	} as unknown as Parameters<typeof load>[0];
}

/** The query the loader sent upstream. */
function sentQuery(): Record<string, unknown> {
	return (list.mock.calls[0][0] as { query: Record<string, unknown> }).query;
}

describe('events listing loader', () => {
	beforeEach(() => {
		list.mockReset();
		list.mockResolvedValue({
			data: { results: [], count: 0, next: null, previous: null },
			error: undefined
		} as never);
	});

	it('passes the organization filter through on the platform host', async () => {
		await load(loadEvent('?organization=org-from-query', null));
		expect(sentQuery().organization).toBe('org-from-query');
	});

	it('forces the organization filter to the tenant on a tenant host', async () => {
		await load(loadEvent('', { id: 'tenant-org' }));
		expect(sentQuery().organization).toBe('tenant-org');
	});

	it('overrides any organization / organization_slug in the query on a tenant host', async () => {
		const out = await load(
			loadEvent('?organization=other-org&organization_slug=other&search=x', { id: 'tenant-org' })
		);
		expect(sentQuery().organization).toBe('tenant-org');
		expect(sentQuery()).not.toHaveProperty('organization_slug');
		expect(sentQuery().search).toBe('x'); // other filters still apply
		expect((out as { filters: { organization?: string } }).filters.organization).toBe('tenant-org');
	});
});
