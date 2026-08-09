/**
 * Fee estimation helpers for organizer-facing payout previews.
 *
 * Everything here is an ESTIMATE for display ("you get ~X"): Stripe's actual
 * fee varies by card country/type (the constants assume EEA cards), and the
 * VAT charged on the platform fee depends on the org's billing profile
 * (reverse charge for cross-border EU B2B with a validated VAT ID). The
 * authoritative numbers are computed server-side at invoicing time.
 */

/** Stripe EEA-card estimate: 1.5% + €0.25 per transaction. */
export const STRIPE_FEE_PERCENT = 1.5;
export const STRIPE_FEE_FIXED = 0.25;

/** Revel's standard platform fee, used by the marketing calculator. */
export const DEFAULT_PLATFORM_FEE_PERCENT = 1.5;
export const DEFAULT_PLATFORM_FEE_FIXED = 0.25;

/**
 * The platform's domestic VAT standard rate (Austria, 20%), for the landing
 * calculator ONLY — it has no org context. Org-specific surfaces must use
 * `platformFeeInfoFrom` instead: the applicable rate is 0 under reverse
 * charge and the platform rate itself is a backend site setting (the demo
 * instance runs a different country/rate).
 */
export const PLATFORM_VAT_RATE_PERCENT = 20;

/** An organization's platform-fee terms, as displayed in payout previews. */
export interface PlatformFeeInfo {
	/** Percentage as a percent value (1.5 means 1.5%). */
	percent: number;
	/** Fixed part per ticket, in the tier's currency. */
	fixed: number;
	/**
	 * VAT rate charged ON the platform fee (percent value; 0 when reverse
	 * charge applies or while the backend does not expose the field yet).
	 */
	vatRate: number;
}

export interface NetPayoutEstimate {
	stripeFee: number;
	platformFee: number;
	platformFeeVat: number;
	/** price - stripeFee - platformFee - platformFeeVat, clamped at 0. */
	net: number;
}

/**
 * Estimate the organizer's net payout per ticket sold online.
 * Returns null when the price is not a positive finite number.
 */
export function estimateNetPayout(params: {
	price: number;
	platformFeePercent: number;
	platformFeeFixed: number;
	platformFeeVatRate?: number;
}): NetPayoutEstimate | null {
	const { price, platformFeePercent, platformFeeFixed, platformFeeVatRate = 0 } = params;
	if (!Number.isFinite(price) || price <= 0) return null;

	const stripeFee = price * (STRIPE_FEE_PERCENT / 100) + STRIPE_FEE_FIXED;
	const platformFee = price * (platformFeePercent / 100) + platformFeeFixed;
	const platformFeeVat = platformFee * (platformFeeVatRate / 100);
	const net = Math.max(price - stripeFee - platformFee - platformFeeVat, 0);

	return { stripeFee, platformFee, platformFeeVat, net };
}

function toFiniteNumber(value: unknown): number | null {
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	if (typeof value === 'string' && value.trim() !== '') {
		const parsed = Number(value);
		if (Number.isFinite(parsed)) return parsed;
	}
	return null;
}

/**
 * Build a {@link PlatformFeeInfo} from the admin organization object
 * (`OrganizationAdminDetailSchema`, which since backend #866 exposes the
 * computed `platform_fee_vat_rate` — "0.00" under reverse charge / non-EU).
 * Returns null when the fee fields are missing/unparseable, in which case
 * callers should not render a preview.
 *
 * Parsing stays runtime-tolerant (`unknown` input) because call sites hold
 * the org as the narrower public `OrganizationRetrieveSchema` type, and so
 * the preview degrades gracefully against an older backend too.
 */
export function platformFeeInfoFrom(org: unknown): PlatformFeeInfo | null {
	if (typeof org !== 'object' || org === null) return null;
	const record = org as Record<string, unknown>;
	const percent = toFiniteNumber(record.platform_fee_percent);
	const fixed = toFiniteNumber(record.platform_fee_fixed);
	if (percent === null || fixed === null || percent < 0 || fixed < 0) return null;
	const vatRate = toFiniteNumber(record.platform_fee_vat_rate);
	return {
		percent,
		fixed,
		vatRate: vatRate !== null && vatRate > 0 ? vatRate : 0
	};
}
