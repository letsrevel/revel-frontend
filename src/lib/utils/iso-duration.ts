/**
 * Humanize an ISO 8601 duration (as sent by the API, e.g. `PT2H30M`) into a
 * localized string such as `2h 30m`.
 *
 * Unit labels are injected so callers pass translated formatters (the pure
 * helper stays free of i18n imports and is trivially testable).
 */

export interface DurationUnitLabels {
	days: (n: number) => string;
	hours: (n: number) => string;
	minutes: (n: number) => string;
	seconds: (n: number) => string;
}

const ISO_DURATION_RE = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/;

/**
 * Returns `—` for empty input, the raw string when it does not parse, and `—`
 * when every component is zero.
 */
export function humanizeIsoDuration(
	iso: string | null | undefined,
	labels: DurationUnitLabels
): string {
	if (!iso) return '—';
	const match = ISO_DURATION_RE.exec(iso);
	if (!match) return iso;
	const [, d, h, mm, s] = match;
	const parts: string[] = [];
	if (d && d !== '0') parts.push(labels.days(Number(d)));
	if (h && h !== '0') parts.push(labels.hours(Number(h)));
	if (mm && mm !== '0') parts.push(labels.minutes(Number(mm)));
	if (s && s !== '0') parts.push(labels.seconds(Number(s)));
	return parts.length > 0 ? parts.join(' ') : '—';
}
