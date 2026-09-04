import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/api', () => ({
	eventpublicdetailsGetEvent: vi.fn(),
	eventpublicattendanceGetMyEventStatus: vi.fn(),
	potluckListPotluckItems: vi.fn(),
	permissionMyPermissions: vi.fn(),
	eventpublicdetailsListResources: vi.fn(),
	eventpublicticketsListTiers: vi.fn(),
	eventpublicdiscoveryGetEventTokenDetails: vi.fn(),
	userpreferencesGetGeneralPreferences: vi.fn()
}));
vi.mock('$lib/server/logger', () => ({
	log: { warning: vi.fn(), error: vi.fn(), debug: vi.fn(), info: vi.fn() }
}));
vi.mock('$lib/seo', () => ({ buildSeo: vi.fn(() => ({})) }));
vi.mock('$lib/seo/server', () => ({ resolveLang: vi.fn(() => 'en') }));

import {
	eventpublicdetailsGetEvent,
	eventpublicdetailsListResources,
	eventpublicticketsListTiers,
	eventpublicdiscoveryGetEventTokenDetails
} from '$lib/api';
import { load } from './+page.server';

const getEvent = vi.mocked(eventpublicdetailsGetEvent);
const listResources = vi.mocked(eventpublicdetailsListResources);
const listTiers = vi.mocked(eventpublicticketsListTiers);
const getTokenDetails = vi.mocked(eventpublicdiscoveryGetEventTokenDetails);

const EVENT = {
	id: 'event-1',
	name: 'Test Event',
	slug: 'test-event',
	start: new Date(Date.now() + 86_400_000).toISOString(),
	status: 'open',
	requires_ticket: true,
	organization: { id: 'org-1', slug: 'test-org' }
};

function ok<T>(data: T): { data: T; error: undefined } {
	return { data, error: undefined };
}

/** Minimal stand-in for the SvelteKit load event this loader actually reads. */
function loadEvent(
	options: { search?: string; cookieToken?: string | null } = {}
): Parameters<typeof load>[0] {
	return {
		params: { id: 'event-1' },
		locals: { user: null },
		fetch: globalThis.fetch,
		url: new URL(`https://letsrevel.io/events/event-1${options.search ?? ''}`),
		request: new Request(`https://letsrevel.io/events/event-1${options.search ?? ''}`),
		setHeaders: vi.fn(),
		cookies: {
			get: vi.fn((name: string) =>
				name === 'pending_event_token' ? (options.cookieToken ?? undefined) : undefined
			)
		}
	} as unknown as Parameters<typeof load>[0];
}

// Backend #923 (8449afb7): the tier listing honours X-Event-Token for
// anonymous viewers — with a granting invitation link it lists the private
// tiers the link unlocks and reports can_purchase honestly. Without the
// header the listing silently falls back to public-only, so the token must
// ride every tier-list fetch: from ?et= on the first navigation, and from the
// pending_event_token cookie (set by hooks.server.ts) on later ones.
describe('event [id] loader — invitation-link token', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		getEvent.mockResolvedValue(ok(EVENT) as never);
		listResources.mockResolvedValue(ok({ results: [] }) as never);
		listTiers.mockResolvedValue(ok([]) as never);
		getTokenDetails.mockResolvedValue(
			ok({ id: 'tok-1', event: 'event-1', grants_invitation: true }) as never
		);
	});

	it('sends X-Event-Token on the tier listing when ?et= is present', async () => {
		await load(loadEvent({ search: '?et=tok-1' }));

		expect(listTiers).toHaveBeenCalledWith(
			expect.objectContaining({
				headers: expect.objectContaining({ 'X-Event-Token': 'tok-1' })
			})
		);
	});

	it('falls back to the pending_event_token cookie when ?et= is absent', async () => {
		getTokenDetails.mockResolvedValue(
			ok({ id: 'tok-2', event: 'event-1', grants_invitation: true }) as never
		);
		await load(loadEvent({ cookieToken: 'tok-2' }));

		expect(listTiers).toHaveBeenCalledWith(
			expect.objectContaining({
				headers: expect.objectContaining({ 'X-Event-Token': 'tok-2' })
			})
		);
	});

	it('treats an empty ?et= as absent and still falls back to the cookie', async () => {
		// URLSearchParams.get('et') returns '' for a bare `?et=`; `??` would
		// keep it and suppress a valid pending_event_token cookie.
		getTokenDetails.mockResolvedValue(
			ok({ id: 'tok-2', event: 'event-1', grants_invitation: true }) as never
		);
		await load(loadEvent({ search: '?et=', cookieToken: 'tok-2' }));

		expect(listTiers).toHaveBeenCalledWith(
			expect.objectContaining({
				headers: expect.objectContaining({ 'X-Event-Token': 'tok-2' })
			})
		);
	});

	it('sends no token header without ?et= or cookie', async () => {
		await load(loadEvent());

		const headers = listTiers.mock.calls[0][0]?.headers ?? {};
		expect(headers).not.toHaveProperty('X-Event-Token');
		expect(getTokenDetails).not.toHaveBeenCalled();
	});

	it('returns the token details when they belong to this event', async () => {
		const result = await load(loadEvent({ search: '?et=tok-1' }));
		expect(result.eventTokenDetails?.id).toBe('tok-1');
	});

	it('discards token details for another event', async () => {
		// The cookie is global, not event-scoped: a pending token for event A
		// must not surface invitation UI (or ride guest mutations) on event B.
		getTokenDetails.mockResolvedValue(
			ok({ id: 'tok-other', event: 'other-event', grants_invitation: true }) as never
		);
		const result = await load(loadEvent({ cookieToken: 'tok-other' }));
		expect(result.eventTokenDetails).toBeNull();
	});
});
