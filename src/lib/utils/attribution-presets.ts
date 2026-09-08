/**
 * "Since" preset mapping for the org-wide "Sales by source" filters (#880
 * follow-up, `/org/[slug]/admin/financials`). Pure so the ISO-string mapping and
 * its reverse (URL → active preset) are cheaply unit-testable — the page
 * component only wires these to `goto()`.
 */

/** Presets a user can actively pick. `'custom'` is a derived display-only
 *  state — it is never in the selectable list, only returned by
 *  `presetForSince` when the URL's `since` matches none of the others. */
export const SELECTABLE_SINCE_PRESETS = ['all', 'last7', 'last30', 'last90', 'thisYear'] as const;
export type SelectableSincePreset = (typeof SELECTABLE_SINCE_PRESETS)[number];
export type SincePreset = SelectableSincePreset | 'custom';

const PRESET_DAYS: Record<'last7' | 'last30' | 'last90', number> = {
	last7: 7,
	last30: 30,
	last90: 90
};

/**
 * How close a persisted `since` value must be to a preset's freshly computed
 * value to still count as "that preset" on reload. The client computes the
 * ISO string at click time; the server re-derives `now` a request-round-trip
 * later, so an exact string match would almost never hold.
 */
const MATCH_TOLERANCE_MS = 5 * 60 * 1000;

/**
 * The ISO 8601 (UTC) `since` value for `preset`, or `null` for "all time"
 * (no filter — the param is omitted) and for `'custom'` (not computable).
 */
export function sinceForPreset(preset: SincePreset, now: Date = new Date()): string | null {
	switch (preset) {
		case 'all':
		case 'custom':
			return null;
		case 'thisYear':
			// Local midnight Jan 1 — `.toISOString()` renders it as an aware UTC
			// instant, satisfying the endpoint's "ISO 8601 with tz" contract.
			return new Date(now.getFullYear(), 0, 1).toISOString();
		case 'last7':
		case 'last30':
		case 'last90':
			return new Date(now.getTime() - PRESET_DAYS[preset] * 86_400_000).toISOString();
	}
}

/**
 * The preset whose computed value is closest to `since` (within tolerance),
 * or `'custom'` when nothing matches closely enough — including a malformed
 * `since` string, which someone hand-editing the URL could produce.
 */
export function presetForSince(since: string | null, now: Date = new Date()): SincePreset {
	if (since === null) return 'all';

	const target = new Date(since).getTime();
	if (!Number.isFinite(target)) return 'custom';

	let closest: SincePreset = 'custom';
	let closestDiff = Infinity;
	for (const preset of ['last7', 'last30', 'last90', 'thisYear'] as const) {
		const candidate = sinceForPreset(preset, now);
		if (candidate === null) continue;
		const diff = Math.abs(new Date(candidate).getTime() - target);
		if (diff < closestDiff) {
			closestDiff = diff;
			closest = preset;
		}
	}
	return closestDiff <= MATCH_TOLERANCE_MS ? closest : 'custom';
}
