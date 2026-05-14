/**
 * Curated list of currencies the platform supports.
 * Mirrors the backend's `Currencies` whitelist (kept in sync as of 1.50.2).
 * Source of truth lives in revel-backend; if backend changes, update both.
 */
export const CURRENCY_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
	{ value: 'AUD', label: 'AUD — Australian Dollar' },
	{ value: 'BRL', label: 'BRL — Brazilian Real' },
	{ value: 'CAD', label: 'CAD — Canadian Dollar' },
	{ value: 'CHF', label: 'CHF — Swiss Franc' },
	{ value: 'CNY', label: 'CNY — Chinese Yuan' },
	{ value: 'CZK', label: 'CZK — Czech Koruna' },
	{ value: 'DKK', label: 'DKK — Danish Krone' },
	{ value: 'EUR', label: 'EUR — Euro' },
	{ value: 'GBP', label: 'GBP — British Pound' },
	{ value: 'HKD', label: 'HKD — Hong Kong Dollar' },
	{ value: 'HUF', label: 'HUF — Hungarian Forint' },
	{ value: 'IDR', label: 'IDR — Indonesian Rupiah' },
	{ value: 'ILS', label: 'ILS — Israeli New Shekel' },
	{ value: 'INR', label: 'INR — Indian Rupee' },
	{ value: 'ISK', label: 'ISK — Icelandic Króna' },
	{ value: 'JPY', label: 'JPY — Japanese Yen' },
	{ value: 'KRW', label: 'KRW — South Korean Won' },
	{ value: 'MXN', label: 'MXN — Mexican Peso' },
	{ value: 'MYR', label: 'MYR — Malaysian Ringgit' },
	{ value: 'NOK', label: 'NOK — Norwegian Krone' },
	{ value: 'NZD', label: 'NZD — New Zealand Dollar' },
	{ value: 'PHP', label: 'PHP — Philippine Peso' },
	{ value: 'PLN', label: 'PLN — Polish Złoty' },
	{ value: 'RON', label: 'RON — Romanian Leu' },
	{ value: 'SEK', label: 'SEK — Swedish Krona' },
	{ value: 'SGD', label: 'SGD — Singapore Dollar' },
	{ value: 'THB', label: 'THB — Thai Baht' },
	{ value: 'TRY', label: 'TRY — Turkish Lira' },
	{ value: 'USD', label: 'USD — US Dollar' },
	{ value: 'ZAR', label: 'ZAR — South African Rand' }
];
