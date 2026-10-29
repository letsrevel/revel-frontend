import type { AttendeeInvoiceDetailSchema, VatCategory } from '$lib/api/generated/types.gen';
import {
	composeLegacyAddress,
	readPostalAddress,
	toBuyerFields,
	type PostalAddress
} from '$lib/utils/postal-address';

/**
 * Buyer address as the PDF prints it: the structured block when a street is set,
 * otherwise the legacy free text. Lines are separated by "\n" (use whitespace-pre-line).
 */
export function buyerAddressText(
	inv: Pick<AttendeeInvoiceDetailSchema, 'buyer_address' | 'buyer_address_line1'> &
		Partial<AttendeeInvoiceDetailSchema>
): string {
	if ((inv.buyer_address_line1 ?? '').trim()) {
		return composeLegacyAddress(readPostalAddress(inv as Record<string, unknown>, 'buyer_'));
	}
	return inv.buyer_address ?? '';
}

export interface ExemptionEntry {
	category: string;
	text: string;
	code: string;
}

/** `vat_exemptions` (category -> {text, code}) as a stable, display-ready list. */
export function exemptionEntries(
	map: { [key in VatCategory]?: { text: string; code: string } } | null | undefined
): ExemptionEntry[] {
	return Object.entries(map ?? {})
		.filter(([, v]) => !!v && (v.text || v.code))
		.map(([category, v]) => ({ category, text: v?.text ?? '', code: v?.code ?? '' }))
		.sort((a, b) => a.category.localeCompare(b.category));
}

export interface DraftBuyerInput {
	name: string;
	email: string;
	vatId: string;
	vatCountry: string;
	legacyAddress: string;
	address: PostalAddress;
}

/** PATCH body for a draft attendee invoice. Structured buyer fields use '' to clear. */
export function buildDraftBuyerUpdate(v: DraftBuyerInput) {
	return {
		buyer_name: v.name || null,
		buyer_email: v.email || null,
		buyer_vat_id: v.vatId || null,
		buyer_vat_country: v.vatCountry || null,
		buyer_address: v.legacyAddress || null,
		...toBuyerFields(v.address)
	};
}
