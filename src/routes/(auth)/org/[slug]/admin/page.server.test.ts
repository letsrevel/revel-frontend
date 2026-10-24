import { describe, it, expect, vi, beforeEach } from 'vitest';
import { load } from './+page.server';
import {
	eventpublicdiscoveryListEvents,
	organizationadminmembershiprequestsListMembershipRequests
} from '$lib/api/generated/sdk.gen';

vi.mock('$lib/api/generated/sdk.gen', () => ({
	eventpublicdiscoveryListEvents: vi.fn(),
	organizationadminmembershiprequestsListMembershipRequests: vi.fn()
}));
vi.mock('$lib/server/logger', () => ({ log: { error: vi.fn() } }));

const listEvents = vi.mocked(eventpublicdiscoveryListEvents);
const listRequests = vi.mocked(organizationadminmembershiprequestsListMembershipRequests);

type LoadArg = Parameters<typeof load>[0];
type Result = Awaited<ReturnType<typeof load>>;

const ev = (id: string) => ({ id });

function run(): Promise<Result> {
	const event = {
		fetch: vi.fn(),
		params: { slug: 'org' },
		locals: { user: { accessToken: 'tok' } },
		parent: async () => ({ organization: { id: 'org-id', slug: 'org' } })
	} as unknown as LoadArg;
	return load(event) as Promise<Result>;
}

/** Route the mocked list call by the query it receives. */
function mockEvents(handlers: {
	live?: unknown;
	upcoming?: unknown;
	drafts?: unknown;
	draftsError?: boolean;
}) {
	listEvents.mockImplementation((async (opts: { query: Record<string, unknown> }) => {
		const q = opts.query;
		if (q.status === 'draft') {
			return handlers.draftsError
				? { data: undefined, error: { detail: 'boom' } }
				: { data: handlers.drafts, error: undefined };
		}
		if (q.include_past) return { data: handlers.live, error: undefined };
		return { data: handlers.upcoming, error: undefined };
	}) as unknown as typeof eventpublicdiscoveryListEvents);
}

beforeEach(() => {
	listEvents.mockReset();
	listRequests.mockReset();
	listRequests.mockResolvedValue({ data: { count: 3 }, error: undefined } as never);
});

describe('admin dashboard loader', () => {
	it('queries live candidates, upcoming and drafts separately', async () => {
		mockEvents({
			live: { results: [], count: 0 },
			upcoming: { results: [], count: 0 },
			drafts: { results: [], count: 0 }
		});
		await run();
		const queries = listEvents.mock.calls.map(
			(c) => (c[0] as { query: Record<string, unknown> }).query
		);
		expect(queries).toHaveLength(3);
		const live = queries.find((q) => q.include_past) ?? {};
		expect(live).toMatchObject({ order_by: '-start', page_size: 20, organization: 'org-id' });
		expect(new Date(live.start_before as string) > new Date(live.start_after as string)).toBe(true);
		expect(queries.find((q) => q.status === 'draft')).toMatchObject({ page_size: 1 });
		expect(queries.find((q) => !q.include_past && !q.status)).toMatchObject({
			order_by: 'start',
			page_size: 12
		});
	});

	it('merges live and upcoming events deduped by id, and reports the draft total', async () => {
		mockEvents({
			live: { results: [ev('a'), ev('b')] },
			upcoming: { results: [ev('b'), ev('c')] },
			drafts: { results: [ev('d')], count: 7 }
		});
		const res = await run();
		expect(res.dashboardEvents.map((e) => e.id).sort()).toEqual(['a', 'b', 'c']);
		expect(res.draftCount).toBe(7);
		expect(res.pendingRequestCount).toBe(3);
	});

	it('returns a null draftCount when the drafts query fails, keeping the events', async () => {
		mockEvents({
			live: { results: [ev('a')] },
			upcoming: { results: [] },
			draftsError: true
		});
		const res = await run();
		expect(res.draftCount).toBeNull();
		expect(res.dashboardEvents.map((e) => e.id)).toEqual(['a']);
	});
});
