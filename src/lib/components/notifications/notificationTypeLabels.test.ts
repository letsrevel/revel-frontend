import { describe, it, expect } from 'vitest';
import {
	getNotificationTypeDescription,
	getNotificationTypeLabel,
	hasNotificationTypeLabel
} from './notificationTypeLabels';

describe('notificationTypeLabels (#996)', () => {
	it('translates org_setup_nudge', () => {
		expect(hasNotificationTypeLabel('org_setup_nudge')).toBe(true);
		expect(getNotificationTypeLabel('org_setup_nudge')).toBe('Organization setup tips');
		expect(getNotificationTypeDescription('org_setup_nudge')).toMatch(
			/at most one every two weeks/i
		);
	});

	it('falls back to the raw name for unmapped types', () => {
		expect(hasNotificationTypeLabel('event_reminder')).toBe(false);
		expect(getNotificationTypeLabel('event_reminder')).toBe('event reminder');
		expect(getNotificationTypeDescription('event_reminder')).toBeUndefined();
	});

	it('ignores prototype keys a stray type string could collide with', () => {
		expect(hasNotificationTypeLabel('toString')).toBe(false);
		expect(getNotificationTypeLabel('toString')).toBe('toString');
		expect(getNotificationTypeDescription('constructor')).toBeUndefined();
	});
});
