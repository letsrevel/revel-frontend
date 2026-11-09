import { afterEach, describe, expect, it } from 'vitest';
import type { MembershipRecordSchema } from '$lib/api/generated/types.gen';
import { formatCalendarDay, isCalendarDay, isPickableDay } from './calendar-day';
import { getEditability } from './editability';
import {
	DEFAULT_FILTERS,
	filtersToQuery,
	filtersToSearch,
	hasActiveFilters,
	isRegisterEmpty,
	pageToRedirect,
	parseFilters
} from './filters';
import { getRecordBadges } from './badges';
import {
	buildCreateBody,
	buildEndBody,
	buildUpdateBody,
	formValuesFromRecord,
	reconcileAfterStale,
	validateEndForm,
	validateRecordForm
} from './form-values';
import { resolveOrgTimezone } from './org-timezone';
import { toDateTimeLocal } from '$lib/utils/datetime';

function record(extra: Partial<MembershipRecordSchema> = {}): MembershipRecordSchema {
	return {
		id: 'r1',
		full_name: 'Ada Lovelace',
		email: 'ada@example.org',
		tier_name: 'Full',
		tier_id: 'tier-1',
		kind: 'standard',
		source: 'manual',
		valid_from: '2026-01-10T09:30:00Z',
		valid_until: null,
		created_at: '2026-01-10T09:30:00Z',
		has_account: false,
		invite_status: 'not_invited',
		can_invite: true,
		invite_blocked_reason: null,
		has_duplicate_claim: false,
		...extra
	};
}

describe('filters <-> URL', () => {
	it('round-trips every filter', () => {
		const filters = {
			kind: 'temporary' as const,
			tierId: '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b',
			open: 'closed' as const,
			account: 'without' as const,
			activeOn: '2026-03-12',
			search: 'ada',
			page: 3
		};
		const search = filtersToSearch(filters);
		expect(parseFilters(new URLSearchParams(search))).toEqual(filters);
	});

	it('omits defaults and ignores garbage', () => {
		expect(filtersToSearch(DEFAULT_FILTERS)).toBe('');
		const parsed = parseFilters(
			new URLSearchParams('kind=weird&status=x&account=y&on=2026-02-30&page=-4&q=%20%20')
		);
		expect(parsed).toEqual(DEFAULT_FILTERS);
		expect(hasActiveFilters(parsed)).toBe(false);
	});

	it('maps to the API query with booleans and the raw day', () => {
		const query = filtersToQuery({
			...DEFAULT_FILTERS,
			open: 'open',
			account: 'without',
			activeOn: '2026-03-12',
			search: '  ada ',
			page: 2
		});
		expect(query).toEqual({
			is_open: true,
			has_account: false,
			active_on: '2026-03-12',
			search: 'ada',
			page: 2,
			page_size: 20
		});
	});
});

describe('active_on calendar day', () => {
	const original = process.env.TZ;
	afterEach(() => {
		if (original === undefined) delete process.env.TZ;
		else process.env.TZ = original;
	});

	it('validates real days only', () => {
		expect(isCalendarDay('2026-03-12')).toBe(true);
		expect(isCalendarDay('2026-02-29')).toBe(false);
		expect(isCalendarDay('2024-02-29')).toBe(true);
		expect(isCalendarDay('2026-03-12T00:00:00+01:00')).toBe(false);
		expect(isCalendarDay('')).toBe(false);
	});

	it.each(['Pacific/Auckland', 'America/Los_Angeles', 'Europe/Vienna'])(
		'is sent and shown unshifted when the browser is in %s',
		(tz) => {
			process.env.TZ = tz;
			const query = filtersToQuery({ ...DEFAULT_FILTERS, activeOn: '2026-03-12' });
			expect(query.active_on).toBe('2026-03-12');
			expect(filtersToSearch({ ...DEFAULT_FILTERS, activeOn: '2026-03-12' })).toBe('on=2026-03-12');
			const readback = formatCalendarDay('2026-03-12');
			expect(readback).toContain('12');
			expect(readback).toContain('2026');
			// textual month, never numeric
			expect(readback).toMatch(/[A-Za-z]{3}/);
		}
	);
});

describe('org timezone', () => {
	it('reads the backend-resolved organization timezone', () => {
		expect(resolveOrgTimezone({ timezone: 'Europe/Rome' })).toBe('Europe/Rome');
		expect(resolveOrgTimezone({ timezone: 'America/New_York' })).toBe('America/New_York');
	});
	it('returns null (generic label) when the timezone is missing or blank', () => {
		expect(resolveOrgTimezone({})).toBeNull();
		expect(resolveOrgTimezone({ timezone: '  ' })).toBeNull();
		expect(resolveOrgTimezone({ timezone: null })).toBeNull();
		expect(resolveOrgTimezone(null)).toBeNull();
		expect(resolveOrgTimezone(undefined)).toBeNull();
	});
});

describe('badge mapper', () => {
	const ids = (r: MembershipRecordSchema) => getRecordBadges(r).map((b) => b.id);

	it('flags an account-less manual entry', () => {
		expect(ids(record())).toEqual(['no-account', 'invite-not-invited']);
	});

	it('maps day member, approximate dates and merged', () => {
		const r = record({ kind: 'temporary', source: 'backfill', merged_into_id: 'x' });
		expect(ids(r)).toEqual(expect.arrayContaining(['day-member', 'approximate-dates', 'merged']));
		expect(ids(r)).not.toContain('invite-not-invited');
	});

	it('shows invited with its date, linked, and the automatic-link note', () => {
		expect(
			getRecordBadges(
				record({ invite_status: 'invited', invited_at: '2026-02-01T10:00:00Z' })
			).find((b) => b.id === 'invite-invited')?.label
		).toMatch(/2026/);
		const linked = ids(
			record({ has_account: true, invite_status: 'linked', linked_via: 'auto_email' })
		);
		expect(linked).toEqual(expect.arrayContaining(['linked', 'linked-auto']));
		expect(linked).not.toContain('no-account');
	});

	it('flags duplicate claims and closed entries without a reason', () => {
		const r = record({ has_duplicate_claim: true, valid_until: '2026-02-01T00:00:00Z' });
		expect(ids(r)).toEqual(expect.arrayContaining(['duplicate-claim', 'reason-not-recorded']));
		expect(ids({ ...r, ended_reason: 'cancelled' })).toContain('ended');
	});
});

describe('editability rules', () => {
	it('unlinked entries are fully editable, including closing', () => {
		const e = getEditability(record());
		expect(e).toMatchObject({
			linkedOpen: false,
			tierLocked: false,
			validUntilLocked: false,
			reopenBlocked: false,
			canEnd: true,
			endCancelsMembership: false
		});
	});

	it('linked open entries lock tier and valid_until, and warn on end', () => {
		const e = getEditability(record({ has_account: true }));
		expect(e).toMatchObject({
			linkedOpen: true,
			tierLocked: true,
			tierLockReason: 'linked',
			validUntilLocked: true,
			validFromNotFuture: true,
			endCancelsMembership: true
		});
	});

	it('linked closed entries cannot be reopened; closed entries cannot be ended again', () => {
		const e = getEditability(record({ has_account: true, valid_until: '2026-02-01T00:00:00Z' }));
		expect(e.reopenBlocked).toBe(true);
		expect(e.tierLocked).toBe(false);
		expect(e.canEnd).toBe(false);
	});

	it('locks the tier of day memberships', () => {
		expect(getEditability(record({ kind: 'temporary' })).tierLockReason).toBe('day-member');
	});
});

const EMPTY = { fullName: '', email: '', tierId: '', validFrom: '', validUntil: '' };

describe('form values', () => {
	it('never sends null for full_name, tier_id or valid_from, and only changed fields', () => {
		const rec = record();
		const original = formValuesFromRecord(rec);
		const e = getEditability(rec);
		expect(buildUpdateBody(original, { ...original }, e)).toEqual({});
		const body = buildUpdateBody(
			original,
			{ ...original, fullName: '   ', tierId: '', validFrom: '' },
			e
		);
		expect(body).not.toHaveProperty('full_name');
		expect(body).not.toHaveProperty('tier_id');
		expect(body).not.toHaveProperty('valid_from');
	});

	it('clears email and valid_until with null on unlinked entries only', () => {
		const rec = record({ valid_until: '2026-02-01T10:00:00Z' });
		const original = formValuesFromRecord(rec);
		const cleared = { ...original, email: '', validUntil: '' };
		expect(buildUpdateBody(original, cleared, getEditability(rec))).toEqual({
			email: null,
			valid_until: null
		});
		const linked = record({ has_account: true, valid_until: '2026-02-01T10:00:00Z' });
		expect(buildUpdateBody(original, cleared, getEditability(linked))).toEqual({ email: null });
	});

	it('does not send locked fields for linked open entries', () => {
		const rec = record({ has_account: true });
		const original = formValuesFromRecord(rec);
		const body = buildUpdateBody(
			original,
			{ ...original, fullName: 'Ada L.', tierId: 'other', validUntil: '2030-01-01T10:00' },
			getEditability(rec)
		);
		expect(body).toEqual({ full_name: 'Ada L.' });
	});

	it('converts datetime-local honestly and round-trips', () => {
		const local = toDateTimeLocal('2026-03-12T10:30:00Z');
		// the instant sent equals the instant the local wall time denotes
		const body = buildCreateBody({ ...EMPTY, fullName: 'A', tierId: 't', validFrom: local });
		expect(new Date(body.valid_from).getTime()).toBe(new Date(local).getTime());
		expect(buildCreateBody({ ...EMPTY, validFrom: '' }).valid_from).toBe('');
		expect(buildCreateBody({ ...EMPTY, validFrom: 'garbage' }).valid_from).toBe('');
	});

	it('validates create input and builds the body', () => {
		const empty = validateRecordForm(
			{ fullName: ' ', email: 'nope', tierId: '', validFrom: '', validUntil: '' },
			{ mode: 'create' }
		);
		expect(empty).toMatchObject({
			fullName: 'nameRequired',
			email: 'emailInvalid',
			tierId: 'tierRequired',
			validFrom: 'validFromRequired'
		});
		const values = {
			fullName: '  Ada  ',
			email: '',
			tierId: 't1',
			validFrom: '2026-01-01T10:00',
			validUntil: ''
		};
		expect(validateRecordForm(values, { mode: 'create' })).toEqual({});
		const body = buildCreateBody(values);
		expect(body.full_name).toBe('Ada');
		expect(body).not.toHaveProperty('email');
		expect(body).not.toHaveProperty('valid_until');
	});

	it('rejects a future start for linked open entries and an end before the start', () => {
		const e = getEditability(record({ has_account: true }));
		const future = new Date(Date.now() + 86_400_000);
		const local = toDateTimeLocal(future.toISOString());
		const errors = validateRecordForm(
			{ fullName: 'A', email: '', tierId: 't', validFrom: local, validUntil: '' },
			{ mode: 'edit', editability: e }
		);
		expect(errors.validFrom).toBe('validFromFuture');
		expect(
			validateRecordForm(
				{
					fullName: 'A',
					email: '',
					tierId: 't',
					validFrom: '2026-02-01T10:00',
					validUntil: '2026-01-01T10:00'
				},
				{ mode: 'create' }
			).validUntil
		).toBe('rangeInvalid');
	});

	it('end form: reason, optional date, linked future is refused', () => {
		expect(buildEndBody({ reason: 'removed', validUntil: '' })).toEqual({ reason: 'removed' });
		const rec = record({ has_account: true });
		const future = toDateTimeLocal(new Date(Date.now() + 86_400_000).toISOString());
		expect(
			validateEndForm({ reason: 'cancelled', validUntil: future }, rec, { linked: true })
		).toBe('future');
		expect(
			validateEndForm({ reason: 'cancelled', validUntil: future }, rec, { linked: false })
		).toBeNull();
		expect(
			validateEndForm({ reason: 'cancelled', validUntil: '2020-01-01T00:00' }, rec, {
				linked: false
			})
		).toBe('beforeStart');
	});
});

describe('review fixes', () => {
	it('refuses clearing the end date of a closed linked entry', () => {
		const rec = record({ has_account: true, valid_until: '2026-02-01T10:00:00Z' });
		const original = formValuesFromRecord(rec);
		const errors = validateRecordForm(
			{ ...original, validUntil: '' },
			{ mode: 'edit', editability: getEditability(rec), original }
		);
		expect(errors.validUntil).toBe('noReopen');
		expect(
			validateRecordForm(original, { mode: 'edit', editability: getEditability(rec), original })
		).toEqual({});
	});

	it('does not re-validate an untouched valid_from on a linked open entry', () => {
		const rec = record({ has_account: true, valid_from: '2999-01-01T10:00:00Z' });
		const original = formValuesFromRecord(rec);
		const opts = { mode: 'edit' as const, editability: getEditability(rec), original };
		expect(validateRecordForm(original, opts).validFrom).toBeUndefined();
		const touched = { ...original, validFrom: toDateTimeLocal('2998-01-01T10:00:00Z') };
		expect(validateRecordForm(touched, opts).validFrom).toBe('validFromFuture');
	});

	it('reconciles after a stale 409: keeps open fields, reports dropped locked ones', () => {
		const before = record();
		const original = formValuesFromRecord(before);
		const typed = {
			...original,
			fullName: 'Ada K.',
			tierId: 'tier-2',
			validUntil: '2030-01-01T10:00'
		};
		const after = record({ has_account: true });
		const result = reconcileAfterStale(
			original,
			typed,
			formValuesFromRecord(after),
			getEditability(after)
		);
		expect(result.values.fullName).toBe('Ada K.');
		expect(result.values.tierId).toBe('tier-1');
		expect(result.values.validUntil).toBe('');
		expect(result.dropped).toEqual(['tier', 'validUntil']);
		const calm = reconcileAfterStale(original, original, original, getEditability(before));
		expect(calm.dropped).toEqual([]);
	});

	it('keeps the user typing when nothing got locked', () => {
		const rec = record();
		const original = formValuesFromRecord(rec);
		const typed = { ...original, tierId: 'tier-2' };
		const r = reconcileAfterStale(original, typed, original, getEditability(rec));
		expect(r.values.tierId).toBe('tier-2');
		expect(r.dropped).toEqual([]);
	});

	it('only accepts well-formed tier ids from the URL', () => {
		const id = '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b';
		expect(parseFilters(new URLSearchParams(`tier=${id}`)).tierId).toBe(id);
		expect(parseFilters(new URLSearchParams('tier=not-a-uuid')).tierId).toBeNull();
	});

	it('only treats complete, plausible days as pickable', () => {
		expect(isPickableDay('2026-03-12')).toBe(true);
		expect(isPickableDay('0002-03-12')).toBe(false);
		expect(isPickableDay('2200-01-01')).toBe(false);
		expect(isPickableDay('2026-03')).toBe(false);
	});

	it('redirects past-the-end pages to the last valid page', () => {
		expect(pageToRedirect(0, 25, 4)).toBe(2);
		expect(pageToRedirect(0, 20, 2)).toBe(1);
		expect(pageToRedirect(0, 0, 3)).toBeNull();
		expect(pageToRedirect(5, 25, 2)).toBeNull();
		expect(pageToRedirect(0, 25, 1)).toBeNull();
	});
});

describe('isRegisterEmpty', () => {
	it('is empty only for a zero count under the default filters', () => {
		expect(isRegisterEmpty(0, DEFAULT_FILTERS)).toBe(true);
		expect(isRegisterEmpty(3, DEFAULT_FILTERS)).toBe(false);
		expect(isRegisterEmpty(0, { ...DEFAULT_FILTERS, search: 'ada' })).toBe(false);
		expect(isRegisterEmpty(0, { ...DEFAULT_FILTERS, open: 'closed' })).toBe(false);
	});
});
