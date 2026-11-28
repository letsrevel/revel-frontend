import { describe, it, expect, vi, beforeEach } from 'vitest';
import { load } from './+page.server';
import {
	eventpublicdiscoveryListEvents,
	organizationadminmembershiprequestsListMembershipRequests,
	organizationadminsubscriptionsListSubscriptions
} from '$lib/api/generated/sdk.gen';
import { loadHasPublishedEvent, loadSetupCounts } from '$lib/server/org-setup';
import { loadOrgWarningCounts } from '$lib/server/org-warning-counts';

vi.mock('$lib/api/generated/sdk.gen', () => ({
	eventpublicdiscoveryListEvents: vi.fn(),
	organizationadminmembershiprequestsListMembershipRequests: vi.fn(),
	organizationadminsubscriptionsListSubscriptions: vi.fn()
}));
vi.mock('$lib/server/org-setup', () => ({
	loadSetupCounts: vi.fn(),
	loadHasPublishedEvent: vi.fn()
}));
vi.mock('$lib/server/org-warning-counts', () => ({ loadOrgWarningCounts: vi.fn() }));
vi.mock('$lib/server/logger', () => ({ log: { error: vi.fn() } }));

const listEvents = vi.mocked(eventpublicdiscoveryListEvents);
const listRequests = vi.mocked(organizationadminmembershiprequestsListMembershipRequests);
const listSubs = vi.mocked(organizationadminsubscriptionsListSubscriptions);

type LoadArg = Parameters<typeof load>[0];
type Result = Awaited<ReturnType<typeof load>>;

const ev = (id: string) => ({ id });

const cookieDelete = vi.fn();

function run(isOwner = true, cookie?: string, visibility?: string): Promise<Result> {
	const event = {
		fetch: vi.fn(),
		cookies: {
			delete: cookieDelete,
			get: (name: string) => (name === 'revel_setup_hidden_org-id' ? cookie : undefined)
		},
		params: { slug: 'org' },
		locals: { user: { accessToken: 'tok' } },
		parent: async () => ({ isOwner, organization: { id: 'org-id', slug: 'org', visibility } })
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

const setupCountsMock = vi.mocked(loadSetupCounts);
const publishedMock = vi.mocked(loadHasPublishedEvent);
const COUNTS = { eventCount: 0, publishedCount: 0, latestDraft: null };

beforeEach(() => {
	cookieDelete.mockReset();
	publishedMock.mockReset();
	publishedMock.mockResolvedValue(false);
	setupCountsMock.mockReset();
	setupCountsMock.mockResolvedValue(COUNTS);
	listEvents.mockReset();
	listRequests.mockReset();
	listRequests.mockResolvedValue({ data: { count: 3 }, error: undefined } as never);
	listSubs.mockReset();
	listSubs.mockResolvedValue({ data: { count: 0, results: [] }, error: undefined } as never);
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

	it('loads setup counts for owners', async () => {
		mockEvents({ live: { results: [] }, upcoming: { results: [] }, drafts: { count: 0 } });
		const res = await run(true);
		expect(res.setupCounts).toEqual(COUNTS);
		expect(setupCountsMock).toHaveBeenCalledWith(
			expect.objectContaining({ orgId: 'org-id', accessToken: 'tok' })
		);
	});

	it('skips setup counts for staff', async () => {
		mockEvents({ live: { results: [] }, upcoming: { results: [] }, drafts: { count: 0 } });
		const res = await run(false);
		expect(res.setupCounts).toBeNull();
		expect(setupCountsMock).not.toHaveBeenCalled();
	});

	it('hidden cookie, nothing published: skips counts, keeps the collapsed line', async () => {
		mockEvents({ live: { results: [] }, upcoming: { results: [] }, drafts: { count: 0 } });
		const res = await run(true, '1');
		expect(setupCountsMock).not.toHaveBeenCalled();
		expect(publishedMock).toHaveBeenCalledTimes(1);
		expect(res.setupCounts).toBeNull();
		expect(res.setupHidden).toBe(true);
		expect(cookieDelete).not.toHaveBeenCalled();
	});

	it('hidden cookie, published check unknown: keeps the collapsed line', async () => {
		publishedMock.mockResolvedValue(null);
		mockEvents({ live: { results: [] }, upcoming: { results: [] }, drafts: { count: 0 } });
		const res = await run(true, '1');
		expect(res.setupHidden).toBe(true);
		expect(cookieDelete).not.toHaveBeenCalled();
	});

	it('hidden cookie, event published: drops the line and clears the cookie', async () => {
		publishedMock.mockResolvedValue(true);
		mockEvents({ live: { results: [] }, upcoming: { results: [] }, drafts: { count: 0 } });
		const res = await run(true, '1');
		expect(res.setupHidden).toBe(false);
		expect(res.setupCounts).toBeNull();
		expect(cookieDelete).toHaveBeenCalledWith('revel_setup_hidden_org-id', { path: '/' });
	});

	it('absent cookie loads counts and setupHidden is false', async () => {
		mockEvents({ live: { results: [] }, upcoming: { results: [] }, drafts: { count: 0 } });
		const res = await run(true);
		expect(res.setupHidden).toBe(false);
		expect(res.setupCounts).toEqual(COUNTS);
	});

	it('ignores the hidden cookie for staff', async () => {
		mockEvents({ live: { results: [] }, upcoming: { results: [] }, drafts: { count: 0 } });
		const res = await run(false, '1');
		expect(res.setupHidden).toBe(false);
	});
});

describe('admin dashboard awaitingPaymentCount', () => {
	const noEvents = () =>
		mockEvents({
			live: { results: [], count: 0 },
			upcoming: { results: [], count: 0 },
			drafts: { results: [], count: 0 }
		});

	it('takes the count of pending OFFLINE subscriptions from the server filter', async () => {
		noEvents();
		listSubs.mockResolvedValue({
			data: { count: 250, results: [{}] },
			error: undefined
		} as never);
		const res = await run();
		expect(res.awaitingPaymentCount).toBe(250);
		expect(listSubs.mock.calls[0][0]).toMatchObject({
			path: { slug: 'org' },
			query: { status: 'pending', payment_method: 'offline', page_size: 1 }
		});
	});

	it('is zero (row hidden) when nobody is awaiting', async () => {
		noEvents();
		listSubs.mockResolvedValue({ data: { count: 0, results: [] }, error: undefined } as never);
		expect((await run()).awaitingPaymentCount).toBe(0);
	});

	it('is null when the call fails', async () => {
		noEvents();
		listSubs.mockRejectedValue(new Error('403'));
		expect((await run()).awaitingPaymentCount).toBeNull();
	});
});

describe('overview load: warningCounts (A1)', () => {
	const warn = vi.mocked(loadOrgWarningCounts);
	const WARN = { publicEventCount: 2, inSeriesCount: 1, partial: false };

	beforeEach(() => {
		warn.mockReset();
		warn.mockResolvedValue(WARN);
		mockEvents({ live: { results: [] }, upcoming: { results: [] }, drafts: { count: 0 } });
	});

	it.each(['private', 'members-only', 'staff-only'])('loads the counts for %s', async (v) => {
		const res = await run(true, undefined, v);
		expect(res.warningCounts).toEqual(WARN);
		expect(warn).toHaveBeenCalledWith(
			expect.objectContaining({ orgId: 'org-id', accessToken: 'tok' })
		);
	});

	it.each(['public', 'unlisted', undefined])('skips the call for %s', async (v) => {
		const res = await run(true, undefined, v);
		expect(warn).not.toHaveBeenCalled();
		expect(res.warningCounts).toBeNull();
	});

	it('returns null when the helper fails', async () => {
		warn.mockResolvedValue(null);
		const res = await run(true, undefined, 'private');
		expect(res.warningCounts).toBeNull();
	});
});
