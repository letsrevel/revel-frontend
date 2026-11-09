import { describe, expect, it } from 'vitest';
import type { MembershipRecordSchema } from '$lib/api/generated/types.gen';
import { DEFAULT_FILTERS, filtersToQuery } from './filters';
import {
	PEOPLE_VIEWS,
	VIEW_FILTERS,
	filtersForView,
	getPersonStatus,
	parsePeopleFilters,
	peopleFiltersToSearch,
	viewFromFilters
} from './people-view';

const parse = (qs: string) => parsePeopleFilters(new URLSearchParams(qs));

describe('chip <-> register filter mapping', () => {
	it('defaults to "Current" (open + standard) when the URL carries no filters', () => {
		const filters = parse('');
		expect(viewFromFilters(filters)).toBe('current');
		expect(filtersToQuery(filters)).toMatchObject({ is_open: true, kind: 'standard' });
		expect(parse('tab=people').open).toBe('open');
	});

	it('maps every chip to its backend filters', () => {
		const query = (view: (typeof PEOPLE_VIEWS)[number]) =>
			filtersToQuery({ ...DEFAULT_FILTERS, ...VIEW_FILTERS[view] });
		expect(query('current')).toMatchObject({ is_open: true, kind: 'standard' });
		expect(query('day')).toMatchObject({ kind: 'temporary' });
		expect(query('day')).not.toHaveProperty('is_open');
		expect(query('ended')).toMatchObject({ is_open: false });
		expect(query('ended')).not.toHaveProperty('kind');
		expect(query('no-account')).toMatchObject({ has_account: false });
		const everyone = query('everyone');
		expect(everyone).not.toHaveProperty('is_open');
		expect(everyone).not.toHaveProperty('kind');
		expect(everyone).not.toHaveProperty('has_account');
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
		expect(viewFromFilters(parse('view=nope'))).toBe('current');
	});
});

describe('status vocabulary', () => {
	const base: Pick<
		MembershipRecordSchema,
		'valid_until' | 'kind' | 'has_account' | 'invite_status'
	> = {
		valid_until: null,
		kind: 'standard',
		has_account: false,
		invite_status: 'not_invited'
	};

	it('maps a record to exactly one status and tone', () => {
		expect(getPersonStatus({ ...base, has_account: true, invite_status: 'linked' })).toEqual({
			id: 'active',
			tone: 'success'
		});
		expect(getPersonStatus({ ...base, kind: 'temporary' })).toEqual({
			id: 'day-member',
			tone: 'info'
		});
		expect(getPersonStatus({ ...base, valid_until: '2026-02-01T00:00:00Z' })).toEqual({
			id: 'ended',
			tone: 'neutral'
		});
		expect(getPersonStatus(base)).toEqual({ id: 'no-account', tone: 'neutral' });
		expect(getPersonStatus({ ...base, invite_status: 'invited' })).toEqual({
			id: 'invited',
			tone: 'info'
		});
	});

	it('lets "Ended" outrank every other state', () => {
		const closed = '2026-02-01T00:00:00Z';
		expect(
			getPersonStatus({ ...base, valid_until: closed, kind: 'temporary', has_account: true }).id
		).toBe('ended');
		expect(getPersonStatus({ ...base, valid_until: closed, invite_status: 'invited' }).id).toBe(
			'ended'
		);
	});
});
