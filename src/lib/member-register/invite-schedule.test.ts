import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MembershipRecordSchema } from '$lib/api/generated/types.gen';
import { MAX_REFETCH_DELAY_MS, nextInviteRefetchDelay } from './invite-schedule';

const NOW = new Date('2026-06-01T12:00:00Z');

function record(extra: Partial<MembershipRecordSchema> = {}): MembershipRecordSchema {
	return {
		id: 'r1',
		full_name: 'Ada Lovelace',
		email: 'ada@example.org',
		tier_name: 'Full',
		tier_id: 'tier-1',
		kind: 'standard',
		source: 'manual',
		valid_from: '2026-06-01T12:10:00Z',
		valid_until: null,
		created_at: '2026-01-10T09:30:00Z',
		has_account: false,
		invite_status: 'not_invited',
		can_invite: false,
		invite_blocked_reason: 'starts in the future',
		has_duplicate_claim: false,
		...extra
	};
}

describe('nextInviteRefetchDelay', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it('returns null when nothing is upcoming', () => {
		expect(nextInviteRefetchDelay([])).toBeNull();
		expect(nextInviteRefetchDelay([record({ can_invite: true })])).toBeNull();
		expect(nextInviteRefetchDelay([record({ valid_from: '2026-05-01T00:00:00Z' })])).toBeNull();
	});

	it('picks the nearest future start, plus one second', () => {
		const delay = nextInviteRefetchDelay([
			record({ id: 'a', valid_from: '2026-06-01T13:00:00Z' }),
			record({ id: 'b', valid_from: '2026-06-01T12:10:00Z' })
		]);
		expect(delay).toBe(10 * 60 * 1000 + 1000);
	});

	it('ignores rows blocked for other reasons', () => {
		const future = '2026-06-01T12:10:00Z';
		expect(
			nextInviteRefetchDelay([
				record({ valid_from: future, email: null }),
				record({ valid_from: future, kind: 'temporary' }),
				record({ valid_from: future, valid_until: '2026-12-01T00:00:00Z' }),
				record({ valid_from: future, invite_status: 'linked', has_account: true })
			])
		).toBeNull();
	});

	it('caps the delay at about 24 hours', () => {
		expect(nextInviteRefetchDelay([record({ valid_from: '2027-06-01T00:00:00Z' })])).toBe(
			MAX_REFETCH_DELAY_MS
		);
	});

	it('fires a single timer at the computed moment', () => {
		const fire = vi.fn();
		const delay = nextInviteRefetchDelay([record()]);
		expect(delay).not.toBeNull();
		setTimeout(fire, delay as number);
		vi.advanceTimersByTime((delay as number) - 1);
		expect(fire).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(fire).toHaveBeenCalledTimes(1);
	});
});
