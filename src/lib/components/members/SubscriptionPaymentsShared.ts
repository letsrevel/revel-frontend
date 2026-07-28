/**
 * Shared helpers for the org-wide membership payment ledger
 * (`SubscriptionPaymentsTab` + its row/card renderers).
 *
 * Kept out of `$lib/utils/subscriptions.ts` on purpose: that module models the
 * *subscription* lifecycle (`SubscriptionStatus`), whereas these describe a
 * single `MembershipPayment` row, which has its own four-value status enum.
 */
import type {
	OrganizationMembershipPaymentSchema,
	PaymentStatus
} from '$lib/api/generated/types.gen';

export interface PaymentStatusConfig {
	/** Tailwind tint. Decoration only — always paired with the label and an icon. */
	className: string;
}

/**
 * Separated by *lightness* as much as by hue, so protanopia/deuteranopia
 * viewers still see four distinct chips; the label and icon carry the meaning.
 */
const PAYMENT_STATUS_CONFIG: Record<PaymentStatus, PaymentStatusConfig> = {
	succeeded: {
		className: 'bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-green-100'
	},
	pending: {
		className: 'bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100'
	},
	failed: {
		className: 'bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-100'
	},
	refunded: {
		className: 'bg-muted text-muted-foreground'
	}
};

export function getPaymentStatusConfig(status: PaymentStatus): PaymentStatusConfig {
	return PAYMENT_STATUS_CONFIG[status];
}

/**
 * A *partial* refund deliberately leaves `status = 'succeeded'` (the member
 * keeps the period they partly paid for), so the status column alone cannot
 * reveal it — a reconciliation view has to annotate the amount instead. A full
 * refund flips the status to `refunded` and needs no annotation.
 *
 * Amounts arrive as decimal STRINGS, so the comparison is numeric.
 *
 * @returns the refunded amount (raw string, ready for `formatMoney`) when the
 * payment is *partially* refunded, otherwise `null`.
 */
export function partialRefundAmount(
	payment: Pick<OrganizationMembershipPaymentSchema, 'amount' | 'refund_amount'>
): string | null {
	if (!payment.refund_amount) return null;
	const refunded = Number(payment.refund_amount);
	if (!Number.isFinite(refunded) || refunded <= 0) return null;
	const total = Number(payment.amount);
	if (!Number.isFinite(total)) return null;
	return refunded < total ? payment.refund_amount : null;
}

/**
 * The subset of a membership payment the fee decomposition needs. Written as a
 * `Pick` so it is satisfied structurally by BOTH staff schemas —
 * `MembershipPaymentSchema` (subscription drawer) and
 * `OrganizationMembershipPaymentSchema` (org-wide ledger) — which carry these
 * fields identically. The member-facing `MyMembershipPaymentSchema` has none of
 * them and is deliberately not modelled here.
 */
export type PlatformFeePayment = Pick<
	OrganizationMembershipPaymentSchema,
	| 'amount'
	| 'refund_amount'
	| 'platform_fee'
	| 'platform_fee_net'
	| 'platform_fee_vat'
	| 'platform_fee_vat_rate'
	| 'platform_fee_reverse_charge'
>;

export interface PlatformFeeBreakdown {
	/** Gross platform fee actually taken (fee net + fee VAT). */
	feeGross: number;
	/**
	 * The FEE excluding VAT — i.e. the platform's own revenue on this charge.
	 * NOT what the organizer nets; that is {@link netToOrganizer}. Null when the
	 * backend recorded a fee without a VAT decomposition.
	 */
	feeExclVat: string | null;
	/** VAT charged on top of the fee. Null when undecomposed. */
	feeVat: string | null;
	/** VAT-rate snapshot as a percentage string, e.g. `"20.00"`. */
	feeVatRate: string | null;
	/** EU B2B cross-border: no VAT collected, the org self-assesses it. */
	reverseCharge: boolean;
	/**
	 * Gross `amount` minus the gross fee: what this charge is worth to the
	 * organizer, and what should reconcile against a Stripe payout line.
	 * BEFORE any refund — see {@link hasRefund}.
	 */
	netToOrganizer: number;
	/**
	 * A refund was recorded against this payment, so {@link netToOrganizer} is
	 * not the final figure. We deliberately do NOT subtract `refund_amount` from
	 * it: the backend leaves `platform_fee` untouched on refund (see
	 * `stripe_webhook_subscriptions._record_partial_refund` — "netting a partial
	 * refund out of an already-issued platform fee invoice needs a credit note,
	 * which is a separate decision"), and whether the fee is ever credited back
	 * is not derivable from these fields. Rather than display a number that
	 * might be wrong in either direction, the surfaces annotate the net as
	 * pre-refund and let the organizer reconcile the refund line separately.
	 */
	hasRefund: boolean;
}

/** Kills binary-float noise (e.g. `9.99 - 1.8`) without assuming 2 decimals — JPY has 0. */
function trimFloatNoise(value: number): number {
	return Math.round(value * 1e6) / 1e6;
}

/**
 * Decompose a staff-visible membership payment into gross / platform fee / net.
 *
 * @returns `null` when there is no fee worth showing, which suppresses the whole
 * block on the calling surface. That is the case when `platform_fee` is absent
 * (a row written before the backend added the field), unparseable, or zero —
 * the backend documents it as "0 for offline/failed payments", and offline rows
 * are the dominant row type on the ledger, so rendering a 0.00 breakdown on each
 * of them would be noise rather than information.
 *
 * Amounts arrive as decimal STRINGS, so every comparison is numeric.
 */
export function platformFeeBreakdown(payment: PlatformFeePayment): PlatformFeeBreakdown | null {
	const feeGross = Number(payment.platform_fee);
	if (!Number.isFinite(feeGross) || feeGross <= 0) return null;

	const amount = Number(payment.amount);
	if (!Number.isFinite(amount)) return null;

	const refunded = Number(payment.refund_amount);

	return {
		feeGross: trimFloatNoise(feeGross),
		feeExclVat: payment.platform_fee_net ?? null,
		feeVat: payment.platform_fee_vat ?? null,
		feeVatRate: payment.platform_fee_vat_rate ?? null,
		reverseCharge: payment.platform_fee_reverse_charge === true,
		netToOrganizer: trimFloatNoise(amount - feeGross),
		hasRefund: Number.isFinite(refunded) && refunded > 0
	};
}
