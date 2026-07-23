import { describe, it, expect } from 'vitest';
import type { SeatingAvailabilitySchema, VenueChartSchema } from '$lib/api/generated/types.gen';
import {
	blockedSeatIdsFrom,
	buildOverridesRequest,
	composeHoldReason,
	rejectedEntriesFrom,
	seatViewsFrom,
	sectorGroupsFrom,
	selectionStateFor
} from './seat-override-model';

function chart(): VenueChartSchema {
	return {
		venue_id: 'venue-1',
		venue_name: 'Test Hall',
		updated_at: '2026-07-18T00:00:00Z',
		price_categories: [],
		sectors: [
			{
				id: 'sec-standing',
				name: 'Floor',
				kind: 'standing',
				display_order: 0,
				seats: []
			},
			{
				id: 'sec-balcony',
				name: 'Balcony',
				kind: 'seated',
				display_order: 2,
				seats: [
					{ id: 'b1', label: 'C1', row_label: 'C', row_order: 0, number: 1, adjacency_index: 0 }
				]
			},
			{
				id: 'sec-stalls',
				name: 'Stalls',
				kind: 'seated',
				display_order: 1,
				seats: [
					{ id: 's2', label: 'A2', row_label: 'A', row_order: 0, number: 2, adjacency_index: 1 },
					{ id: 's1', label: 'A1', row_label: 'A', row_order: 0, number: 1, adjacency_index: 0 },
					{
						id: 's-dead',
						label: 'A3',
						row_label: 'A',
						row_order: 0,
						number: 3,
						adjacency_index: 2,
						is_active: false
					},
					{ id: 's3', label: 'B1', row_label: 'B', row_order: 1, number: 1, adjacency_index: 0 }
				]
			}
		]
	};
}

function availability(seats: Record<string, string> = {}): SeatingAvailabilitySchema {
	return { seats, standing: {}, my_holds: [], my_holds_expire_at: null };
}

describe('buildOverridesRequest', () => {
	it('builds a hold payload with the kind-prefixed reason for every selected seat', () => {
		const body = buildOverridesRequest({
			action: 'hold',
			holdKind: 'tech',
			reason: '  camera platform  ',
			selectedSeatIds: ['s1', 's2'],
			blockedSeatIds: new Set()
		});
		expect(body).toEqual({
			set: [
				{ seat_id: 's1', status: 'held', reason: '[tech] camera platform' },
				{ seat_id: 's2', status: 'held', reason: '[tech] camera platform' }
			]
		});
	});

	it('builds a kill payload with the plain trimmed reason', () => {
		const body = buildOverridesRequest({
			action: 'kill',
			holdKind: 'house',
			reason: ' broken seat ',
			selectedSeatIds: ['s1'],
			blockedSeatIds: new Set()
		});
		expect(body).toEqual({
			set: [{ seat_id: 's1', status: 'killed', reason: 'broken seat' }]
		});
	});

	it('deduplicates selected seat ids', () => {
		const body = buildOverridesRequest({
			action: 'kill',
			holdKind: 'house',
			reason: 'x',
			selectedSeatIds: ['s1', 's1'],
			blockedSeatIds: new Set()
		});
		expect(body?.set).toHaveLength(1);
	});

	it('returns null for hold/kill with a blank reason', () => {
		for (const action of ['hold', 'kill'] as const) {
			expect(
				buildOverridesRequest({
					action,
					holdKind: 'house',
					reason: '   ',
					selectedSeatIds: ['s1'],
					blockedSeatIds: new Set()
				})
			).toBeNull();
		}
	});

	it('returns null when nothing is selected', () => {
		expect(
			buildOverridesRequest({
				action: 'hold',
				holdKind: 'house',
				reason: 'why',
				selectedSeatIds: [],
				blockedSeatIds: new Set()
			})
		).toBeNull();
	});

	it('release targets only currently-blocked seats among the selection', () => {
		const body = buildOverridesRequest({
			action: 'release',
			holdKind: 'house',
			reason: '',
			selectedSeatIds: ['s1', 's3'],
			blockedSeatIds: new Set(['s3'])
		});
		expect(body).toEqual({ release_seat_ids: ['s3'] });
	});

	it('returns null for a release with no blocked seats selected', () => {
		expect(
			buildOverridesRequest({
				action: 'release',
				holdKind: 'house',
				reason: '',
				selectedSeatIds: ['s1'],
				blockedSeatIds: new Set(['s3'])
			})
		).toBeNull();
	});

	it('truncates composed reasons to the backend 255-char limit', () => {
		const long = 'x'.repeat(300);
		expect(composeHoldReason('promoter', long)).toHaveLength(255);
		const body = buildOverridesRequest({
			action: 'kill',
			holdKind: 'house',
			reason: long,
			selectedSeatIds: ['s1'],
			blockedSeatIds: new Set()
		});
		expect(body?.set?.[0]?.reason).toHaveLength(255);
	});
});

describe('selectionStateFor', () => {
	it('is none for an empty id list or no matches', () => {
		expect(selectionStateFor(new Set(['a']), [])).toBe('none');
		expect(selectionStateFor(new Set(['a']), ['b', 'c'])).toBe('none');
	});

	it('is some for a partial match and all for a full match', () => {
		expect(selectionStateFor(new Set(['a']), ['a', 'b'])).toBe('some');
		expect(selectionStateFor(new Set(['a', 'b']), ['a', 'b'])).toBe('all');
	});
});

describe('sectorGroupsFrom', () => {
	it('excludes standing sectors and inactive seats, sorted by display_order', () => {
		const groups = sectorGroupsFrom(chart(), availability());
		expect(groups.map((g) => g.name)).toEqual(['Stalls', 'Balcony']);
		expect(groups[0]?.seatIds).toEqual(expect.arrayContaining(['s1', 's2', 's3']));
		expect(groups[0]?.seatIds).not.toContain('s-dead');
	});

	it('groups seats into ordered rows with availability statuses joined in', () => {
		const groups = sectorGroupsFrom(chart(), availability({ s3: 'blocked', s2: 'sold' }));
		const stalls = groups[0];
		expect(stalls?.rows.map((r) => r.rowLabel)).toEqual(['A', 'B']);
		expect(stalls?.rows[0]?.seats.map((s) => s.label)).toEqual(['A1', 'A2']);
		const seats = seatViewsFrom(groups);
		expect(seats.find((s) => s.id === 's2')?.status).toBe('sold');
		expect(seats.find((s) => s.id === 's3')?.status).toBe('blocked');
		expect(blockedSeatIdsFrom(seats)).toEqual(new Set(['s3']));
	});
});

describe('rejectedEntriesFrom', () => {
	it('maps codes to localized labels and resolves seat labels, sorted', () => {
		const labels = new Map([
			['s10', 'A10'],
			['s2', 'A2']
		]);
		const entries = rejectedEntriesFrom({ s10: 'ticketed', s2: 'unknown_seat' }, labels);
		expect(entries).toEqual([
			{ seatId: 's2', seatLabel: 'A2', reason: 'not on this venue' },
			{ seatId: 's10', seatLabel: 'A10', reason: 'has a ticket on this event' }
		]);
	});

	it('falls back to the raw id and code for unknown seats/codes', () => {
		const entries = rejectedEntriesFrom({ ghost: 'weird_code' }, new Map());
		expect(entries).toEqual([{ seatId: 'ghost', seatLabel: 'ghost', reason: 'weird_code' }]);
	});

	it('returns [] for an absent map', () => {
		expect(rejectedEntriesFrom(undefined, new Map())).toEqual([]);
	});
});
