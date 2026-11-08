import { afterEach, describe, expect, it } from 'vitest';
import type { MembershipRecordSchema } from '$lib/api/generated/types.gen';
import { formatCalendarDay, isCalendarDay } from './calendar-day';
import { getEditability } from './editability';
import {
	DEFAULT_FILTERS,
	filtersToQuery,
	filtersToSearch,
	hasActiveFilters,
	parseFilters
} from './filters';
import { getRecordBadges } from './badges';
import {
	buildCreateBody,
	buildEndBody,
	buildUpdateBody,
	formValuesFromRecord,
	isoToLocalInput,
	localInputToIso,
	validateEndForm,
	validateRecordForm
} from './form-values';
import { resolveOrgTimezone } from './org-timezone';

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
		has_duplicate_claim: false,
		...extra
	};
}

describe('filters <-> URL', () => {
	it('round-trips every filter', () => {
		const filters = {
			kind: 'temporary' as const,
			tierId: 'tier-9',
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
	it('falls back to the platform default without a city', () => {
		expect(resolveOrgTimezone({ city: null })).toBe('Europe/Vienna');
		expect(resolveOrgTimezone(undefined)).toBe('Europe/Vienna');
	});
	it('uses the city timezone when exposed, null when a city hides it', () => {
		expect(resolveOrgTimezone({ city: { timezone: 'Europe/Rome' } })).toBe('Europe/Rome');
		expect(resolveOrgTimezone({ city: {} })).toBeNull();
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
		const local = isoToLocalInput('2026-03-12T10:30:00Z');
		expect(localInputToIso(local)).toBe(new Date(local).toISOString());
		expect(localInputToIso('')).toBeNull();
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
		const local = isoToLocalInput(future.toISOString());
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
		const future = isoToLocalInput(new Date(Date.now() + 86_400_000).toISOString());
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
