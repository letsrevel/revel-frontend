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
