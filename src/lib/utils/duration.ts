/**
 * Duration utilities for the DurationInput component.
 *
 * Storage units are the units the parent form (and ultimately the backend) expect.
 * Display units are what the user picks in the dropdown. Conversion is done in
 * minutes (the smallest possible storage unit) to avoid floating-point drift.
 *
 * Months and years use fixed factors (30 days / 365 days). This is intentional;
 * see the spec at docs/superpowers/specs/2026-05-15-duration-input-design.md.
 */

export const UNITS = ['minutes', 'hours', 'days', 'weeks', 'months', 'years'] as const;
export type Unit = (typeof UNITS)[number];

export const STORAGE_UNITS = ['minutes', 'hours', 'days'] as const;
export type StorageUnit = (typeof STORAGE_UNITS)[number];

/** Each display unit expressed in minutes. */
export const FACTOR_MINUTES: Record<Unit, number> = {
	minutes: 1,
	hours: 60,
	days: 1_440,
	weeks: 10_080,
	months: 43_200, // 30 days
	years: 525_600 // 365 days
};

/** Each storage unit expressed in minutes. */
export const STORAGE_FACTOR_MINUTES: Record<StorageUnit, number> = {
	minutes: 1,
	hours: 60,
	days: 1_440
};

/** Display units allowed per storage unit (smaller units would produce fractional storage values). */
export const ALLOWED_UNITS: Record<StorageUnit, readonly Unit[]> = {
	minutes: ['minutes', 'hours', 'days', 'weeks', 'months', 'years'],
	hours: ['hours', 'days', 'weeks', 'months', 'years'],
	days: ['days', 'weeks', 'months', 'years']
} as const;

/** Descending order used by the smart-unit algorithm. */
const SMART_UNIT_ORDER: readonly Unit[] = ['years', 'months', 'weeks', 'days', 'hours', 'minutes'];

/**
 * Convert `{amount, unit}` to a value in `storageUnit`.
 * Result is rounded to an integer; callers should pass values that convert cleanly
 * (the `ALLOWED_UNITS` filter on the UI side ensures this).
 */
export function toStorage(amount: number, unit: Unit, storageUnit: StorageUnit): number {
	const minutes = amount * FACTOR_MINUTES[unit];
	return Math.round(minutes / STORAGE_FACTOR_MINUTES[storageUnit]);
}

/**
 * Pick the largest allowed unit that produces a positive whole integer for `value`.
 * Falls back to `{ amount: value, unit: storageUnit }` if nothing divides evenly
 * (e.g. value = 60 hours: not whole days/weeks/months/years → display as "60 hours").
 */
export function fromStorage(
	value: number,
	storageUnit: StorageUnit
): { amount: number; unit: Unit } {
	const minutes = value * STORAGE_FACTOR_MINUTES[storageUnit];
	const allowed = new Set(ALLOWED_UNITS[storageUnit]);
	for (const u of SMART_UNIT_ORDER) {
		if (!allowed.has(u)) continue;
		const f = FACTOR_MINUTES[u];
		if (minutes >= f && minutes % f === 0) {
			return { amount: minutes / f, unit: u };
		}
	}
	return { amount: value, unit: storageUnit };
}
