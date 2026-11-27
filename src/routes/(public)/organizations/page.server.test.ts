import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/api', () => ({ organizationListOrganizations: vi.fn() }));
vi.mock('$lib/server/logger', () => ({
	log: { warning: vi.fn(), error: vi.fn(), debug: vi.fn(), info: vi.fn() }
}));
vi.mock('$lib/seo', () => ({ buildSeo: vi.fn(() => ({})) }));
vi.mock('$lib/seo/server', () => ({ resolveLang: vi.fn(() => 'en') }));

import { organizationListOrganizations } from '$lib/api';
import { load } from './+page.server';

const list = vi.mocked(organizationListOrganizations);

function loadEvent(search: string): Parameters<typeof load>[0] {
	return {
		request: new Request('https://example.test/organizations'),
		url: new URL(`https://example.test/organizations${search}`),
		fetch: vi.fn(),
		locals: { tenant: null, user: null }
	} as unknown as Parameters<typeof load>[0];
}

/** The query the loader sent upstream. */
function sentQuery(): Record<string, unknown> {
	return (list.mock.calls[0][0] as { query: Record<string, unknown> }).query;
}

describe('organizations listing loader', () => {
	beforeEach(() => {
		list.mockReset();
		list.mockResolvedValue({
			data: { results: [], count: 0, next: null, previous: null },
			error: undefined
		} as never);
	});

	it('sends no tags for a tags param that cleans to empty', async () => {
		await load(loadEvent('?tags=%23'));
		expect(sentQuery().tags).toBeUndefined();
	});

	it('removes case duplicates from the tags param', async () => {
		await load(loadEvent('?tags=fun,Fun'));
		expect(sentQuery().tags).toEqual(['fun']);
	});
});
