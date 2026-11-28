import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	DISMISSED_STORAGE_KEY,
	dismissWarning,
	isWarningDismissed,
	loadDismissed,
	resetDismissedForTests
} from './dismissed.svelte';

describe('admin warning dismissal store', () => {
	beforeEach(() => {
		localStorage.clear();
		resetDismissedForTests();
	});
	afterEach(() => vi.restoreAllMocks());

	it('stores a dismissal per entity and warning in one JSON map', () => {
		dismissWarning('ev-1', 'B2');
		expect(isWarningDismissed('ev-1', 'B2')).toBe(true);
		expect(isWarningDismissed('ev-2', 'B2')).toBe(false);
		expect(isWarningDismissed('ev-1', 'B4')).toBe(false);
		expect(JSON.parse(localStorage.getItem(DISMISSED_STORAGE_KEY) ?? '{}')).toEqual({
			'ev-1:B2': true
		});
	});

	it('reads earlier dismissals back after a page load', () => {
		localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify({ 'ev-1:B2': true }));
		expect(isWarningDismissed('ev-1', 'B2')).toBe(false); // not loaded yet
		loadDismissed();
		expect(isWarningDismissed('ev-1', 'B2')).toBe(true);
	});

	it('ignores a corrupt or wrongly shaped value', () => {
		localStorage.setItem(DISMISSED_STORAGE_KEY, '{not json');
		loadDismissed();
		expect(isWarningDismissed('ev-1', 'B2')).toBe(false);

		resetDismissedForTests();
		localStorage.setItem(
			DISMISSED_STORAGE_KEY,
			JSON.stringify({ 'ev-1:B2': 'yes', 'ev-1:B4': true })
		);
		loadDismissed();
		expect(isWarningDismissed('ev-1', 'B2')).toBe(false);
		expect(isWarningDismissed('ev-1', 'B4')).toBe(true);
	});

	it('keeps the dismissal in memory when storage throws (private mode)', () => {
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new Error('QuotaExceededError');
		});
		expect(() => dismissWarning('ev-1', 'B2')).not.toThrow();
		expect(isWarningDismissed('ev-1', 'B2')).toBe(true);
	});
});
