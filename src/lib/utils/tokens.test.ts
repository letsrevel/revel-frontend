import { describe, it, expect, afterEach, vi } from 'vitest';
import { getExpirationDisplay } from './tokens';

describe('getExpirationDisplay plurals', () => {
	afterEach(() => vi.useRealTimers());

	function at(offsetMs: number): string {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
		return new Date(Date.now() + offsetMs).toISOString();
	}
	const HOUR = 3600_000;

	it('uses the singular for one day', () => {
		expect(getExpirationDisplay(at(24 * HOUR + 1000))).toBe('1 day');
	});
	it('uses the plural for five days', () => {
		expect(getExpirationDisplay(at(5 * 24 * HOUR + 1000))).toBe('5 days');
	});
	it('uses the singular for one hour', () => {
		expect(getExpirationDisplay(at(HOUR + 1000))).toBe('1 hour');
	});
	it('uses the plural for five hours', () => {
		expect(getExpirationDisplay(at(5 * HOUR + 1000))).toBe('5 hours');
	});
});
