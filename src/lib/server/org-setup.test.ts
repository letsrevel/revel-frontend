import { describe, it, expect, vi, beforeEach } from 'vitest';

const listEvents = vi.hoisted(() => vi.fn());
const logError = vi.hoisted(() => vi.fn());

vi.mock('$lib/api/generated/sdk.gen', () => ({
	eventpublicdiscoveryListEvents: listEvents
}));
vi.mock('$lib/server/logger', () => ({
	log: { error: logError, info: vi.fn(), warning: vi.fn(), debug: vi.fn() }
}));

import { loadHasPublishedEvent, loadSetupCounts } from './org-setup';

const ORG_ID = 'org-123';
const fetchStub = vi.fn() as unknown as typeof fetch;

type Query = {
	organization?: string;
	include_past?: boolean;
	page_size?: number;
	status?: string;
	order_by?: string;
};

function ok(count: number, results: { id: string; name: string }[] = []) {
	return { data: { count, results }, error: undefined, response: new Response() };
}

function fail(status = 500) {
	return { data: undefined, error: { detail: 'boom' }, response: new Response(null, { status }) };
}

/** Routes each mocked call by its query shape. */
function route(handlers: {
	total?: () => unknown;
	open?: () => unknown;
	closed?: () => unknown;
	draft?: () => unknown;
}) {
	listEvents.mockImplementation(async (opts: { query: Query }) => {
		const q = opts.query;
		if (q.status === 'draft') return handlers.draft?.() ?? ok(0);
		if (q.status === 'open') return handlers.open?.() ?? ok(0);
		if (q.status === 'closed') return handlers.closed?.() ?? ok(0);
		return handlers.total?.() ?? ok(0);
	});
}

function queriesSent(): Query[] {
	return listEvents.mock.calls.map((c) => (c[0] as { query: Query }).query);
}

beforeEach(() => {
	listEvents.mockReset();
	logError.mockReset();
});

describe('loadSetupCounts', () => {
	it('sums open and closed into publishedCount and maps the latest draft', async () => {
		route({
			total: () => ok(7),
			open: () => ok(2),
			closed: () => ok(3),
			draft: () => ok(1, [{ id: 'd-1', name: 'Spring Gala' }])
		});

		const counts = await loadSetupCounts({
			orgId: ORG_ID,
			accessToken: 'tok',
			fetch: fetchStub
		});

		expect(counts).toEqual({
			eventCount: 7,
			publishedCount: 5,
			latestDraft: { id: 'd-1', name: 'Spring Gala' }
		});
		expect(logError).not.toHaveBeenCalled();
	});

	it('returns latestDraft null when there are no drafts', async () => {
		route({ total: () => ok(0), open: () => ok(0), closed: () => ok(0), draft: () => ok(0, []) });

		const counts = await loadSetupCounts({ orgId: ORG_ID, accessToken: 'tok', fetch: fetchStub });

		expect(counts.latestDraft).toBeNull();
		expect(counts.eventCount).toBe(0);
		expect(counts.publishedCount).toBe(0);
	});

	it('nulls publishedCount when the open call errors, keeping the others', async () => {
		route({
			total: () => ok(4),
			open: () => fail(500),
			closed: () => ok(1),
			draft: () => ok(1, [{ id: 'd-2', name: 'Draft' }])
		});

		const counts = await loadSetupCounts({ orgId: ORG_ID, accessToken: 'tok', fetch: fetchStub });

		expect(counts).toEqual({
			eventCount: 4,
			publishedCount: null,
			latestDraft: { id: 'd-2', name: 'Draft' }
		});
		expect(logError).toHaveBeenCalledWith(
			'org_setup_counts_failed',
			expect.objectContaining({ orgId: ORG_ID, query: 'open' })
		);
	});

	it('nulls latestDraft when the draft call rejects, keeping the others', async () => {
		route({
			total: () => ok(3),
			open: () => ok(1),
			closed: () => ok(1),
			draft: () => Promise.reject(new Error('network down'))
		});

		const counts = await loadSetupCounts({ orgId: ORG_ID, accessToken: 'tok', fetch: fetchStub });

		expect(counts).toEqual({ eventCount: 3, publishedCount: 2, latestDraft: null });
		expect(logError).toHaveBeenCalledWith(
			'org_setup_counts_failed',
			expect.objectContaining({ orgId: ORG_ID, query: 'draft' })
		);
	});

	it('nulls eventCount when the total call errors', async () => {
		route({ total: () => fail(503), open: () => ok(0), closed: () => ok(0), draft: () => ok(0) });

		const counts = await loadSetupCounts({ orgId: ORG_ID, accessToken: 'tok', fetch: fetchStub });

		expect(counts.eventCount).toBeNull();
		expect(counts.publishedCount).toBe(0);
		expect(logError).toHaveBeenCalledWith(
			'org_setup_counts_failed',
			expect.objectContaining({ query: 'total' })
		);
	});

	it('never throws even when every call rejects', async () => {
		listEvents.mockRejectedValue(new Error('upstream gone'));

		const counts = await loadSetupCounts({ orgId: ORG_ID, accessToken: 'tok', fetch: fetchStub });

		expect(counts).toEqual({ eventCount: null, publishedCount: null, latestDraft: null });
	});

	it('scopes every call to the org with include_past and sends the bearer token', async () => {
		route({ total: () => ok(0), open: () => ok(0), closed: () => ok(0), draft: () => ok(0) });

		await loadSetupCounts({ orgId: ORG_ID, accessToken: 'tok-abc', fetch: fetchStub });

		const queries = queriesSent();
		expect(queries).toHaveLength(4);
		for (const q of queries) {
			expect(q.organization).toBe(ORG_ID);
			expect(q.include_past).toBe(true);
			expect(q.page_size).toBe(1);
		}
		expect(queries.filter((q) => q.status === 'draft')).toEqual([
			expect.objectContaining({ order_by: '-start' })
		]);
		const firstOpts = listEvents.mock.calls[0][0] as { headers: Record<string, string> };
		expect(firstOpts.headers).toEqual({ Authorization: 'Bearer tok-abc' });
	});
});

describe('loadHasPublishedEvent', () => {
	const opts = { orgId: ORG_ID, accessToken: 'tok', fetch: fetchStub };

	beforeEach(() => {
		listEvents.mockReset();
		logError.mockReset();
	});

	it('is true when an open or closed event exists (cheap queries only)', async () => {
		route({ closed: () => ok(2) });
		expect(await loadHasPublishedEvent(opts)).toBe(true);
		const qs = queriesSent();
		expect(qs.map((q) => q.status).sort()).toEqual(['closed', 'open']);
		expect(qs.every((q) => q.page_size === 1 && q.include_past === true)).toBe(true);
	});

	it('is false when neither exists', async () => {
		route({});
		expect(await loadHasPublishedEvent(opts)).toBe(false);
	});

	it('is null when a query fails and nothing was found; true still wins', async () => {
		route({ open: () => fail() });
		expect(await loadHasPublishedEvent(opts)).toBeNull();
		route({ open: () => fail(), closed: () => ok(1) });
		expect(await loadHasPublishedEvent(opts)).toBe(true);
	});

	it('never throws', async () => {
		listEvents.mockRejectedValue(new Error('net'));
		expect(await loadHasPublishedEvent(opts)).toBeNull();
	});
});
