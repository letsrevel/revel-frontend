import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MembershipRecordSchema } from '$lib/api/generated/types.gen';

const sdk = vi.hoisted(() => ({
	organizationadminmemberregisterListMemberRegister: vi.fn(),
	organizationadminmemberregisterExportMemberRegister: vi.fn()
}));
vi.mock('$lib/api', () => sdk);
vi.mock('$lib/api/client', () => ({ client: {} }));
const gen = vi.hoisted(() => ({ getMember: vi.fn() }));
vi.mock('$lib/api/generated/sdk.gen', () => ({ organizationadminmembersGetMember: gen.getMember }));

import { calendarDayInZone } from './calendar-day';
import { EMPTY_FORM, isInvitableAtCreation } from './form-values';
import { fetchMemberAccess, memberAccessKey, memberAccessPrefix } from './member-access';
import { pickCurrentEntry } from './person-target';
import {
	countRegister,
	listMergedInto,
	listPeople,
	listPersonPeriods,
	resolveActiveNow,
	startRegisterExport
} from './api';
import { ACTIVE_NOW } from './people-view';
import { makeRecord } from '$lib/components/member-register/person-fixtures';

describe('calendarDayInZone', () => {
	it('reads the wall-clock day of the organization, not the viewer', () => {
		const instant = new Date('2026-11-09T23:30:00Z');
		expect(calendarDayInZone('UTC', instant)).toBe('2026-11-09');
		expect(calendarDayInZone('Europe/Berlin', instant)).toBe('2026-11-10');
		expect(calendarDayInZone('America/Los_Angeles', instant)).toBe('2026-11-09');
	});

	it('falls back to a day for a missing or unknown zone', () => {
		expect(calendarDayInZone(null)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(calendarDayInZone('Not/AZone')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});
});

describe('isInvitableAtCreation', () => {
	const now = new Date('2026-11-09T12:00:00Z');
	const base = { ...EMPTY_FORM, email: 'ada@example.org', validFrom: '2026-11-01T09:00' };

	it('needs an address that looks valid', () => {
		expect(isInvitableAtCreation(base, now)).toBe(true);
		expect(isInvitableAtCreation({ ...base, email: '' }, now)).toBe(false);
		expect(isInvitableAtCreation({ ...base, email: 'nope' }, now)).toBe(false);
	});

	it('needs a start that has passed', () => {
		expect(isInvitableAtCreation({ ...base, validFrom: '2026-12-01T09:00' }, now)).toBe(false);
		expect(isInvitableAtCreation({ ...base, validFrom: '' }, now)).toBe(false);
	});

	it('refuses an end already in the past, but not a future one', () => {
		expect(isInvitableAtCreation({ ...base, validUntil: '2026-11-05T09:00' }, now)).toBe(false);
		expect(isInvitableAtCreation({ ...base, validUntil: '2027-01-01T09:00' }, now)).toBe(true);
	});
});

describe('fetchMemberAccess (the single-member GET)', () => {
	it('returns the access row of any status', async () => {
		const row = { status: 'cancelled', user: { id: 'u1' } };
		gen.getMember.mockResolvedValue({ data: row, response: { status: 200 } });
		await expect(fetchMemberAccess('acme', 'tok', 'u1')).resolves.toBe(row);
		expect(gen.getMember).toHaveBeenCalledWith(
			expect.objectContaining({ path: { slug: 'acme', user_id: 'u1' } })
		);
	});

	it('resolves null on a 404 (no access row)', async () => {
		gen.getMember.mockResolvedValue({ error: { detail: 'nf' }, response: { status: 404 } });
		await expect(fetchMemberAccess('acme', 'tok', 'u1')).resolves.toBeNull();
	});

	it('throws every other failure so TanStack retries', async () => {
		gen.getMember.mockResolvedValue({ error: { detail: 'boom' }, response: { status: 500 } });
		await expect(fetchMemberAccess('acme', 'tok', 'u1')).rejects.toThrow();
		await expect(fetchMemberAccess('acme', null, 'u1')).rejects.toThrow();
	});

	it('is keyed OUTSIDE the members-list prefix, so a note save never refetches it', () => {
		const key = memberAccessKey('acme', 'u1');
		expect(key.slice(0, 3)).toEqual(['organization', 'acme', 'member']);
		const listPrefix = ['organization', 'acme', 'members'];
		const registerPrefix = ['organization', 'acme', 'member-register'];
		for (const prefix of [listPrefix, registerPrefix]) {
			expect(key.slice(0, prefix.length)).not.toEqual(prefix);
		}
		expect(memberAccessPrefix('acme')).toEqual(['organization', 'acme', 'member']);
	});
});

describe('pickCurrentEntry', () => {
	const ended = makeRecord({ id: 'a', is_current: false, valid_from: '2026-01-01T00:00:00Z' });
	const current = makeRecord({ id: 'b', is_current: true, valid_from: '2026-06-01T00:00:00Z' });

	it('prefers the current entry, even when an older one started later', () => {
		const late = makeRecord({ id: 'c', is_current: false, valid_from: '2026-09-01T00:00:00Z' });
		expect(pickCurrentEntry([ended, late, current])?.id).toBe('b');
	});

	it('falls back to the latest start when nothing is current', () => {
		const later = makeRecord({ id: 'c', is_current: false, valid_from: '2026-03-01T00:00:00Z' });
		expect(pickCurrentEntry([ended, later])?.id).toBe('c');
	});

	it('ignores merged entries and prefers the kind the sheet was opened on', () => {
		const merged = makeRecord({ id: 'm', is_current: true, merged_into_id: 'b' });
		const day = makeRecord({ id: 'd', kind: 'temporary', is_current: true });
		expect(pickCurrentEntry([merged])).toBeNull();
		expect(pickCurrentEntry([day, current], 'standard')?.id).toBe('b');
		expect(pickCurrentEntry([day, current], 'temporary')?.id).toBe('d');
		expect(pickCurrentEntry([])).toBeNull();
	});
});

describe('merged_into and export include_merged', () => {
	it('asks for the entries merged into one survivor', async () => {
		sdk.organizationadminmemberregisterListMemberRegister.mockResolvedValue({
			data: { count: 0, next: null, previous: null, results: [] }
		});
		await listMergedInto('acme', 'tok', 'r2');
		expect(
			sdk.organizationadminmemberregisterListMemberRegister.mock.calls.at(-1)?.[0].query
		).toMatchObject({ merged_into: 'r2' });
	});

	it('sends include_merged only when asked', async () => {
		sdk.organizationadminmemberregisterExportMemberRegister.mockResolvedValue({
			data: { id: 'x' }
		});
		await startRegisterExport('acme', 'tok', null);
		expect(
			sdk.organizationadminmemberregisterExportMemberRegister.mock.calls.at(-1)?.[0].body
		).toEqual({});
		await startRegisterExport('acme', 'tok', null, true);
		expect(
			sdk.organizationadminmemberregisterExportMemberRegister.mock.calls.at(-1)?.[0].body
		).toEqual({ include_merged: true });
		await startRegisterExport('acme', 'tok', '2026-11-01', false);
		expect(
			sdk.organizationadminmemberregisterExportMemberRegister.mock.calls.at(-1)?.[0].body
		).toEqual({ active_on: '2026-11-01' });
	});
});

describe('resolveActiveNow', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('replaces the placeholder with the exact current ISO instant', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-11-09T01:30:00.000Z'));
		expect(resolveActiveNow({ page: 1, page_size: 20, active_at: ACTIVE_NOW })).toEqual({
			page: 1,
			page_size: 20,
			active_at: '2026-11-09T01:30:00.000Z'
		});
	});

	it('leaves every other query untouched', () => {
		const query = { page: 1, page_size: 20, active_on: '2026-03-12', kind: 'standard' as const };
		expect(resolveActiveNow(query)).toBe(query);
		const instant = { page: 1, page_size: 20, active_at: '2026-03-12T10:00:00.000Z' };
		expect(resolveActiveNow(instant)).toBe(instant);
	});
});

describe('listPeople / countRegister', () => {
	const NOW = new Date('2026-11-09T12:00:00Z');
	const row = (id: string, valid_until: string | null): Partial<MembershipRecordSchema> => ({
		id,
		kind: 'standard',
		valid_from: '2026-01-01T00:00:00Z',
		valid_until,
		has_account: false,
		invite_status: 'not_invited'
	});

	it('sends the Ended chip to the backend as ended=true and returns its rows untouched', async () => {
		sdk.organizationadminmemberregisterListMemberRegister.mockResolvedValue({
			data: {
				count: 2,
				next: null,
				previous: null,
				results: [row('past', '2026-10-01T00:00:00Z'), row('now', NOW.toISOString())]
			}
		});
		const page = await listPeople('org', 'tok', { page: 1, page_size: 20, ended: true });
		expect(page.results.map((r) => r.id)).toEqual(['past', 'now']);
		expect(page.count).toBe(2);
		const sent = sdk.organizationadminmemberregisterListMemberRegister.mock.calls.at(-1)?.[0].query;
		expect(sent).toEqual({ page: 1, page_size: 20, ended: true });
	});

	it('sends Current as a real ISO instant, never the placeholder', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-11-09T01:30:00.000Z'));
		try {
			sdk.organizationadminmemberregisterListMemberRegister.mockResolvedValue({
				data: { count: 0, next: null, previous: null, results: [] }
			});
			await listPeople('org', 'tok', {
				page: 1,
				page_size: 20,
				active_at: ACTIVE_NOW,
				kind: 'standard'
			});
			const sent =
				sdk.organizationadminmemberregisterListMemberRegister.mock.calls.at(-1)?.[0].query;
			expect(sent).toEqual({
				page: 1,
				page_size: 20,
				active_at: '2026-11-09T01:30:00.000Z',
				kind: 'standard'
			});
			expect(sent).not.toHaveProperty('active_on');
		} finally {
			vi.useRealTimers();
		}
	});

	it("lists a person's periods with user_id and include_merged", async () => {
		sdk.organizationadminmemberregisterListMemberRegister.mockResolvedValue({
			data: { count: 0, next: null, previous: null, results: [] }
		});
		await listPersonPeriods('org', 'tok', 'u1');
		const sent = sdk.organizationadminmemberregisterListMemberRegister.mock.calls.at(-1)?.[0].query;
		expect(sent).toMatchObject({ user_id: 'u1', include_merged: true });
	});

	it('counts the whole register with an unfiltered one-row page', async () => {
		sdk.organizationadminmemberregisterListMemberRegister.mockResolvedValue({
			data: { count: 0, next: null, previous: null, results: [] }
		});
		await expect(countRegister('org', 'tok')).resolves.toBe(0);
		expect(
			sdk.organizationadminmemberregisterListMemberRegister.mock.calls.at(-1)?.[0].query
		).toEqual({
			page: 1,
			page_size: 1
		});
	});
});
