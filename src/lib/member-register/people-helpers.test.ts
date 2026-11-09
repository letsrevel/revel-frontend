import { describe, expect, it, vi } from 'vitest';
import type {
	MembershipRecordSchema,
	OrganizationMemberSchema
} from '$lib/api/generated/types.gen';

const sdk = vi.hoisted(() => ({ organizationadminmemberregisterListMemberRegister: vi.fn() }));
vi.mock('$lib/api', () => sdk);
vi.mock('$lib/api/client', () => ({ client: {} }));

import { calendarDayInZone } from './calendar-day';
import { EMPTY_FORM, isInvitableAtCreation } from './form-values';
import { findMemberByUserId } from './find-member';
import { countRegister, listPeople, listPersonPeriods } from './api';

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

function member(id: string, email: string): OrganizationMemberSchema {
	return {
		user: { id, email, display_name: email },
		member_since: '2026-01-01T00:00:00Z',
		status: 'active'
	} as OrganizationMemberSchema;
}

describe('findMemberByUserId (member actions keyed on the user)', () => {
	const target = { user_id: 'u1', email: 'old@example.org', full_name: 'Ada Lovelace' };

	it('uses the exact user-id match', async () => {
		const mine = member('u1', 'new@x.org');
		const find = vi.fn().mockResolvedValue([member('u2', 'other@example.org'), mine]);
		await expect(findMemberByUserId(target, find)).resolves.toBe(mine);
		expect(find).toHaveBeenCalledWith('old@example.org');
	});

	it('tries the name when the register email finds nobody', async () => {
		const mine = member('u1', 'new@x.org');
		const find = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([mine]);
		await expect(findMemberByUserId(target, find)).resolves.toBe(mine);
		expect(find).toHaveBeenLastCalledWith('Ada Lovelace');
	});

	it('resolves null when nothing matches or the lookup fails', async () => {
		await expect(findMemberByUserId(target, vi.fn().mockResolvedValue([]))).resolves.toBeNull();
		await expect(
			findMemberByUserId(target, vi.fn().mockRejectedValue(new Error('boom')))
		).resolves.toBeNull();
		await expect(findMemberByUserId({ ...target, user_id: null }, vi.fn())).resolves.toBeNull();
	});

	it('never matches a different user that shares the email text', async () => {
		const find = vi.fn().mockResolvedValue([member('u9', 'old@example.org')]);
		await expect(findMemberByUserId(target, find)).resolves.toBeNull();
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
		const sent = sdk.organizationadminmemberregisterListMemberRegister.mock.calls[0][0].query;
		expect(sent).toEqual({ page: 1, page_size: 20, ended: true });
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
