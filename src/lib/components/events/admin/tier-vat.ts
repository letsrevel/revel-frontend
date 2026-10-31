import type { InvoicingMode } from '$lib/api/generated/types.gen';
import type { TicketTierDetailSchema } from '$lib/api/generated/types.gen';
import { normalizeDecimalInput } from './tier-form-helpers';

/** The organization's VAT defaults a ticket tier inherits from (admin schema fields). */
export interface OrgVatContext {
	/** Org default VAT rate as the API sends it (decimal string), or null when unset. */
	vatRate: string | null;
	invoicingMode: InvoicingMode;
	/** Org default VAT exemption reason ('' when none). */
	exemptionReason: string;
	/** The org trades under a small-business scheme: no VAT is charged, tiers are fixed at 0%. */
	smallBusiness: boolean;
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
		exemptionReason: typeof r.vat_exemption_reason === 'string' ? r.vat_exemption_reason : '',
		smallBusiness: typeof r.small_business_scheme === 'string' && r.small_business_scheme !== 'none'
	};
}

function parseRate(value: string | null | undefined): number | null {
	if (value == null || value.trim() === '') return null;
	const n = parseFloat(normalizeDecimalInput(value));
	return Number.isFinite(n) ? n : null;
}

/**
 * Under a small-business scheme a tier cannot charge VAT: a positive override is
 * cleared so the tier inherits the org's 0%. Anything else is left as typed.
 */
export function schemeAdjustedOverride(override: string, org: OrgVatContext | null): string {
	return org?.smallBusiness && positive(override) ? '' : override;
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

/**
 * Paid online: online method and a positive fixed price / PWYC bound / category price.
 *
 * The category-price clause is INTENTIONALLY stricter than the backend: a seated
 * tier with a positive per-category price is invoiced at purchase, so the form
 * asks for the exemption reason up front rather than failing at checkout time.
 * Do not "align" it with the BE.
 */
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

/**
 * True when the zero-rate rule is the likely cause of a refusal: exactly the
 * conditions of `vatExemptionRequired` (invoicing on, paid online, effective 0%)
 * and the tier has no reason of its own. Used to suppress the unrelated
 * country-rule hint without matching backend text.
 */
export function exemptionLikelyCause(
	v: TierPriceInputs & { vatRateOverride: string; vatExemptionReason: string },
	org: OrgVatContext | null
): boolean {
	return vatExemptionRequired(v, v.vatRateOverride, org) && v.vatExemptionReason.trim() === '';
}

/**
 * The reason as the payload carries it. A free tier, or one with an explicit
 * NON-zero override, makes a reason meaningless, so '' is sent. A reason hidden
 * only by a non-zero ORG default (no override) is kept: that is org data the
 * user did not touch.
 */
export function exemptionReasonForPayload(
	paymentMethod: string,
	vatRateOverride: string,
	vatExemptionReason: string
): string {
	if (paymentMethod === 'free') return '';
	const override = parseRate(vatRateOverride);
	if (vatRateOverride.trim() !== '' && override !== null && override !== 0) return '';
	return vatExemptionReason.trim();
}

/** Form values behind the backend's ZERO_RATE_RULE_FIELDS (payload-shaped). */
export interface ZeroRuleInputs {
	paymentMethod: string;
	priceType: string;
	/** Price as it would be sent (already '0' for free, pwycMin for PWYC). */
	price: string;
	pwycMin: string;
	pwycMax: string;
	vatRateOverride: string;
	vatExemptionReason: string;
}

const num = (v: unknown): number | null => {
	if (v == null || String(v).trim() === '') return null;
	const n = parseFloat(normalizeDecimalInput(String(v)));
	return Number.isFinite(n) ? n : null;
};

/**
 * Rule fields (backend payload keys) whose value differs from the saved tier. The
 * backend enforces the zero-rate rule on update whenever ANY of these keys is
 * present in the payload (key presence, not value), so the form sends only the
 * changed ones and a plain rename of a legacy tier still saves.
 * PWYC bounds are only compared for PWYC tiers (they are not sent otherwise).
 */
export function changedZeroRuleFields(tier: TicketTierDetailSchema, v: ZeroRuleInputs): string[] {
	const changed: string[] = [];
	if (v.paymentMethod !== tier.payment_method) changed.push('payment_method');
	if (v.priceType !== tier.price_type) changed.push('price_type');
	if (num(v.price) !== num(tier.price)) changed.push('price');
	if (v.priceType === 'pwyc') {
		if (v.pwycMin && num(v.pwycMin) !== num(tier.pwyc_min)) changed.push('pwyc_min');
		if (v.pwycMax && num(v.pwycMax) !== num(tier.pwyc_max)) changed.push('pwyc_max');
	}
	const rate = v.paymentMethod === 'free' ? null : num(v.vatRateOverride);
	if (rate !== num(tier.vat_rate)) changed.push('vat_rate');
	if (v.vatExemptionReason.trim() !== (tier.vat_exemption_reason ?? '').trim()) {
		changed.push('vat_exemption_reason');
	}
	return changed;
}

/**
 * Whether saving re-runs the backend's zero-rate rule: always on create; on update
 * when a rule key is sent, `category_prices` is sent (it is a rule key too, and
 * only sent when dirty), or a paused tier is resumed (BE #1241).
 */
export function zeroRuleRechecked(
	tier: TicketTierDetailSchema | null,
	v: ZeroRuleInputs,
	salesPaused: boolean,
	categoryPricesSent: boolean
): boolean {
	if (!tier) return true;
	if (categoryPricesSent) return true;
	if (tier.sales_paused && !salesPaused) return true;
	return changedZeroRuleFields(tier, v).length > 0;
}

/** Price as the payload carries it (mirrors TierForm's submit). */
export function payloadPrice(
	paymentMethod: string,
	priceType: string,
	price: string,
	pwycMin: string
): string {
	if (paymentMethod === 'free') return '0';
	if (priceType === 'pwyc') return normalizeDecimalInput(pwycMin || '1');
	return normalizeDecimalInput(price);
}

const ZERO_RULE_KEYS = [
	'payment_method',
	'price_type',
	'price',
	'pwyc_min',
	'pwyc_max',
	'vat_rate',
	'vat_exemption_reason'
] as const;

/** Deletes, in place, the rule keys of an update payload that did not change vs the saved tier. */
export function omitUnchangedZeroRuleFields(
	tier: TicketTierDetailSchema,
	payload: object,
	v: ZeroRuleInputs
): void {
	const changed = changedZeroRuleFields(tier, v);
	for (const k of ZERO_RULE_KEYS) {
		// eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- a fixed key list
		if (!changed.includes(k)) delete (payload as Record<string, unknown>)[k];
	}
}
