/**
 * Pure helpers and constants for {@link TierForm.svelte} and its sub-sections.
 * Extracted verbatim during the #544 file-length split — no behavior change.
 */

export const CURRENCY_SYMBOLS: Record<string, string> = {
	AUD: 'A$',
	BRL: 'R$',
	CAD: 'C$',
	CHF: 'CHF',
	CNY: 'CN¥',
	CZK: 'Kč',
	DKK: 'kr',
	EUR: '€',
	GBP: '£',
	HKD: 'HK$',
	HUF: 'Ft',
	IDR: 'Rp',
	ILS: '₪',
	INR: '₹',
	ISK: 'kr',
	JPY: '¥',
	KRW: '₩',
	MXN: 'MX$',
	MYR: 'RM',
	NOK: 'kr',
	NZD: 'NZ$',
	PHP: '₱',
	PLN: 'zł',
	RON: 'lei',
	SEK: 'kr',
	SGD: 'S$',
	THB: '฿',
	TRY: '₺',
	USD: '$',
	ZAR: 'R'
};

/**
 * Convert timezone-aware ISO 8601 string to datetime-local format
 * @param isoString - ISO 8601 string (e.g., "2025-10-24T14:30:00-07:00")
 * @returns datetime-local format (e.g., "2025-10-24T14:30")
 */
export function toDatetimeLocal(isoString: string | null | undefined): string {
	if (!isoString) return '';

	// Parse the ISO string to a Date (automatically handles timezone)
	const date = new Date(isoString);

	// Format as YYYY-MM-DDTHH:mm for datetime-local input
	const year = date.getFullYear();
	const month = (date.getMonth() + 1).toString().padStart(2, '0');
	const day = date.getDate().toString().padStart(2, '0');
	const hours = date.getHours().toString().padStart(2, '0');
	const minutes = date.getMinutes().toString().padStart(2, '0');

	return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Convert datetime-local value to timezone-aware ISO 8601 string
 * @param datetimeLocal - Value from <input type="datetime-local"> (e.g., "2025-10-24T14:30")
 * @returns ISO 8601 string with timezone (e.g., "2025-10-24T14:30:00-07:00")
 */
export function toTimezoneAwareISO(datetimeLocal: string): string {
	if (!datetimeLocal) return '';

	// Parse the datetime-local value as a Date in the user's local timezone
	const date = new Date(datetimeLocal);

	// Convert to ISO 8601 with timezone offset
	const tzOffset = -date.getTimezoneOffset();
	const tzHours = Math.floor(Math.abs(tzOffset) / 60)
		.toString()
		.padStart(2, '0');
	const tzMinutes = (Math.abs(tzOffset) % 60).toString().padStart(2, '0');
	const tzSign = tzOffset >= 0 ? '+' : '-';

	const year = date.getFullYear();
	const month = (date.getMonth() + 1).toString().padStart(2, '0');
	const day = date.getDate().toString().padStart(2, '0');
	const hours = date.getHours().toString().padStart(2, '0');
	const minutes = date.getMinutes().toString().padStart(2, '0');
	const seconds = date.getSeconds().toString().padStart(2, '0');

	return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${tzSign}${tzHours}:${tzMinutes}`;
}

/** Normalize decimal input: replace comma with dot, strip invalid chars, allow only one dot */
export function normalizeDecimalInput(value: string): string {
	let normalized = value.replace(/,/g, '.');
	normalized = normalized.replace(/[^\d.]/g, '');
	const firstDotIndex = normalized.indexOf('.');
	if (firstDotIndex !== -1) {
		normalized =
			normalized.slice(0, firstDotIndex + 1) +
			normalized.slice(firstDotIndex + 1).replace(/\./g, '');
	}
	return normalized;
}

/**
 * Does a tier-save error say the ORGANIZATION's billing info is missing (the
 * error that earns the "complete billing settings" shortcut link)?
 *
 * The backend localizes organizer-facing validation messages per
 * Accept-Language (BE #724), so matching the English text alone goes dead for
 * it/de/fr organizers — match a stable fragment of each catalog translation.
 * Structured error codes (FE #653) are the eventual replacement for this.
 */
const BILLING_REQUIRED_FRAGMENTS = [
	'billing information is required', // en
	'informazioni di fatturazione sono necessarie', // it
	'rechnungsinformationen sind', // de
	'informations de facturation sont requises' // fr
];

export function isBillingInfoRequiredError(message: string): boolean {
	const lower = message.toLowerCase();
	return BILLING_REQUIRED_FRAGMENTS.some((fragment) => lower.includes(fragment));
}
