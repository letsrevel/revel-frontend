import { describe, it, expect, vi, beforeEach } from 'vitest';
import { load } from './+page.server';
import { mergeEvents } from '$lib/utils/merge-events';
import { eventpublicdiscoveryListEvents } from '$lib/api/generated/sdk.gen';

vi.mock('$lib/api/generated/sdk.gen', () => ({
	eventpublicdiscoveryListEvents: vi.fn()
}));
vi.mock('$lib/server/logger', () => ({ log: { error: vi.fn() } }));

const listEvents = vi.mocked(eventpublicdiscoveryListEvents);

type LoadArg = Parameters<typeof load>[0];
type Result = Awaited<ReturnType<typeof load>>;

function run(): Promise<Result> {
	const event = {
		fetch: vi.fn(),
		locals: { user: { accessToken: 'tok' } },
		parent: async () => ({ organization: { id: 'org-id' }, canCreateEvent: true })
	} as unknown as LoadArg;
	return load(event) as Promise<Result>;
}

function mockBoth(upcoming: unknown, past: unknown): void {
	const impl = async (opts?: { query?: Record<string, unknown> }) =>
		opts?.query?.past_events ? past : upcoming;
	listEvents.mockImplementation(impl as never);
}

describe('admin events load', () => {
	beforeEach(() => listEvents.mockReset());

	it('requests upcoming soonest first and past newest first', async () => {
		mockBoth({ data: { results: [{ id: 'u1' }] } }, { data: { results: [{ id: 'p1' }] } });
		const result = (await run()) as { events: { id: string }[] };

		expect(listEvents).toHaveBeenCalledTimes(2);
		const queries = listEvents.mock.calls.map((c) => c[0]?.query as Record<string, unknown>);
		expect(queries).toContainEqual(
			expect.objectContaining({
				organization: 'org-id',
				include_past: false,
				order_by: 'start',
				page_size: 100
			})
		);
		expect(queries).toContainEqual(
			expect.objectContaining({
				organization: 'org-id',
				include_past: true,
				past_events: true,
				order_by: '-start',
				page_size: 100
			})
		);
		expect(result.events.map((e) => e.id)).toEqual(['u1', 'p1']);
	});

	it('throws 500 when either request fails', async () => {
		mockBoth({ data: { results: [] } }, { data: undefined, error: { detail: 'boom' } });
		await expect(run()).rejects.toMatchObject({ status: 500 });
		mockBoth({ data: undefined, error: { detail: 'boom' } }, { data: { results: [] } });
		await expect(run()).rejects.toMatchObject({ status: 500 });
	});
});

describe('mergeEvents', () => {
	it('de-duplicates by id and tolerates missing lists', () => {
		const a = { id: 'a' } as never;
		const b = { id: 'b' } as never;
		expect(mergeEvents([a, b], [b])).toEqual([a, b]);
		expect(mergeEvents(undefined, [b])).toEqual([b]);
	});
});
