import { describe, it, expect } from 'vitest';
import { effectiveEventCapacity, exceedsEventCapacity } from './event-capacity';

describe('effectiveEventCapacity', () => {
	it('returns the min when both are set', () => {
		expect(effectiveEventCapacity(30, 50)).toBe(30);
		expect(effectiveEventCapacity(80, 50)).toBe(50);
	});
	it('returns the one that is set', () => {
		expect(effectiveEventCapacity(30, null)).toBe(30);
		expect(effectiveEventCapacity(undefined, 50)).toBe(50);
	});
	it('treats 0 as unset', () => {
		expect(effectiveEventCapacity(0, 50)).toBe(50);
		expect(effectiveEventCapacity(30, 0)).toBe(30);
		expect(effectiveEventCapacity(0, 0)).toBeNull();
	});
	it('returns null when neither is set', () => {
		expect(effectiveEventCapacity(null, null)).toBeNull();
		expect(effectiveEventCapacity(undefined, undefined)).toBeNull();
	});
});

describe('exceedsEventCapacity', () => {
	it('is true when quantity is above capacity', () => {
		expect(exceedsEventCapacity(40, 30)).toBe(true);
	});
	it('is false below or equal to capacity', () => {
		expect(exceedsEventCapacity(20, 30)).toBe(false);
		expect(exceedsEventCapacity(30, 30)).toBe(false);
	});
	it('is false when either side is missing', () => {
		expect(exceedsEventCapacity(40, null)).toBe(false);
		expect(exceedsEventCapacity(null, 30)).toBe(false);
		expect(exceedsEventCapacity(undefined, 30)).toBe(false);
	});
	it('is false for non-positive or non-finite quantities', () => {
		expect(exceedsEventCapacity(0, 30)).toBe(false);
		expect(exceedsEventCapacity(-5, 30)).toBe(false);
		expect(exceedsEventCapacity(NaN, 30)).toBe(false);
		expect(exceedsEventCapacity(Infinity, 30)).toBe(false);
	});
});
