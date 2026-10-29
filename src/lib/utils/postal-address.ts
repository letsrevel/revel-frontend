import { getLocale } from '$lib/paraglide/runtime.js';

/** Structured postal address, as edited in forms (all strings, '' when blank). */
export interface PostalAddress {
	line1: string;
	line2: string;
	postalCode: string;
	city: string;
	subdivision: string;
	countryCode: string;
}

export type RequiredAddressField = 'line1' | 'postalCode' | 'city' | 'countryCode';

/** ISO 3166-1 alpha-2 codes (Greece is always GR, never the VAT prefix EL). */
export const ISO_COUNTRY_CODES: readonly string[] = [
	'AD',
	'AE',
	'AF',
	'AG',
	'AI',
	'AL',
	'AM',
	'AO',
	'AQ',
	'AR',
	'AS',
	'AT',
	'AU',
	'AW',
	'AX',
	'AZ',
	'BA',
	'BB',
	'BD',
	'BE',
	'BF',
	'BG',
	'BH',
	'BI',
	'BJ',
	'BL',
	'BM',
	'BN',
	'BO',
	'BQ',
	'BR',
	'BS',
	'BT',
	'BV',
	'BW',
	'BY',
	'BZ',
	'CA',
	'CC',
	'CD',
	'CF',
	'CG',
	'CH',
	'CI',
	'CK',
	'CL',
	'CM',
	'CN',
	'CO',
	'CR',
	'CU',
	'CV',
	'CW',
	'CX',
	'CY',
	'CZ',
	'DE',
	'DJ',
	'DK',
	'DM',
	'DO',
	'DZ',
	'EC',
	'EE',
	'EG',
	'EH',
	'ER',
	'ES',
	'ET',
	'FI',
	'FJ',
	'FK',
	'FM',
	'FO',
	'FR',
	'GA',
	'GB',
	'GD',
	'GE',
	'GF',
	'GG',
	'GH',
	'GI',
	'GL',
	'GM',
	'GN',
	'GP',
	'GQ',
	'GR',
	'GS',
	'GT',
	'GU',
	'GW',
	'GY',
	'HK',
	'HM',
	'HN',
	'HR',
	'HT',
	'HU',
	'ID',
	'IE',
	'IL',
	'IM',
	'IN',
	'IO',
	'IQ',
	'IR',
	'IS',
	'IT',
	'JE',
	'JM',
	'JO',
	'JP',
	'KE',
	'KG',
	'KH',
	'KI',
	'KM',
	'KN',
	'KP',
	'KR',
	'KW',
	'KY',
	'KZ',
	'LA',
	'LB',
	'LC',
	'LI',
	'LK',
	'LR',
	'LS',
	'LT',
	'LU',
	'LV',
	'LY',
	'MA',
	'MC',
	'MD',
	'ME',
	'MF',
	'MG',
	'MH',
	'MK',
	'ML',
	'MM',
	'MN',
	'MO',
	'MP',
	'MQ',
	'MR',
	'MS',
	'MT',
	'MU',
	'MV',
	'MW',
	'MX',
	'MY',
	'MZ',
	'NA',
	'NC',
	'NE',
	'NF',
	'NG',
	'NI',
	'NL',
	'NO',
	'NP',
	'NR',
	'NU',
	'NZ',
	'OM',
	'PA',
	'PE',
	'PF',
	'PG',
	'PH',
	'PK',
	'PL',
	'PM',
	'PN',
	'PR',
	'PS',
	'PT',
	'PW',
	'PY',
	'QA',
	'RE',
	'RO',
	'RS',
	'RU',
	'RW',
	'SA',
	'SB',
	'SC',
	'SD',
	'SE',
	'SG',
	'SH',
	'SI',
	'SJ',
	'SK',
	'SL',
	'SM',
	'SN',
	'SO',
	'SR',
	'SS',
	'ST',
	'SV',
	'SX',
	'SY',
	'SZ',
	'TC',
	'TD',
	'TF',
	'TG',
	'TH',
	'TJ',
	'TK',
	'TL',
	'TM',
	'TN',
	'TO',
	'TR',
	'TT',
	'TV',
	'TW',
	'TZ',
	'UA',
	'UG',
	'UM',
	'US',
	'UY',
	'UZ',
	'VA',
	'VC',
	'VE',
	'VG',
	'VI',
	'VN',
	'VU',
	'WF',
	'WS',
	'YE',
	'YT',
	'ZA',
	'ZM',
	'ZW'
];

const ISO_SET: ReadonlySet<string> = new Set(ISO_COUNTRY_CODES);

export function emptyPostalAddress(): PostalAddress {
	return { line1: '', line2: '', postalCode: '', city: '', subdivision: '', countryCode: '' };
}

/** Trim, upper-case, and map the VAT prefix EL to the ISO code GR. */
export function normalizeCountryCode(code: string): string {
	const c = (code ?? '').trim().toUpperCase();
	return c === 'EL' ? 'GR' : c;
}

/** Country implied by a VAT ID prefix ('' when unknown). XI (Northern Ireland) maps to GB. */
export function countryFromVatId(vatId: string): string {
	const prefix = (vatId ?? '').trim().slice(0, 2).toUpperCase();
	if (prefix.length < 2) return '';
	if (prefix === 'XI') return 'GB';
	const code = normalizeCountryCode(prefix);
	return ISO_SET.has(code) ? code : '';
}

function str(v: unknown): string {
	return typeof v === 'string' ? v : '';
}

export function readPostalAddress(
	obj: Record<string, unknown> | null | undefined,
	prefix: 'billing_' | 'buyer_'
): PostalAddress {
	if (!obj) return emptyPostalAddress();
	return {
		line1: str(obj[`${prefix}address_line1`]),
		line2: str(obj[`${prefix}address_line2`]),
		postalCode: str(obj[`${prefix}postal_code`]),
		city: str(obj[`${prefix}city`]),
		subdivision: str(obj[`${prefix}subdivision`]),
		countryCode: str(obj[`${prefix}country_code`])
	};
}

function clean(a: PostalAddress): PostalAddress {
	return {
		line1: a.line1.trim(),
		line2: a.line2.trim(),
		postalCode: a.postalCode.trim(),
		city: a.city.trim(),
		subdivision: a.subdivision.trim(),
		countryCode: normalizeCountryCode(a.countryCode)
	};
}

export function toBillingFields(a: PostalAddress) {
	const c = clean(a);
	return {
		billing_address_line1: c.line1,
		billing_address_line2: c.line2,
		billing_postal_code: c.postalCode,
		billing_city: c.city,
		billing_subdivision: c.subdivision,
		billing_country_code: c.countryCode
	};
}

export function toBuyerFields(a: PostalAddress) {
	const c = clean(a);
	return {
		buyer_address_line1: c.line1,
		buyer_address_line2: c.line2,
		buyer_postal_code: c.postalCode,
		buyer_city: c.city,
		buyer_subdivision: c.subdivision,
		buyer_country_code: c.countryCode
	};
}

export function missingRequiredFields(a: PostalAddress): RequiredAddressField[] {
	const c = clean(a);
	const missing: RequiredAddressField[] = [];
	if (!c.line1) missing.push('line1');
	if (!c.postalCode) missing.push('postalCode');
	if (!c.city) missing.push('city');
	if (!c.countryCode) missing.push('countryCode');
	return missing;
}

export function isPostalAddressComplete(a: PostalAddress): boolean {
	return missingRequiredFields(a).length === 0;
}

const displayNamesCache = new Map<string, Intl.DisplayNames>();
const collatorCache = new Map<string, Intl.Collator>();

function resolveLocale(locale: string): string {
	return locale.toLowerCase() === 'pt' ? 'pt-PT' : locale;
}

/** Memoized collator for a locale (one per locale, not one per comparison). */
export function getCountryCollator(locale: string = getLocale()): Intl.Collator {
	const loc = resolveLocale(locale);
	let c = collatorCache.get(loc);
	if (!c) {
		c = new Intl.Collator(loc);
		collatorCache.set(loc, c);
	}
	return c;
}

/**
 * Localized country name; falls back to the code if Intl can't resolve it.
 * The single implementation behind `compliance.countryName`; the formatter is
 * memoized per locale.
 */
export function countryDisplayName(code: string, locale: string = getLocale()): string {
	const c = normalizeCountryCode(code);
	if (!c) return '';
	try {
		const loc = resolveLocale(locale);
		let names = displayNamesCache.get(loc);
		if (!names) {
			names = new Intl.DisplayNames([loc], { type: 'region' });
			displayNamesCache.set(loc, names);
		}
		return names.of(c) ?? c;
	} catch {
		return c;
	}
}

/** Codes mapped to localized names, sorted by name in the locale. */
export function sortedCountryOptions(
	codes: Iterable<string>,
	locale: string = getLocale()
): Array<{ code: string; name: string }> {
	const collator = getCountryCollator(locale);
	return [...codes]
		.map((code) => ({ code, name: countryDisplayName(code, locale) }))
		.sort((a, b) => collator.compare(a.name, b.name));
}

/** Multi-line legacy `billing_address` text composed from the structured fields. */
export function composeLegacyAddress(a: PostalAddress, locale?: string): string {
	const c = clean(a);
	const lines = [
		c.line1,
		c.line2,
		[c.postalCode, c.city].filter(Boolean).join(' '),
		c.subdivision,
		c.countryCode ? countryDisplayName(c.countryCode, locale) : ''
	];
	return lines.filter(Boolean).join('\n');
}
