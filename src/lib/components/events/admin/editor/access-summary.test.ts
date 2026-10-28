import { describe, it, expect } from 'vitest';
import { summarizeAccess, capitalizeFirst } from './access-summary';

describe('summarizeAccess', () => {
	it('defaults to public/public', () => {
		const s = summarizeAccess(undefined, undefined);
		expect(s.whoCanSee).toBe('Everyone');
		expect(s.whoCanAttend).toBe('anyone');
		expect(s.showJoinOrgHint).toBe(false);
	});

	it('describes unlisted events with the direct-link sentence', () => {
		const s = summarizeAccess('unlisted', 'public');
		expect(s.whoCanSee).toBe('Only people with the direct link');
		expect(s.viewDescription).toContain('hidden from search results');
	});

	it('maps members-only, staff-only and private visibility', () => {
		expect(summarizeAccess('members-only', 'public').whoCanSee).toBe('Only organization members');
		expect(summarizeAccess('staff-only', 'public').whoCanSee).toBe('Only organization staff');
		expect(summarizeAccess('private', 'public').whoCanSee).toBe('Only invited users');
	});

	it('maps event types', () => {
		expect(summarizeAccess('public', 'members-only').whoCanAttend).toBe(
			'only organization members'
		);
		expect(summarizeAccess('public', 'private').whoCanAttend).toBe('only invited people');
	});

	it('hints at joining the org only for public visibility + members-only type', () => {
		expect(summarizeAccess('public', 'members-only').showJoinOrgHint).toBe(true);
		expect(summarizeAccess('private', 'members-only').showJoinOrgHint).toBe(false);
	});

	it('capitalizes the first character', () => {
		expect(capitalizeFirst('anyone')).toBe('Anyone');
		expect(capitalizeFirst('')).toBe('');
	});
});
