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
import { resolveAccessSearch } from './manage-access';
import { countRegister, listPeople } from './api';

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

describe('resolveAccessSearch (Manage access keyed on the user)', () => {
	const target = { user_id: 'u1', email: 'old@example.org', full_name: 'Ada Lovelace' };

	it('uses the exact user-id match and its CURRENT email', async () => {
		const find = vi
			.fn()
			.mockResolvedValue([member('u2', 'other@example.org'), member('u1', 'new@x.org')]);
		await expect(resolveAccessSearch(target, find)).resolves.toBe('new@x.org');
		expect(find).toHaveBeenCalledWith('old@example.org');
	});

	it('tries the name when the register email finds nobody', async () => {
		const find = vi
			.fn()
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([member('u1', 'new@x.org')]);
		await expect(resolveAccessSearch(target, find)).resolves.toBe('new@x.org');
		expect(find).toHaveBeenLastCalledWith('Ada Lovelace');
	});

	it('falls back to the entry email, then its name, when nothing matches or the lookup fails', async () => {
		await expect(resolveAccessSearch(target, vi.fn().mockResolvedValue([]))).resolves.toBe(
			'old@example.org'
		);
		await expect(
			resolveAccessSearch(target, vi.fn().mockRejectedValue(new Error('boom')))
		).resolves.toBe('old@example.org');
		await expect(
			resolveAccessSearch({ ...target, email: null }, vi.fn().mockResolvedValue([]))
		).resolves.toBe('Ada Lovelace');
	});

	it('never matches a different user that shares the email text', async () => {
		const find = vi.fn().mockResolvedValue([member('u9', 'old@example.org')]);
		await expect(resolveAccessSearch(target, find)).resolves.toBe('old@example.org');
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

	it('narrows the Ended chip client-side: a future end date is not ended', async () => {
		sdk.organizationadminmemberregisterListMemberRegister.mockResolvedValue({
			data: {
				count: 3,
				next: null,
				previous: null,
				results: [
					row('past', '2026-10-01T00:00:00Z'),
					row('future', '2027-01-01T00:00:00Z'),
					row('now', NOW.toISOString())
				]
			}
		});
		const page = await listPeople('org', 'tok', { page: 1, page_size: 20, ended: true }, NOW);
		expect(page.results.map((r) => r.id)).toEqual(['past', 'now']);
		const sent = sdk.organizationadminmemberregisterListMemberRegister.mock.calls[0][0].query;
		expect(sent).toMatchObject({ is_open: false });
		expect(sent).not.toHaveProperty('ended');
	});

	it('does not touch the rows of any other chip', async () => {
		sdk.organizationadminmemberregisterListMemberRegister.mockResolvedValue({
			data: { count: 1, next: null, previous: null, results: [row('a', '2027-01-01T00:00:00Z')] }
		});
		const page = await listPeople('org', 'tok', { page: 1, page_size: 20, kind: 'standard' }, NOW);
		expect(page.results).toHaveLength(1);
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
