import { describe, expect, it } from 'vitest';
import type { MembershipRecordSchema } from '$lib/api/generated/types.gen';
import { canInvite } from './invite';

const NOW = new Date('2026-06-01T12:00:00Z');

function rec(extra: Partial<MembershipRecordSchema> = {}): MembershipRecordSchema {
	return {
		id: 'r1',
		full_name: 'Ada',
		email: 'ada@example.org',
		tier_name: 'Full',
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

describe('canInvite', () => {
	it('accepts an open, started, standard, unlinked entry with an email', () => {
		expect(canInvite(rec(), NOW)).toBe(true);
		expect(canInvite(rec({ invite_status: 'invited' }), NOW)).toBe(true);
	});
	it('accepts an entry starting exactly now', () => {
		expect(canInvite(rec({ valid_from: NOW.toISOString() }), NOW)).toBe(true);
	});
	it('refuses a linked entry', () => {
		expect(canInvite(rec({ has_account: true }), NOW)).toBe(false);
		expect(canInvite(rec({ invite_status: 'linked' }), NOW)).toBe(false);
	});
	it('refuses a merged entry', () => {
		expect(canInvite(rec({ merged_into_id: 'r2' }), NOW)).toBe(false);
	});
	it('refuses an entry without an email', () => {
		expect(canInvite(rec({ email: '' }), NOW)).toBe(false);
		expect(canInvite(rec({ email: null }), NOW)).toBe(false);
	});
	it('refuses a day member', () => {
		expect(canInvite(rec({ kind: 'temporary' }), NOW)).toBe(false);
	});
	it('refuses a closed entry', () => {
		expect(canInvite(rec({ valid_until: '2026-05-01T00:00:00Z' }), NOW)).toBe(false);
	});
	it('refuses a future-dated entry', () => {
		expect(canInvite(rec({ valid_from: '2026-06-02T00:00:00Z' }), NOW)).toBe(false);
	});
});
