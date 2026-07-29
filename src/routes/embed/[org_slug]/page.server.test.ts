import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EventInListSchema } from '$lib/api/generated/types.gen';

vi.mock('$lib/api', () => ({
	eventpublicdiscoveryListEvents: vi.fn(),
	eventpublicticketsListTiers: vi.fn()
}));
vi.mock('$lib/server/logger', () => ({
	log: { warning: vi.fn(), error: vi.fn(), debug: vi.fn(), info: vi.fn() }
}));

import { eventpublicdiscoveryListEvents } from '$lib/api';
import { load } from './+page.server';

const listEvents = vi.mocked(eventpublicdiscoveryListEvents);

const ORG = {
	id: 'org-uuid',
	name: 'Acme Collective',
	slug: 'acme',
	logo: null,
	logo_thumbnail_url: null
};

const EVENT = {
	id: 'event-uuid',
	name: 'Summer Party',
	slug: 'summer-party',
	organization: ORG,
	requires_ticket: false
} as unknown as EventInListSchema;

/** Minimal stand-in for the SvelteKit load event this loader actually reads. */
function loadEvent(search = '') {
	return {
		params: { org_slug: 'acme' },
		url: new URL(`https://letsrevel.io/embed/acme${search}`),
		fetch: globalThis.fetch
	} as unknown as Parameters<typeof load>[0];
}

function respond(results: EventInListSchema[]) {
	listEvents.mockResolvedValue({
		data: { count: results.length, results },
		error: undefined
	} as unknown as ReturnType<typeof eventpublicdiscoveryListEvents>);
}

describe('embed list loader', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('filters by organization_slug and never sends the organization UUID too', async () => {
		respond([EVENT]);
		await load(loadEvent());

		const query = listEvents.mock.calls[0][0]?.query;
		expect(query?.organization_slug).toBe('acme');
		// The backend's discovery filters AND rather than OR, so sending both
		// would narrow twice — and sending the UUID is exactly the extra lookup
		// `organization_slug` exists to remove.
		expect(query).not.toHaveProperty('organization');
	});

	it('forwards the parsed discovery filters', async () => {
		respond([EVENT]);
		await load(loadEvent('?tags=music,queer&page_size=3&include_past=true&order_by=-start'));

		const query = listEvents.mock.calls[0][0]?.query;
		expect(query).toMatchObject({
			organization_slug: 'acme',
			tags: ['music', 'queer'],
			page_size: 3,
			include_past: true,
			order_by: '-start',
			page: 1
		});
	});

	it('renders the empty state for an unknown slug rather than erroring', async () => {
		// The filter applies on top of the gated queryset, so a bad slug is an
		// empty 200 — never an error, and never a wider result set.
		respond([]);

		const result = await load(loadEvent());

		expect(result.events).toEqual([]);
		expect(result.organization).toBeNull();
		expect(result.orgSlug).toBe('acme');
	});

	it('takes the organization identity from the events it got back', async () => {
		respond([EVENT]);
		const result = await load(loadEvent());
		expect(result.organization?.name).toBe('Acme Collective');
	});

	it('degrades to an empty list when the events request fails', async () => {
		listEvents.mockResolvedValue({
			data: undefined,
			error: { detail: 'boom' }
		} as unknown as ReturnType<typeof eventpublicdiscoveryListEvents>);

		const result = await load(loadEvent());

		expect(result.events).toEqual([]);
		expect(result.organization).toBeNull();
	});
});
