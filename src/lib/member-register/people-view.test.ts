import { describe, expect, it } from 'vitest';
import { DEFAULT_FILTERS } from './filters';
import {
	PEOPLE_VIEWS,
	chipToQuery,
	filtersForView,
	peopleQuery,
	canManageMember,
	getPersonStatus,
	parsePeopleFilters,
	peopleFiltersToSearch,
	type PersonStatusInput,
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

	it('sends the real ended=true filter for Ended (no is_open, no client pass)', () => {
		const ended = peopleQuery(filtersForView('ended', parse('')), TODAY);
		expect(ended).toMatchObject({ ended: true });
		expect(ended).not.toHaveProperty('is_open');
		expect(peopleQuery(parse(''), TODAY)).not.toHaveProperty('ended');
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
	const base: PersonStatusInput = {
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

describe('backend status fields (is_current / member_status)', () => {
	const NOW = new Date('2026-11-09T12:00:00Z');
	const base: PersonStatusInput = {
		valid_from: '2026-01-01T00:00:00Z',
		valid_until: null,
		kind: 'standard',
		has_account: true,
		invite_status: 'linked',
		is_current: true,
		member_status: 'active'
	};
	const status = (extra: Partial<PersonStatusInput>) => getPersonStatus({ ...base, ...extra }, NOW);

	it('maps a paused member to Paused, with a warning tone', () => {
		expect(status({ member_status: 'paused' })).toEqual({ id: 'paused', tone: 'warning' });
		expect(status({ member_status: 'active' }).id).toBe('active');
	});

	it('trusts is_current over the dates', () => {
		// An end date in the past, yet the backend says it is current (e.g. clock skew).
		expect(status({ valid_until: '2026-02-01T00:00:00Z' }).id).toBe('active');
		// No end date, yet the backend says it is not current (revoked).
		expect(status({ is_current: false })).toEqual({ id: 'ended', tone: 'neutral' });
		expect(status({ is_current: false, valid_from: '2026-12-01T00:00:00Z' }).id).toBe('upcoming');
	});

	it('reads a banned or cancelled access row as Ended', () => {
		expect(status({ member_status: 'banned' }).id).toBe('ended');
		expect(status({ member_status: 'cancelled' }).id).toBe('ended');
	});

	it('does not show Paused for an ended entry', () => {
		expect(status({ member_status: 'paused', is_current: false }).id).toBe('ended');
	});

	it('falls back to the dates when is_current is missing', () => {
		expect(status({ is_current: undefined, valid_until: '2026-02-01T00:00:00Z' }).id).toBe('ended');
		expect(status({ is_current: undefined, member_status: null }).id).toBe('active');
	});

	it('offers member actions only for linked, current standard entries', () => {
		expect(canManageMember({ ...base, user_id: 'u1' })).toBe(true);
		expect(canManageMember({ ...base, user_id: 'u1', member_status: 'paused' })).toBe(true);
		expect(canManageMember({ ...base, user_id: null })).toBe(false);
		expect(canManageMember({ ...base, user_id: 'u1', is_current: false })).toBe(false);
		expect(canManageMember({ ...base, user_id: 'u1', kind: 'temporary' })).toBe(false);
	});
});
