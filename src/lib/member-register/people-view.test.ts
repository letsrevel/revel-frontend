import { describe, expect, it } from 'vitest';
import type { MembershipRecordSchema } from '$lib/api/generated/types.gen';
import { DEFAULT_FILTERS } from './filters';
import {
	PEOPLE_VIEWS,
	chipToQuery,
	filtersForView,
	peopleQuery,
	toRequestQuery,
	getPersonStatus,
	parsePeopleFilters,
	peopleFiltersToSearch,
	viewFromFilters
} from './people-view';

const parse = (qs: string) => parsePeopleFilters(new URLSearchParams(qs));

const TODAY = '2026-11-09';

describe('chip <-> register filter mapping', () => {
	it('defaults to "Current" when the URL carries no filters', () => {
		const filters = parse('');
		expect(viewFromFilters(filters)).toBe('current');
		expect(peopleQuery(filters, TODAY)).toMatchObject({ active_on: TODAY, kind: 'standard' });
		expect(peopleQuery(filters, TODAY)).not.toHaveProperty('is_open');
		expect(parse('tab=people').kind).toBe('standard');
	});

	it('maps every chip to its backend params (chipToQuery is the only mapping)', () => {
		expect(chipToQuery('current', TODAY)).toEqual({ active_on: TODAY, kind: 'standard' });
		expect(chipToQuery('day', TODAY)).toEqual({ kind: 'temporary' });
		expect(chipToQuery('ended', TODAY)).toEqual({ ended: true });
		expect(chipToQuery('no-account', TODAY)).toEqual({ has_account: false });
		expect(chipToQuery('everyone', TODAY)).toEqual({});
		// Through the list query: chip params on top of page / page_size, nothing else.
		const everyone = peopleQuery(filtersForView('everyone', parse('')), TODAY);
		expect(everyone).toEqual({ page: 1, page_size: 20 });
		expect(peopleQuery(filtersForView('ended', parse('')), TODAY)).toMatchObject({ ended: true });
	});

	it('keeps search and tier with a chip', () => {
		const tier = '0b8b3a52-7a54-4f6b-9a1e-6c5d1f7a3c11';
		const query = peopleQuery(parse(`q=ada&tier=${tier}`), TODAY);
		expect(query).toMatchObject({ search: 'ada', tier_id: tier, active_on: TODAY });
	});

	it('drops every chip filter in "As of" mode, keeping only the day', () => {
		for (const view of PEOPLE_VIEWS) {
			const filters = { ...filtersForView(view, parse('')), activeOn: '2026-03-12' };
			const query = peopleQuery(filters, TODAY);
			expect(query).toEqual({ page: 1, page_size: 20, active_on: '2026-03-12' });
		}
	});

	it('sends is_open=false for Ended and flags the client-side pass (until the BE filter)', () => {
		const ended = peopleQuery(filtersForView('ended', parse('')), TODAY);
		const { query, clientEnded } = toRequestQuery(ended);
		expect(clientEnded).toBe(true);
		expect(query).toMatchObject({ is_open: false });
		expect(query).not.toHaveProperty('ended');
		const other = toRequestQuery(peopleQuery(parse(''), TODAY));
		expect(other.clientEnded).toBe(false);
		expect(other.query).not.toHaveProperty('is_open');
	});

	it('keeps the raw filters of a combination no chip covers', () => {
		const query = peopleQuery(parse('account=with'), TODAY);
		expect(query).toMatchObject({ has_account: true });
		expect(query).not.toHaveProperty('active_on');
	});

	it('keeps the chip in the URL, omitting only the default', () => {
		expect(peopleFiltersToSearch(parse(''))).toBe('tab=people');
		for (const view of PEOPLE_VIEWS.filter((v) => v !== 'current')) {
			const search = peopleFiltersToSearch(filtersForView(view, parse('')));
			expect(new URLSearchParams(search).get('view')).toBe(view);
			expect(new URLSearchParams(search).get('tab')).toBe('people');
			expect(viewFromFilters(parse(search))).toBe(view);
		}
	});

	it('keeps search, tier, day and page across a chip change and resets the page', () => {
		const tier = '0b8b3a52-7a54-4f6b-9a1e-6c5d1f7a3c11';
		const before = parse(`q=ada&tier=${tier}&on=2026-03-12&page=3`);
		const after = filtersForView('ended', before);
		expect(after).toMatchObject({ search: 'ada', tierId: tier, activeOn: '2026-03-12', page: 1 });
		const roundTrip = parse(peopleFiltersToSearch(after));
		expect(roundTrip).toEqual(after);
	});

	it('still reads the raw filters of links from the retired register page', () => {
		const filters = parse('kind=temporary');
		expect(viewFromFilters(filters)).toBe('day');
		const custom = parse('account=with');
		expect(viewFromFilters(custom)).toBeNull();
		// A combination no chip covers survives a round trip as raw params.
		expect(parse(peopleFiltersToSearch(custom))).toEqual(custom);
	});

	it('lets an explicit view win over stray raw params, and ignores unknown views', () => {
		expect(parse('view=ended&kind=temporary')).toMatchObject({ kind: null, open: 'closed' });
		expect(DEFAULT_FILTERS.kind).toBeNull();
		expect(viewFromFilters(parse('view=nope'))).toBe('current');
	});
});

describe('status vocabulary', () => {
	const NOW = new Date('2026-11-09T12:00:00Z');
	const base: Pick<
		MembershipRecordSchema,
		'valid_from' | 'valid_until' | 'kind' | 'has_account' | 'invite_status'
	> = {
		valid_from: '2026-01-01T00:00:00Z',
		valid_until: null,
		kind: 'standard',
		has_account: false,
		invite_status: 'not_invited'
	};
	const status = (extra: Partial<typeof base>) => getPersonStatus({ ...base, ...extra }, NOW);

	it('maps a record to exactly one status and tone', () => {
		expect(status({ has_account: true, invite_status: 'linked' })).toEqual({
			id: 'active',
			tone: 'success'
		});
		expect(status({ kind: 'temporary' })).toEqual({ id: 'day-member', tone: 'info' });
		expect(status({ valid_until: '2026-02-01T00:00:00Z' })).toEqual({
			id: 'ended',
			tone: 'neutral'
		});
		expect(status({})).toEqual({ id: 'no-account', tone: 'neutral' });
		expect(status({ invite_status: 'invited' })).toEqual({ id: 'invited', tone: 'info' });
		expect(status({ valid_from: '2026-12-01T00:00:00Z' })).toEqual({
			id: 'upcoming',
			tone: 'neutral'
		});
	});

	it('is not "ended" just because an end date is set: only one at or before now', () => {
		// A running day membership (ticket-granted: it always has an end, the event end).
		expect(status({ kind: 'temporary', valid_until: '2026-11-09T18:00:00Z' }).id).toBe(
			'day-member'
		);
		// A standard linked entry that ends in the future is still Active.
		expect(
			status({ has_account: true, invite_status: 'linked', valid_until: '2027-01-01T00:00:00Z' }).id
		).toBe('active');
		// Ended exactly now, and in the past.
		expect(status({ valid_until: NOW.toISOString() }).id).toBe('ended');
		expect(status({ kind: 'temporary', valid_until: '2026-11-08T18:00:00Z' }).id).toBe('ended');
	});

	it('lets "Ended" outrank every other state, and "Upcoming" outrank the rest', () => {
		const closed = '2026-02-01T00:00:00Z';
		expect(status({ valid_until: closed, kind: 'temporary', has_account: true }).id).toBe('ended');
		expect(status({ valid_until: closed, invite_status: 'invited' }).id).toBe('ended');
		expect(status({ valid_from: '2026-12-01T00:00:00Z', kind: 'temporary' }).id).toBe('upcoming');
		expect(status({ valid_from: '2026-12-01T00:00:00Z', has_account: true }).id).toBe('upcoming');
	});
});
