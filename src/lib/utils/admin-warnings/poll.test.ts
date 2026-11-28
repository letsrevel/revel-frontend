import { describe, it, expect } from 'vitest';
import {
	pollPublicResultsNeverShown,
	pollResultsVisibleToEveryone,
	pollVotableByEveryone
} from './poll';

describe('G2a pollPublicResultsNeverShown', () => {
	it.each(['public', 'unlisted'])('is an Info hint for %s results with timing never', (v) => {
		const w = pollPublicResultsNeverShown({ result_visibility: v, result_timing: 'never' });
		expect(w?.id).toBe('G2a');
		expect(w?.level).toBe('info');
		expect(w?.title()).toBe('Nobody sees the poll results');
	});
	it('is silent for other timings', () => {
		expect(
			pollPublicResultsNeverShown({ result_visibility: 'public', result_timing: 'after_close' })
		).toBeNull();
	});
	it('is silent for restricted result visibility', () => {
		expect(
			pollPublicResultsNeverShown({ result_visibility: 'members-only', result_timing: 'never' })
		).toBeNull();
	});
});

describe('G2b-visible pollResultsVisibleToEveryone', () => {
	const base = { orgVisibility: 'private', result_visibility: 'public', status: 'open' };
	it('is an Info hint for a restricted organization', () => {
		const w = pollResultsVisibleToEveryone(base);
		expect(w?.id).toBe('G2b-visible');
		expect(w?.level).toBe('info');
		expect(w?.message()).toContain('Everyone can see the results');
		expect(w?.message()).not.toContain('After you open the poll');
	});
	it('says "after you open the poll" for a draft', () => {
		expect(pollResultsVisibleToEveryone({ ...base, status: 'draft' })?.message()).toContain(
			'After you open the poll'
		);
	});
	it('is silent for a public organization', () => {
		expect(pollResultsVisibleToEveryone({ ...base, orgVisibility: 'unlisted' })).toBeNull();
	});
	it('is silent for restricted result visibility', () => {
		expect(
			pollResultsVisibleToEveryone({ ...base, result_visibility: 'attendees-only' })
		).toBeNull();
	});
});

describe('G2b-vote pollVotableByEveryone', () => {
	const base = { orgVisibility: 'members-only', vote_visibility: 'unlisted', status: 'closed' };
	it('is an Info hint for a restricted organization', () => {
		const w = pollVotableByEveryone(base);
		expect(w?.id).toBe('G2b-vote');
		expect(w?.level).toBe('info');
		expect(w?.title()).toBe('Everyone can see and vote in this poll');
		expect(w?.message()).toContain('see it and vote');
	});
	it('says "after you open the poll" for a draft', () => {
		expect(pollVotableByEveryone({ ...base, status: 'draft' })?.message()).toContain(
			'After you open the poll'
		);
	});
	it('is silent for a public organization', () => {
		expect(pollVotableByEveryone({ ...base, orgVisibility: 'public' })).toBeNull();
	});
	it('is silent when only the results are public', () => {
		expect(pollVotableByEveryone({ ...base, vote_visibility: 'private' })).toBeNull();
	});
});
