import { describe, it, expect } from 'vitest';
import type {
	EventLinkSchema,
	EventListingSchema,
	SyncReportEntry
} from '$lib/api/generated/types.gen';
import {
	autoSyncChoice,
	autoSyncPayload,
	groupReport,
	hasPendingLink,
	listingView,
	listingsRefetchInterval,
	PENDING_SLOW_AFTER_MS,
	pushBlockers,
	soldTotals
} from './listing-view';

function link(overrides: Partial<EventLinkSchema> = {}): EventLinkSchema {
	return {
		provider: 'eventbrite',
		display_name: 'Eventbrite',
		remote_id: 'ev-1',
		remote_url: 'https://www.eventbrite.com/e/ev-1',
		remote_status: 'draft',
		sync_state: 'in_sync',
		origin: 'pushed',
		auto_sync: null,
		effective_auto_sync: false,
		sync_report: [],
		tiers: [],
		...overrides
	};
}

function listing(overrides: Partial<EventListingSchema> = {}): EventListingSchema {
	return {
		provider: 'eventbrite',
		display_name: 'Eventbrite',
		connection_status: 'active',
		link: null,
		...overrides
	};
}

describe('listingView', () => {
	it('is not-connected when the organization has no connection', () => {
		const v = listingView(listing({ connection_status: null }));
		expect(v.kind).toBe('not-connected');
		expect(v.canPush).toBe(false);
	});

	it('treats a pending account choice as not connected', () => {
		expect(listingView(listing({ connection_status: 'pending' })).kind).toBe('not-connected');
	});

	it.each(['error', 'revoked'] as const)('is access-lost for %s', (status) => {
		const v = listingView(listing({ connection_status: status, link: link() }));
		expect(v.kind).toBe('access-lost');
		expect(v.canPush).toBe(false);
		expect(v.tone).toBe('danger');
	});

	it('is unlisted when connected with no link', () => {
		const v = listingView(listing());
		expect(v.kind).toBe('unlisted');
		expect(v.canPush).toBe(true);
		expect(v.canPublish).toBe(false);
		expect(v.canSetAutoSync).toBe(false);
	});

	it('is pending while a push is in flight, and cannot push again meanwhile', () => {
		const v = listingView(listing({ link: link({ sync_state: 'pending' }) }));
		expect(v.kind).toBe('pending');
		expect(v.canPush).toBe(false);
		expect(v.tone).toBe('info');
	});

	it('is broken when the remote listing is gone, offering a fresh push only', () => {
		const v = listingView(
			listing({ link: link({ sync_state: 'broken', remote_id: '', remote_url: '' }) })
		);
		expect(v.kind).toBe('broken');
		expect(v.canPush).toBe(true);
		expect(v.canView).toBe(false);
		expect(v.canSetAutoSync).toBe(false);
	});

	it('is failed after a non-transient failure, with retry', () => {
		const v = listingView(listing({ link: link({ sync_state: 'failed' }) }));
		expect(v.kind).toBe('failed');
		expect(v.canPush).toBe(true);
		expect(v.tone).toBe('danger');
	});

	it('is draft with publish available', () => {
		const v = listingView(listing({ link: link() }));
		expect(v.kind).toBe('draft');
		expect(v.canPublish).toBe(true);
		expect(v.canView).toBe(true);
	});

	it('is live with update but no publish', () => {
		const v = listingView(listing({ link: link({ remote_status: 'live' }) }));
		expect(v.kind).toBe('live');
		expect(v.canPush).toBe(true);
		expect(v.canPublish).toBe(false);
		expect(v.tone).toBe('success');
	});

	it('is cancelled with view only', () => {
		const v = listingView(listing({ link: link({ remote_status: 'cancelled' }) }));
		expect(v.kind).toBe('cancelled');
		expect(v.canPush).toBe(false);
		expect(v.canView).toBe(true);
		expect(v.canSetAutoSync).toBe(false);
	});

	it('cannot view when the remote url is empty', () => {
		expect(listingView(listing({ link: link({ remote_url: '' }) })).canView).toBe(false);
	});
});

describe('pushBlockers', () => {
	it('is empty for a public, timed, ticketed event', () => {
		expect(
			pushBlockers({ event_type: 'public', end: '2026-10-01T20:00:00Z', requires_ticket: true })
		).toEqual([]);
	});

	it('lists every rule the event breaks', () => {
		expect(pushBlockers({ event_type: 'private', end: '', requires_ticket: false })).toEqual([
			'event_private',
			'event_open_ended',
			'event_no_tickets'
		]);
	});
});

describe('groupReport', () => {
	const entries: SyncReportEntry[] = [
		{ scope: 'event', code: 'unpublish_refused', detail: 'x' },
		{ scope: 'tier', tier_id: 't1', tier_name: 'VIP', code: 'tier_seated', detail: 'x' },
		{ scope: 'event', code: 'image_missing', detail: 'x' },
		{ scope: 'tier', tier_name: 'Remote only', code: 'remote_only_tier', detail: 'x' },
		{ scope: 'event', code: 'provider_rejected', detail: 'x', provider_message: 'raw' }
	];

	it('splits problems, skipped tiers and notes', () => {
		const g = groupReport(entries);
		expect(g.problems.map((e) => e.code)).toEqual(['unpublish_refused', 'provider_rejected']);
		expect(g.skipped.map((e) => e.code)).toEqual(['tier_seated']);
		expect(g.notes.map((e) => e.code)).toEqual(['image_missing', 'remote_only_tier']);
	});

	it('handles an empty report', () => {
		expect(groupReport([])).toEqual({ problems: [], skipped: [], notes: [] });
	});
});

describe('auto-sync choice', () => {
	it('maps the override to a choice and back', () => {
		expect(autoSyncChoice({ auto_sync: null })).toBe('inherit');
		expect(autoSyncChoice({ auto_sync: true })).toBe('on');
		expect(autoSyncChoice({ auto_sync: false })).toBe('off');
		expect(autoSyncPayload('inherit')).toBeNull();
		expect(autoSyncPayload('on')).toBe(true);
		expect(autoSyncPayload('off')).toBe(false);
	});
});

describe('listingsRefetchInterval', () => {
	const pending = [listing({ link: link({ sync_state: 'pending' }) })];
	const settled = [listing({ link: link() })];

	it('polls once a minute when nothing is pending, and not before the first load', () => {
		expect(hasPendingLink(settled)).toBe(false);
		expect(listingsRefetchInterval(settled, null, 0)).toBe(60_000);
		expect(listingsRefetchInterval([], null, 0)).toBe(60_000);
		expect(listingsRefetchInterval(undefined, null, 0)).toBe(false);
	});

	it('polls every 3 s while pending', () => {
		expect(hasPendingLink(pending)).toBe(true);
		expect(listingsRefetchInterval(pending, 1_000, 5_000)).toBe(3_000);
	});

	it('slows to 30 s once pending has lasted ten minutes', () => {
		expect(listingsRefetchInterval(pending, 0, PENDING_SLOW_AFTER_MS)).toBe(30_000);
	});
});

describe('soldTotals', () => {
	it("sums Revel sales and the given platform's sales across tiers", () => {
		const totals = soldTotals(
			[
				{
					quantity_sold: 12,
					external_sales: [
						{ provider: 'eventbrite', quantity_sold: 5, paused: false },
						{ provider: 'other', quantity_sold: 99, paused: false }
					]
				},
				{
					quantity_sold: 3,
					external_sales: [{ provider: 'eventbrite', quantity_sold: 2, paused: true }]
				},
				{ quantity_sold: undefined, external_sales: undefined }
			],
			'eventbrite'
		);
		expect(totals).toEqual({ revel: 15, external: 7 });
	});
});
