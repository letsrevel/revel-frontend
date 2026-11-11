import { getDateLocale } from '$lib/utils/date';

/**
 * Currencies the platform supports (ISO 4217 codes).
 * Mirrors the backend's `Currencies` whitelist (kept in sync as of 1.50.2).
 * Source of truth lives in revel-backend; if backend changes, update both.
 */
export const SUPPORTED_CURRENCY_CODES: readonly string[] = [
	'AUD',
	'BRL',
	'CAD',
	'CHF',
	'CNY',
	'CZK',
	'DKK',
	'EUR',
	'GBP',
	'HKD',
	'HUF',
	'IDR',
	'ILS',
	'INR',
	'ISK',
	'JPY',
	'KRW',
	'MXN',
	'MYR',
	'NOK',
	'NZD',
	'PHP',
	'PLN',
	'RON',
	'SEK',
	'SGD',
	'THB',
	'TRY',
	'USD',
	'ZAR'
];

const displayNamesCache = new Map<string, Intl.DisplayNames | null>();

function getDisplayNames(locale: string): Intl.DisplayNames | null {
	if (displayNamesCache.has(locale)) return displayNamesCache.get(locale) ?? null;
	let instance: Intl.DisplayNames | null;
	try {
		instance = new Intl.DisplayNames([locale], { type: 'currency' });
	} catch {
		instance = null;
	}
	displayNamesCache.set(locale, instance);
	return instance;
}

/**
 * Localized currency name ("Australian Dollar", "Australischer Dollar", ...)
 * in the active UI language. Falls back to the code when unavailable.
 * `locale` is for tests; production callers omit it.
 */
export function currencyDisplayName(code: string, locale: string = getDateLocale()): string {
	try {
		return getDisplayNames(locale)?.of(code) ?? code;
	} catch {
		return code;
	}
}

/** Select options like `{ value: 'AUD', label: 'AUD · Australian Dollar' }`, localized. */
export function currencyOptions(locale?: string): { value: string; label: string }[] {
	return SUPPORTED_CURRENCY_CODES.map((code) => ({
		value: code,
		label: `${code} · ${currencyDisplayName(code, locale)}`
	}));
}
