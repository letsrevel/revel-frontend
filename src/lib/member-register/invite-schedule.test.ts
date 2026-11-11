import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MembershipRecordSchema } from '$lib/api/generated/types.gen';
import {
	MAX_REFETCH_DELAY_MS,
	nextExpiryRefetchDelay,
	nextInviteRefetchDelay,
	nextListRefetchDelay
} from './invite-schedule';

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

describe('nextExpiryRefetchDelay', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it('is the nearest future valid_until plus the grace, ignoring open and past ends', () => {
		const delay = nextExpiryRefetchDelay([
			record({ valid_until: '2026-06-01T12:30:00Z' }),
			record({ valid_until: '2026-06-01T12:05:00Z' }),
			record({ valid_until: '2026-06-01T11:00:00Z' }),
			record({ valid_until: null })
		]);
		expect(delay).toBe(5 * 60 * 1000 + 1000);
	});

	it('is null when no listed row has a future end, and caps at the maximum', () => {
		expect(nextExpiryRefetchDelay([record({ valid_until: null })])).toBeNull();
		expect(nextExpiryRefetchDelay([record({ valid_until: '2027-06-01T12:00:00Z' })])).toBe(
			MAX_REFETCH_DELAY_MS
		);
	});
});

describe('nextListRefetchDelay', () => {
	it('takes the nearer of the invite start and, on Current, the expiry', () => {
		const rows = [
			record({ valid_until: '2026-06-01T12:30:00Z' }),
			record({ valid_from: '2026-06-01T12:10:00Z', valid_until: null })
		];
		// invite start in 10 min (+grace); expiry in 30 min (+grace): the start is nearer.
		expect(nextListRefetchDelay(rows, { activeNow: true }, NOW.getTime())).toBe(
			10 * 60 * 1000 + 1000
		);
		// Off the Current chip the expiry is ignored, the start still applies.
		expect(nextListRefetchDelay(rows, { activeNow: false }, NOW.getTime())).toBe(
			10 * 60 * 1000 + 1000
		);
	});

	it('uses the expiry alone when no row is waiting to start, and is null when neither applies', () => {
		const ended = [record({ valid_until: '2026-06-01T12:30:00Z' })];
		expect(nextListRefetchDelay(ended, { activeNow: true }, NOW.getTime())).toBe(
			30 * 60 * 1000 + 1000
		);
		expect(nextListRefetchDelay(ended, { activeNow: false }, NOW.getTime())).toBeNull();
	});
});
