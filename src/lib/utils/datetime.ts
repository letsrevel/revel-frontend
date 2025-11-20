/**
 * Datetime utility functions for handling timezone conversions
 * between backend UTC datetimes and frontend datetime-local inputs
 */

/**
 * Convert ISO datetime string (UTC) to datetime-local format (user's local timezone)
 *
 * @param isoString - ISO 8601 datetime string from backend (e.g., "2025-11-29T16:38:35.531Z")
 * @returns Datetime-local format string (e.g., "2025-11-29T17:38" for UTC+1)
 *
 * @example
 * // Backend returns: "2025-11-29T16:38:35.531Z" (UTC)
 * // User in UTC+1 timezone
 * toDateTimeLocal("2025-11-29T16:38:35.531Z") // "2025-11-29T17:38"
 */
export function toDateTimeLocal(isoString: string | null | undefined): string {
	if (!isoString) return '';

	// Parse the ISO string to a Date object (handles any timezone format)
	const date = new Date(isoString);

	// Format as datetime-local (YYYY-MM-DDTHH:mm) in user's local timezone
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	const hours = String(date.getHours()).padStart(2, '0');
	const minutes = String(date.getMinutes()).padStart(2, '0');

	return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Convert datetime-local format (user's local timezone) to ISO string with timezone offset
 *
 * @param datetimeLocal - Value from datetime-local input (e.g., "2025-11-29T17:38")
 * @returns ISO 8601 string with timezone offset (e.g., "2025-11-29T17:38:00+01:00")
 *
 * @example
 * // User in UTC+1 timezone enters: "2025-11-29T17:38"
 * toISOString("2025-11-29T17:38") // "2025-11-29T17:38:00+01:00"
 * // Backend interprets this as 16:38 UTC
 */
export function toISOString(datetimeLocal: string | null | undefined): string | null {
	if (!datetimeLocal) return null;

	// Create a date object to get the timezone offset
	const date = new Date(datetimeLocal);

	// Get timezone offset in minutes (e.g., -60 for UTC+1)
	// Note: getTimezoneOffset returns negative values for positive offsets
	const offsetMinutes = -date.getTimezoneOffset();

	// Convert offset to hours and minutes
	const offsetHours = Math.floor(Math.abs(offsetMinutes) / 60)
		.toString()
		.padStart(2, '0');
	const offsetMins = (Math.abs(offsetMinutes) % 60).toString().padStart(2, '0');
	const offsetSign = offsetMinutes >= 0 ? '+' : '-';

	// Build ISO string with local timezone offset (e.g., "2025-11-29T17:38:00+01:00")
	return `${datetimeLocal}:00${offsetSign}${offsetHours}:${offsetMins}`;
}
