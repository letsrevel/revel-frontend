import { describe, expect, it } from 'vitest';
import type { MembershipRecordSchema, PossibleDuplicateSchema } from '$lib/api/generated/types.gen';
import { canUnlink, planMerge, unlinkEffect } from './reconcile';

function record(extra: Partial<MembershipRecordSchema> = {}): MembershipRecordSchema {
	return {
		id: 'r1',
		full_name: 'Ada Lovelace',
		email: 'ada@example.org',
		tier_name: 'Full',
		tier_id: 'tier-1',
		kind: 'standard',
		source: 'manual',
		valid_from: '2026-03-01T00:00:00Z',
		valid_until: null,
		created_at: '2026-03-01T00:00:00Z',
		has_account: false,
		invite_status: 'not_invited',
		has_duplicate_claim: false,
		...extra
	};
}

describe('unlinkEffect (mirrors member_register_reconciliation.unlink_record)', () => {
	it('merged entry reverses the merge', () => {
		expect(unlinkEffect(record({ merged_into_id: 'r2' }))).toBe('reverse_merge');
	});
	it('merged wins even if the entry also carries an account', () => {
		expect(unlinkEffect(record({ merged_into_id: 'r2', has_account: true }))).toBe('reverse_merge');
	});
	it('open standard linked entry cancels access', () => {
		expect(unlinkEffect(record({ has_account: true }))).toBe('cancels_access');
	});
	it('closed linked entry only clears the user', () => {
		expect(unlinkEffect(record({ has_account: true, valid_until: '2026-05-01T00:00:00Z' }))).toBe(
			'clears_user'
		);
	});
	it('linked day membership only clears the user', () => {
		expect(unlinkEffect(record({ has_account: true, kind: 'temporary' }))).toBe('clears_user');
	});
	it('a plain account-less entry has nothing to unlink', () => {
		expect(unlinkEffect(record())).toBeNull();
		expect(canUnlink(record())).toBe(false);
		expect(canUnlink(record({ has_account: true }))).toBe(true);
	});
});

describe('planMerge', () => {
	const linked = record({
		id: 'L',
		full_name: 'Ada L.',
		has_account: true,
		valid_from: '2026-03-01T00:00:00Z'
	});

	function pair(unlinked: MembershipRecordSchema): PossibleDuplicateSchema {
		return { linked, unlinked, reasons: ['email'] };
	}

	it('defaults the survivor to the linked entry and never allows a swap', () => {
		const plan = planMerge(pair(record({ id: 'U' })));
		expect(plan.survivor.id).toBe('L');
		expect(plan.absorbed.id).toBe('U');
		expect(plan.canSwap).toBe(false);
	});
	it('absorbs an open entry whatever its start date, the survivor keeps its own', () => {
		const earlier = planMerge(pair(record({ id: 'U', valid_from: '2025-01-01T00:00:00Z' })));
		expect(earlier.outcome).toBe('absorb');
		const later = planMerge(pair(record({ id: 'U', valid_from: '2027-01-01T00:00:00Z' })));
		expect(later.outcome).toBe('absorb');
	});
	it('attaches a closed entry', () => {
		const plan = planMerge(pair(record({ id: 'U', valid_until: '2025-06-01T00:00:00Z' })));
		expect(plan.outcome).toBe('attach');
	});
	it('attaches a day membership', () => {
		expect(planMerge(pair(record({ id: 'U', kind: 'temporary' }))).outcome).toBe('attach');
	});
});
