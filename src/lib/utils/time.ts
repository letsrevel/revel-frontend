/**
 * Relative time formatting utilities
 */

import { getLocale } from '$lib/paraglide/runtime.js';
import { formatDate } from './date';

/**
 * Format a timestamp as relative time (e.g., "2 hours ago", "yesterday", "3 days ago")
 *
 * Falls back to an absolute date for deltas longer than ~30 days.
 * Uses a "now" band for deltas under 30 seconds.
 *
 * @param dateString ISO 8601 date-time string
 * @returns Relative time string
 */
export function formatRelativeTime(dateString: string): string {
	const diffMs = new Date(dateString).getTime() - Date.now();
	const absDiffMs = Math.abs(diffMs);

	// More than a month: fallback to absolute date
	if (absDiffMs > 30 * 24 * 60 * 60 * 1000) {
		return formatDate(dateString);
	}

	// Initialize standard formatter.
	// `numeric: 'auto'` handles lexical conversions natively (e.g., "-1 day" -> "yesterday" / "gestern" / "ieri")
	const rtf = new Intl.RelativeTimeFormat(getLocale(), { numeric: 'auto', style: 'long' });

	// Just now (less than 30 seconds)
	if (absDiffMs < 30 * 1000) {
		return rtf.format(0, 'second'); // "now" / "jetzt" / "ora"
	}

	const units: [Intl.RelativeTimeFormatUnit, number][] = [
		['week', 7 * 24 * 60 * 60 * 1000],
		['day', 24 * 60 * 60 * 1000],
		['hour', 60 * 60 * 1000],
		['minute', 60 * 1000]
	];

	for (const [unit, ms] of units) {
		if (absDiffMs >= ms) {
			return rtf.format(Math.trunc(diffMs / ms), unit);
		}
	}
	return rtf.format(Math.trunc(diffMs / 1000), 'second');
}
