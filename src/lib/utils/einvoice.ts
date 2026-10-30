import * as m from '$lib/paraglide/messages.js';
import {
	composeLegacyAddress,
	emptyPostalAddress,
	toBillingFields,
	type PostalAddress
} from '$lib/utils/postal-address';

/** Translated human label for each `einvoice_missing_fields` value the backend can send. */
const MISSING_FIELD_LABELS: Record<string, () => string> = {
	billing_address_line1: () => m['einvoice.missing.line1'](),
	billing_postal_code: () => m['einvoice.missing.postalCode'](),
	billing_city: () => m['einvoice.missing.city'](),
	billing_country_code: () => m['einvoice.missing.country'](),
	billing_name: () => m['einvoice.missing.name'](),
	vat_id: () => m['einvoice.missing.vatId'](),
	vat_exemption_reason: () => m['einvoice.missing.exemptionReason']()
};

/** Label for one missing field; unknown values fall back to the raw string. */
export function missingFieldLabel(field: string): string {
	return MISSING_FIELD_LABELS[field]?.() ?? field;
}

export function missingFieldLabels(fields: readonly string[] | null | undefined): string[] {
	return (fields ?? []).map(missingFieldLabel);
}

export function isAddressBlank(a: PostalAddress): boolean {
	return Object.values(a).every((v) => v.trim() === '');
}

/** Persisted legacy text always names the country in English, never in the editor's UI locale. */
export const LEGACY_ADDRESS_LOCALE = 'en';

/**
 * Legacy `billing_address` text for the PATCH/PUT body.
 * - Structured address filled in: composed text (English country name).
 * - Blanked entirely after a non-empty saved structured address: '' (an address can be cleared).
 * - Blank and nothing structured was saved: keep the existing legacy text.
 */
export function legacyAddressForPayload(
	a: PostalAddress,
	existingLegacy: string,
	savedStructured: PostalAddress = emptyPostalAddress()
): string {
	if (!isAddressBlank(a)) return composeLegacyAddress(a, LEGACY_ADDRESS_LOCALE);
	return isAddressBlank(savedStructured) ? existingLegacy : '';
}

export interface OrgBillingFormValues {
	countryCode: string;
	vatRate: string;
	billingName: string;
	billingEmail: string;
	vatExemptionReason: string;
	address: PostalAddress;
	existingLegacyAddress: string;
	/** Structured address as loaded from the server. */
	savedAddress?: PostalAddress;
	/** VAT rate as loaded (decimal string or null). */
	savedVatRate?: string | number | null;
	/** Exemption reason as loaded. */
	savedExemptionReason?: string | null;
}

const rateOrNull = (v: string | number | null | undefined): number | null => {
	if (v == null || String(v).trim() === '') return null;
	const n = parseFloat(String(v));
	return Number.isFinite(n) ? n : null;
};

/**
 * `vat_rate` / `vat_exemption_reason` are sent only when they differ from the loaded
 * values: the backend runs its zero-rate guard whenever either key is present, which
 * would otherwise block saving just the address of an org with a legacy 0% tier.
 */
export function buildBillingInfoPayload(v: OrgBillingFormValues) {
	const rate = rateOrNull(v.vatRate);
	const reason = v.vatExemptionReason.trim();
	return {
		vat_country_code: v.countryCode || '',
		billing_name: v.billingName || '',
		billing_email: v.billingEmail || '',
		billing_address: legacyAddressForPayload(v.address, v.existingLegacyAddress, v.savedAddress),
		...toBillingFields(v.address),
		...(rate !== rateOrNull(v.savedVatRate) ? { vat_rate: rate } : {}),
		...(reason !== (v.savedExemptionReason ?? '').trim() ? { vat_exemption_reason: reason } : {})
	};
}
