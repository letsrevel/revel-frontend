import type { PosterTint } from '$lib/components/common/tones';

/**
 * Identity-tint cycle for the admin dashboard's quick-actions grid (spec §4.3,
 * PR 7 fix round — Blacklist/Financials moved off semantic `tone` onto `tint`
 * like their 12 siblings, since navigating to a page is identity, not
 * danger/success; the Ban/Wallet icons + visible labels already carry that
 * meaning). Pure array-order assignment: item `i` gets `TINTS[i % TINTS.length]`.
 *
 * This uniform cycle (no skipped/special-cased tiles) guarantees "no
 * grid-adjacent tile repeats a tint" for BOTH quick-actions grid variants
 * (12 tiles non-owner, 14 owner) at BOTH column counts the grid uses
 * (`md:grid-cols-2` -> vertical offset 2, `lg:grid-cols-4` -> vertical offset
 * 4), plus the horizontal offset of 1 — because `TINTS.length` (7) is prime
 * and every one of those offsets is smaller than 7 and non-zero, so it can
 * never land back on the same index mod 7. See quick-action-tints.test.ts for
 * the property test.
 */
export const TINTS: readonly PosterTint[] = [
	'purple',
	'lavender',
	'periwinkle',
	'amber',
	'crimson',
	'ink',
	'paper'
];

/** Assigns an identity tint to each item by array order (see module docs). */
export function assignQuickActionTints<T>(items: readonly T[]): (T & { tint: PosterTint })[] {
	return items.map((item, i) => ({ ...item, tint: TINTS[i % TINTS.length] }));
}
