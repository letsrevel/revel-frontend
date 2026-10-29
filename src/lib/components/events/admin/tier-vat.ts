import type { InvoicingMode } from '$lib/api/generated/types.gen';
import { normalizeDecimalInput } from './tier-form-helpers';

/** The organization's VAT defaults a ticket tier inherits from (admin schema fields). */
export interface OrgVatContext {
	/** Org default VAT rate as the API sends it (decimal string), or null when unset. */
	vatRate: string | null;
	invoicingMode: InvoicingMode;
	/** Org default VAT exemption reason ('' when none). */
	exemptionReason: string;
}

const INVOICING_MODES: readonly string[] = ['none', 'hybrid', 'auto'];

/**
 * Pulls the VAT context out of an organization object. The editor routes hand
 * over the admin schema (it has vat_rate / invoicing_mode / vat_exemption_reason)
 * typed as the narrower public one, so read it defensively. Null when the
 * invoicing mode is missing (older backend / public schema).
 */
export function orgVatContextFrom(org: unknown): OrgVatContext | null {
	if (typeof org !== 'object' || org === null) return null;
	const r = org as Record<string, unknown>;
	if (typeof r.invoicing_mode !== 'string' || !INVOICING_MODES.includes(r.invoicing_mode)) {
		return null;
	}
	const rate = r.vat_rate;
	return {
		vatRate: typeof rate === 'string' || typeof rate === 'number' ? String(rate) : null,
		invoicingMode: r.invoicing_mode as InvoicingMode,
		exemptionReason: typeof r.vat_exemption_reason === 'string' ? r.vat_exemption_reason : ''
	};
}

function parseRate(value: string | null | undefined): number | null {
	if (value == null || value.trim() === '') return null;
	const n = parseFloat(normalizeDecimalInput(value));
	return Number.isFinite(n) ? n : null;
}

/** Tier override when non-empty, otherwise the org default; null when neither is known. */
export function effectiveVatRate(override: string, org: OrgVatContext | null): number | null {
	if (override.trim() !== '') return parseRate(override);
	return parseRate(org?.vatRate);
}

function positive(value: string): boolean {
	const n = parseFloat(normalizeDecimalInput(value || '0'));
	return Number.isFinite(n) && n > 0;
}

export interface TierPriceInputs {
	paymentMethod: string;
	priceType: string;
	price: string;
	pwycMin: string;
	pwycMax: string;
	/** Per-category prices of a seated tier (they replace the flat price). */
	categoryPrices?: readonly string[];
}

/** Paid online: online method and a positive fixed price / PWYC bound / category price. */
export function isPaidOnline(t: TierPriceInputs): boolean {
	if (t.paymentMethod !== 'online') return false;
	if ((t.categoryPrices ?? []).some(positive)) return true;
	return t.priceType === 'pwyc' ? positive(t.pwycMin) || positive(t.pwycMax) : positive(t.price);
}

/**
 * The input shows for a non-free tier whose effective rate is 0. Without the
 * org context (rate unknown) it falls back to an explicit override of 0.
 */
export function vatExemptionVisible(
	paymentMethod: string,
	vatRateOverride: string,
	org: OrgVatContext | null
): boolean {
	if (paymentMethod === 'free') return false;
	if (!org) return parseRate(vatRateOverride) === 0 && vatRateOverride.trim() !== '';
	return effectiveVatRate(vatRateOverride, org) === 0;
}

/** Required: invoicing on, paid online, 0% effective rate and no org default reason. */
export function vatExemptionRequired(
	tier: TierPriceInputs,
	vatRateOverride: string,
	org: OrgVatContext | null
): boolean {
	if (!org || org.invoicingMode === 'none') return false;
	if (!isPaidOnline(tier)) return false;
	if (effectiveVatRate(vatRateOverride, org) !== 0) return false;
	return org.exemptionReason.trim() === '';
}
