import type { SmallBusinessScheme } from '$lib/api/generated/types.gen';

/** A declared small-business (Kleinunternehmer) scheme, i.e. anything but `none`. */
export type DeclaredScheme = Exclude<SmallBusinessScheme, 'none'>;

/** Scheme -> the country whose law grants it (the organizer must be established there). */
export const SCHEME_COUNTRY: Record<DeclaredScheme, string> = {
	de_19: 'DE',
	at_6_1_27: 'AT'
};

/** The scheme available to an organizer established in `country`, or null. */
export function schemeForCountry(country: string | null | undefined): DeclaredScheme | null {
	const c = (country ?? '').trim().toUpperCase();
	for (const scheme of Object.keys(SCHEME_COUNTRY) as DeclaredScheme[]) {
		if (SCHEME_COUNTRY[scheme] === c) return scheme;
	}
	return null;
}

/** Country of a scheme; '' for `none` / unknown. */
export function schemeCountry(scheme: string | null | undefined): string {
	return SCHEME_COUNTRY[scheme as DeclaredScheme] ?? '';
}

/**
 * A German scheme organizer must hold a VIES-validated VAT ID: Revel's platform fee is
 * reverse-charged to them. An Austrian one buys a domestic supply and needs none.
 */
export function schemeRequiresVatId(scheme: string | null | undefined): boolean {
	return scheme === 'de_19';
}

/** Statutory notes printed on invoices; legal text, never translated. Mirrors the backend. */
export const SCHEME_EXEMPTION_NOTES: Record<DeclaredScheme, string> = {
	de_19: 'Steuerbefreit gemäß § 19 UStG (Kleinunternehmerregelung)',
	at_6_1_27: 'Umsatzsteuerbefreit – Kleinunternehmer gem. § 6 Abs. 1 Z 27 UStG'
};

export function schemeExemptionNote(scheme: string | null | undefined): string {
	return SCHEME_EXEMPTION_NOTES[scheme as DeclaredScheme] ?? '';
}

/** Accepted digit counts per country (plausibility only; these numbers cannot be looked up). */
const TAX_NUMBER_LENGTHS: Record<string, readonly number[]> = {
	DE: [10, 11, 13],
	AT: [9]
};

/** Example per country, shown as a hint. */
export const TAX_NUMBER_EXAMPLES: Record<string, string> = {
	DE: '12/345/67890',
	AT: '12-345/6789'
};

/** The number with the separators `/ - .` and whitespace removed. */
export function taxNumberDigits(s: string): string {
	return s.replace(/[\s/.-]/g, '');
}

/** Plausibility check on ASCII digits only; a blank value is not valid. */
export function isTaxNumberValid(country: string, s: string): boolean {
	const lengths = TAX_NUMBER_LENGTHS[country.trim().toUpperCase()];
	if (!lengths) return false;
	const digits = taxNumberDigits(s);
	return /^[0-9]+$/.test(digits) && lengths.includes(digits.length);
}

export interface OrgCountryInputs {
	vatCountryCode?: string | null;
	vatId?: string | null;
	billingCountryCode?: string | null;
	/** Backend-resolved country (`compliance.country`), used when nothing above is set. */
	fallback?: string | null;
}

/** Country of establishment, mirroring the backend's resolution order. */
export function resolveOrgCountry(i: OrgCountryInputs): string {
	const vatCountry = (i.vatCountryCode ?? '').trim();
	if (vatCountry) return vatCountry.toUpperCase();
	const prefix = (i.vatId ?? '').trim().slice(0, 2);
	if (/^[A-Za-z]{2}$/.test(prefix)) return prefix.toUpperCase();
	const billing = (i.billingCountryCode ?? '').trim();
	if (billing) return billing.toUpperCase();
	return (i.fallback ?? '').trim().toUpperCase();
}

export type SchemeBlocker =
	| 'wrong_country'
	| 'vat_id_not_validated'
	| 'tax_number_required'
	| 'tax_number_invalid'
	| 'vat_rate_not_zero';

export interface SchemeBlockerInputs {
	/** The scheme the form would save. */
	scheme: SmallBusinessScheme;
	country: string;
	vatIdValidated: boolean;
	taxNumber: string;
	/** Org default VAT rate as loaded (decimal string or number), null when unset. */
	vatRate: string | number | null | undefined;
	/** The user confirmed that the default rate is set to 0 % together with the scheme. */
	vatRateZeroConfirmed: boolean;
}

/** True when the loaded default VAT rate is positive. */
export function vatRateIsPositive(vatRate: string | number | null | undefined): boolean {
	if (vatRate == null || String(vatRate).trim() === '') return false;
	const n = parseFloat(String(vatRate));
	return Number.isFinite(n) && n > 0;
}

/** Everything that currently prevents saving the scheme; empty when `scheme` is `none`. */
export function schemeBlockers(i: SchemeBlockerInputs): SchemeBlocker[] {
	if (i.scheme === 'none') return [];
	const out: SchemeBlocker[] = [];
	const country = schemeCountry(i.scheme);
	if (i.country.trim().toUpperCase() !== country) out.push('wrong_country');
	if (schemeRequiresVatId(i.scheme) && !i.vatIdValidated) out.push('vat_id_not_validated');
	const taxNumber = i.taxNumber.trim();
	if (taxNumber === '') {
		// A VIES-validated VAT ID identifies the seller (backend scheme_identity_complete).
		if (i.scheme === 'at_6_1_27' && !i.vatIdValidated) out.push('tax_number_required');
	} else if (!isTaxNumberValid(country, taxNumber)) {
		out.push('tax_number_invalid');
	}
	if (vatRateIsPositive(i.vatRate) && !i.vatRateZeroConfirmed) out.push('vat_rate_not_zero');
	return out;
}
