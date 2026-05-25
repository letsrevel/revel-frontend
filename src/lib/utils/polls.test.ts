import { describe, it, expect, vi, afterEach } from 'vitest';
import {
	buildPollVoterUrl,
	isPollOpen,
	isPollDraft,
	isPollClosed,
	formatVoteCount,
	resultVisibilityRequiresPublicAnonymous,
	validateClosesAt
} from './polls';

describe('buildPollVoterUrl', () => {
	it('joins origin, slug, and id into the voter URL', () => {
		expect(buildPollVoterUrl('https://letsrevel.io', 'acme', '8f2a-uuid')).toBe(
			'https://letsrevel.io/org/acme/polls/8f2a-uuid'
		);
	});

	it('strips trailing slash on origin', () => {
		expect(buildPollVoterUrl('https://letsrevel.io/', 'acme', 'x')).toBe(
			'https://letsrevel.io/org/acme/polls/x'
		);
	});
});

describe('status helpers', () => {
	it('isPollDraft / isPollOpen / isPollClosed', () => {
		expect(isPollDraft('draft')).toBe(true);
		expect(isPollOpen('open')).toBe(true);
		expect(isPollClosed('closed')).toBe(true);
		expect(isPollDraft('open')).toBe(false);
	});
});

describe('formatVoteCount', () => {
	it('formats singular/plural/zero', () => {
		expect(formatVoteCount(0)).toMatchObject({ key: 'votes_zero' });
		expect(formatVoteCount(1)).toMatchObject({ key: 'votes_one' });
		expect(formatVoteCount(2)).toMatchObject({ key: 'votes_other', count: 2 });
	});
});

describe('resultVisibilityRequiresPublicAnonymous', () => {
	it('forces anonymity for PUBLIC and UNLISTED', () => {
		expect(resultVisibilityRequiresPublicAnonymous('public')).toBe(true);
		expect(resultVisibilityRequiresPublicAnonymous('unlisted')).toBe(true);
		expect(resultVisibilityRequiresPublicAnonymous('private')).toBe(false);
		expect(resultVisibilityRequiresPublicAnonymous('staff-only')).toBe(false);
	});
});

describe('validateClosesAt', () => {
	afterEach(() => vi.useRealTimers());

	it('returns null for null/empty', () => {
		expect(validateClosesAt(null)).toBeNull();
		expect(validateClosesAt('')).toBeNull();
	});

	it('returns null for future timestamps', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
		expect(validateClosesAt('2026-12-31T23:59:59Z')).toBeNull();
	});

	it('returns the past-date error key for past timestamps', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-12-31T00:00:00Z'));
		expect(validateClosesAt('2026-01-01T00:00:00Z')).toBe('pollNewPage.closesAtPast');
	});
});
