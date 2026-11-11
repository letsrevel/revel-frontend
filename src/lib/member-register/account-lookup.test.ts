import { describe, expect, it, vi } from 'vitest';
import type { MembershipRecordSchema, OrgUserLookupSchema } from '$lib/api/generated/types.gen';
import {
	classifyLookup,
	lookupDisplayName,
	resolveSeed,
	validateLookupEmail
} from './account-lookup';

function user(extra: Partial<OrgUserLookupSchema> = {}): OrgUserLookupSchema {
	return { user_id: 'u1', display_name: 'Ada Lovelace', is_member: false, ...extra };
}

function rec(id: string, extra: Partial<MembershipRecordSchema> = {}): MembershipRecordSchema {
	return {
		id,
		full_name: 'Ada Lovelace',
		email: null,
		tier_name: 'Full',
		tier_id: 't1',
		kind: 'standard',
		source: 'manual',
		valid_from: '2026-01-10T09:30:00Z',
		valid_until: null,
		created_at: '2026-01-10T09:30:00Z',
		has_account: true,
		invite_status: 'linked',
		can_invite: false,
		invite_blocked_reason: null,
		has_duplicate_claim: false,
		user_id: 'u1',
		...extra
	};
}

describe('classifyLookup', () => {
	it('no membership, no request: addable', () => {
		expect(classifyLookup(user())).toBe('addable');
		expect(classifyLookup(user({ membership_status: null }))).toBe('addable');
	});
	it('a pending request wins', () => {
		expect(classifyLookup(user({ pending_request_id: 'p1' }))).toBe('pending-application');
	});
	it.each(['active', 'paused', 'cancelled', 'banned'] as const)('%s is a membership row', (s) => {
		expect(classifyLookup(user({ membership_status: s, is_member: s === 'active' }))).toBe(
			'has-membership'
		);
	});
	it('is_member alone counts', () => {
		expect(classifyLookup(user({ is_member: true }))).toBe('has-membership');
	});
});

describe('lookupDisplayName', () => {
	it('uses the account name', () => {
		expect(lookupDisplayName(user(), 'a@b.co')).toBe('Ada Lovelace');
	});
	it('falls back to the typed email for an empty or blank name', () => {
		expect(lookupDisplayName(user({ display_name: '' }), ' a@b.co ')).toBe('a@b.co');
		expect(lookupDisplayName(user({ display_name: '   ' }), 'a@b.co')).toBe('a@b.co');
	});
});

describe('validateLookupEmail', () => {
	it('flags empty and malformed values only', () => {
		expect(validateLookupEmail('  ')).toBe('required');
		expect(validateLookupEmail('nope')).toBe('invalid');
		expect(validateLookupEmail('a@b')).toBe('invalid');
		expect(validateLookupEmail(' ada@example.org ')).toBeNull();
	});
});

describe('resolveSeed', () => {
	it('fetches the linked register record when the lookup has one', async () => {
		const getRecord = vi.fn().mockResolvedValue(rec('r1'));
		const listPeriods = vi.fn();
		const seed = await resolveSeed(user({ register_record_id: 'r1' }), { getRecord, listPeriods });
		expect(seed?.id).toBe('r1');
		expect(getRecord).toHaveBeenCalledWith('r1');
		expect(listPeriods).not.toHaveBeenCalled();
	});
	it('falls back to the periods when that record is gone (404)', async () => {
		const getRecord = vi.fn().mockRejectedValue(Object.assign(new Error('x'), { status: 404 }));
		const listPeriods = vi.fn().mockResolvedValue([rec('r2')]);
		const seed = await resolveSeed(user({ register_record_id: 'r1' }), { getRecord, listPeriods });
		expect(seed?.id).toBe('r2');
	});
	it('rethrows other record failures', async () => {
		const getRecord = vi.fn().mockRejectedValue(Object.assign(new Error('x'), { status: 500 }));
		await expect(
			resolveSeed(user({ register_record_id: 'r1' }), { getRecord, listPeriods: vi.fn() })
		).rejects.toThrow();
	});
	it('prefers the current period, else the latest, from the periods', async () => {
		const listPeriods = vi
			.fn()
			.mockResolvedValue([
				rec('old', { valid_from: '2025-01-01T00:00:00Z', is_current: false }),
				rec('new', { valid_from: '2025-06-01T00:00:00Z', is_current: false }),
				rec('cur', { valid_from: '2024-01-01T00:00:00Z', is_current: true })
			]);
		expect((await resolveSeed(user(), { getRecord: vi.fn(), listPeriods }))?.id).toBe('cur');
		listPeriods.mockResolvedValue([
			rec('old', { valid_from: '2025-01-01T00:00:00Z' }),
			rec('new', { valid_from: '2025-06-01T00:00:00Z' })
		]);
		expect((await resolveSeed(user(), { getRecord: vi.fn(), listPeriods }))?.id).toBe('new');
	});
	it('is null with no record at all', async () => {
		const seed = await resolveSeed(user(), {
			getRecord: vi.fn(),
			listPeriods: vi.fn().mockResolvedValue([])
		});
		expect(seed).toBeNull();
	});
});
