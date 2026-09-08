import { describe, it, expect } from 'vitest';
import { sinceForPreset, presetForSince } from './attribution-presets';

const NOW = new Date('2026-09-08T12:00:00.000Z');

describe('sinceForPreset', () => {
	it('returns null for "all" (no filter)', () => {
		expect(sinceForPreset('all', NOW)).toBeNull();
	});

	it('returns null for "custom" (not computable)', () => {
		expect(sinceForPreset('custom', NOW)).toBeNull();
	});

	it('computes last7/last30/last90 as N days before now', () => {
		expect(sinceForPreset('last7', NOW)).toBe('2026-09-01T12:00:00.000Z');
		expect(sinceForPreset('last30', NOW)).toBe('2026-08-09T12:00:00.000Z');
		expect(sinceForPreset('last90', NOW)).toBe('2026-06-10T12:00:00.000Z');
	});

	it('computes thisYear as local midnight Jan 1, rendered as an aware ISO instant', () => {
		// Compare via LOCAL getters, not hardcoded UTC values — the machine
		// running the test can be in any timezone, and `new Date(year, 0, 1)`
		// is a local-midnight construction either way.
		const iso = sinceForPreset('thisYear', NOW);
		expect(iso).not.toBeNull();
		const parsed = new Date(iso as string);
		expect(parsed.getFullYear()).toBe(NOW.getFullYear());
		expect(parsed.getMonth()).toBe(0);
		expect(parsed.getDate()).toBe(1);
		expect(parsed.getHours()).toBe(0);
		expect(parsed.getMinutes()).toBe(0);
	});
});

describe('presetForSince', () => {
	it('maps null to "all"', () => {
		expect(presetForSince(null, NOW)).toBe('all');
	});

	it('maps a malformed since string to "custom"', () => {
		expect(presetForSince('not-a-date', NOW)).toBe('custom');
	});

	it('round-trips every selectable preset through sinceForPreset', () => {
		for (const preset of ['last7', 'last30', 'last90', 'thisYear'] as const) {
			const since = sinceForPreset(preset, NOW);
			expect(presetForSince(since, NOW)).toBe(preset);
		}
	});

	it('tolerates a few minutes of clock drift between compute and reload', () => {
		const computed = sinceForPreset('last30', NOW);
		const drifted = new Date(new Date(computed as string).getTime() + 60_000).toISOString();
		expect(presetForSince(drifted, NOW)).toBe('last30');
	});

	it('falls back to "custom" when the since value matches no preset closely', () => {
		// Exactly 45 days ago sits well outside tolerance of both last30 and last90.
		const since = new Date(NOW.getTime() - 45 * 86_400_000).toISOString();
		expect(presetForSince(since, NOW)).toBe('custom');
	});
});
