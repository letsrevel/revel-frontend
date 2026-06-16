import { describe, it, expect } from 'vitest';
import { resolveSubmissionBadgeStatus } from './resolve-submission-badge-status';

describe('resolveSubmissionBadgeStatus', () => {
	it('returns auto_accepted when requiresEvaluation is false, regardless of status', () => {
		expect(resolveSubmissionBadgeStatus(false, null)).toBe('auto_accepted');
		expect(resolveSubmissionBadgeStatus(false, undefined)).toBe('auto_accepted');
		expect(resolveSubmissionBadgeStatus(false, 'pending review')).toBe('auto_accepted');
		expect(resolveSubmissionBadgeStatus(false, 'approved')).toBe('auto_accepted');
		expect(resolveSubmissionBadgeStatus(false, 'rejected')).toBe('auto_accepted');
	});

	it('returns the real evaluation status when requiresEvaluation is true and status is present', () => {
		expect(resolveSubmissionBadgeStatus(true, 'approved')).toBe('approved');
		expect(resolveSubmissionBadgeStatus(true, 'rejected')).toBe('rejected');
		expect(resolveSubmissionBadgeStatus(true, 'pending review')).toBe('pending review');
	});

	it('falls back to pending review when requiresEvaluation is true but status is absent', () => {
		expect(resolveSubmissionBadgeStatus(true, null)).toBe('pending review');
		expect(resolveSubmissionBadgeStatus(true, undefined)).toBe('pending review');
	});
});
