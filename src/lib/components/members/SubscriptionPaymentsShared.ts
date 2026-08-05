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
	SubscriptionPaymentMethod
} from '$lib/api/generated/types.gen';

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
	 * Amount handed back to the member, or `null` when this payment was never
	 * refunded. Rendered as its OWN deduction line, below the fee: the refund
	 * comes out of the organizer's share, because Revel's fee was taken at
	 * charge time and is never given back (see {@link netToOrganizer}).
	 */
	refundAmount: number | null;
	/**
	 * `refundAmount !== null`, named so the surfaces can gate the affirmative
	 * fee rule ("the platform fee is not reduced by refunds") on it — that
	 * sentence is only informative next to a refund, and would be noise on the
	 * overwhelming majority of rows that have none.
	 *
	 * This used to hedge, because it was unknown whether Revel credited the fee
	 * back on a refund and so no correct post-refund net could be derived. The
	 * backend has since answered on `MembershipPaymentSchema`: the fee is
	 * **never** reduced by a refund (nothing sets `refund_application_fee`,
	 * mirroring Stripe keeping its processing fee), and the `platform_fee*`
	 * figures always describe the original charge. The net below is therefore
	 * exact, not an estimate.
	 */
	hasRefund: boolean;
	/**
	 * What the organizer actually kept: `amount - platform_fee - refund_amount`.
	 *
	 * Revel takes the fee off the original charge and keeps it whatever happens
	 * afterwards, so a later refund is paid entirely out of the organizer's
	 * remainder. On a FULL refund this is exactly `-platform_fee`: the organizer
	 * gave the member back the whole gross and is out the fee. That negative is
	 * the truth of the row, so it is rendered rather than clamped — the surfaces
	 * pair the minus sign with an explicit sentence so it cannot read as a
	 * rendering glitch.
	 *
	 * With no refund this is simply gross minus fee, which is what should
	 * reconcile against a Stripe payout line.
	 */
	netToOrganizer: number;
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
 * A refunded row with NO fee is suppressed too, and deliberately keeps no net
 * line: with nothing taken off the top, the organizer's net is just
 * `amount - refund_amount`, and both of those figures are already on the row
 * (the gross, and the refund annotation next to it). The net line exists to
 * explain a third party's cut; where there is none, there is nothing to explain,
 * and the affirmative fee rule would be meaningless without a fee.
 *
 * Amounts arrive as decimal STRINGS, so every comparison is numeric.
 */
export function platformFeeBreakdown(payment: PlatformFeePayment): PlatformFeeBreakdown | null {
	const feeGross = Number(payment.platform_fee);
	if (!Number.isFinite(feeGross) || feeGross <= 0) return null;

	const amount = Number(payment.amount);
	if (!Number.isFinite(amount)) return null;

	const parsedRefund = Number(payment.refund_amount);
	// An unparseable `refund_amount` is treated as no refund rather than as a
	// zero-value one: guessing would put a bogus deduction line on a money surface.
	const refundAmount =
		Number.isFinite(parsedRefund) && parsedRefund > 0 ? trimFloatNoise(parsedRefund) : null;

	return {
		feeGross: trimFloatNoise(feeGross),
		feeExclVat: payment.platform_fee_net ?? null,
		feeVat: payment.platform_fee_vat ?? null,
		feeVatRate: payment.platform_fee_vat_rate ?? null,
		reverseCharge: payment.platform_fee_reverse_charge === true,
		refundAmount,
		hasRefund: refundAmount !== null,
		// One trim at the end: the two subtractions each leak ~1e-16, well inside
		// the 1e-6 the rounding absorbs (10.00 - 1.80 - 4.00 → 4.199999999999999).
		netToOrganizer: trimFloatNoise(amount - feeGross - (refundAmount ?? 0))
	};
}

/** Typed so a rename of the backend enum breaks here rather than silently. */
const OFFLINE: SubscriptionPaymentMethod = 'offline';

/**
 * Whether the org-wide ledger may offer an in-place refund on this row.
 *
 * Mirrors the backend guard on `POST /organization-admin/{slug}/payments/{id}/refund`
 * exactly: it refuses ONLINE payments with a 400 ("must be refunded from the
 * Stripe Dashboard; the refund is recorded here automatically"), because that
 * endpoint never moves money — accepting one would flip the ledger to REFUNDED
 * while the member's charge stayed captured on Stripe. And only a SUCCEEDED
 * payment has anything to give back. So the control is never rendered where the
 * API would reject it.
 *
 * `payment_method` is the plan's, resolved per row by the backend — the same
 * field the guard reads — which is what lets the org-wide ledger make this call
 * per row. The per-subscription drawer has one plan for the whole table and
 * gates on that instead (`PaymentsTable`'s `isOnlinePlan`).
 */
export function canRefundLedgerPayment(
	payment: Pick<OrganizationMembershipPaymentSchema, 'status' | 'payment_method'>
): boolean {
	return payment.status === 'succeeded' && payment.payment_method === OFFLINE;
}
