import * as m from '$lib/paraglide/messages.js';
import {
	composeLegacyAddress,
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

/**
 * Legacy `billing_address` text for the PATCH body. When the structured form is
 * empty we keep the existing legacy text instead of clobbering it with ''.
 */
export function legacyAddressForPayload(a: PostalAddress, existingLegacy: string): string {
	return isAddressBlank(a) ? existingLegacy : composeLegacyAddress(a);
}

export interface OrgBillingFormValues {
	countryCode: string;
	vatRate: string;
	billingName: string;
	billingEmail: string;
	vatExemptionReason: string;
	address: PostalAddress;
	existingLegacyAddress: string;
}

export function buildBillingInfoPayload(v: OrgBillingFormValues) {
	return {
		vat_country_code: v.countryCode || '',
		vat_rate: v.vatRate ? parseFloat(v.vatRate) : null,
		billing_name: v.billingName || '',
		billing_email: v.billingEmail || '',
		vat_exemption_reason: v.vatExemptionReason.trim(),
		billing_address: legacyAddressForPayload(v.address, v.existingLegacyAddress),
		...toBillingFields(v.address)
	};
}
