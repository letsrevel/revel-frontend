import * as m from '$lib/paraglide/messages.js';
import type { QueryClient } from '@tanstack/svelte-query';
import { invalidateAfterMemberWrite } from '$lib/member-register/member-access';
import type {
	MembershipPaymentEditRefusalCode,
	MembershipPaymentSchema,
	MembershipPaymentStatus
} from '$lib/api/generated/types.gen';
import { backendMessage } from '$lib/utils/api-error-detail';
import { formatDate } from '$lib/utils/date';
import { formatMoney } from '$lib/utils/format';

/**
 * The slice of a payment row the edit/void flows read. Both the drawer's
 * `MembershipPaymentSchema` and the org-wide ledger's
 * `OrganizationMembershipPaymentSchema` satisfy it structurally, so one dialog
 * serves both surfaces.
 */
export type EditablePayment = Pick<
	MembershipPaymentSchema,
	| 'id'
	| 'amount'
	| 'currency'
	| 'status'
	| 'occurred_at'
	| 'created_at'
	| 'notes'
	| 'can_edit'
	| 'can_void'
>;

/**
 * The only statuses an edit may set (the backend refuses refunded/voided here:
 * those have their own routes). One source for the edit dialog, the record
 * form and the status select.
 */
export const EDITABLE_STATUSES = ['succeeded', 'pending', 'failed'] as const;
export type EditableStatus = (typeof EDITABLE_STATUSES)[number];

export function isEditableStatus(status: MembershipPaymentStatus): status is EditableStatus {
	return (EDITABLE_STATUSES as readonly string[]).includes(status);
}

/** Subscription statuses the backend treats as terminal (status/date edits refused). */
export function isTerminalSubscriptionStatus(status: string | null | undefined): boolean {
	return status === 'cancelled' || status === 'expired';
}

const REFUSAL_MESSAGES: Record<MembershipPaymentEditRefusalCode, () => string> = {
	payment_online: () => m['orgAdmin.members.subscriptions.paymentRefused.payment_online'](),
	payment_refunded: () => m['orgAdmin.members.subscriptions.paymentRefused.payment_refunded'](),
	payment_voided: () => m['orgAdmin.members.subscriptions.paymentRefused.payment_voided'](),
	payment_not_latest: () => m['orgAdmin.members.subscriptions.paymentRefused.payment_not_latest'](),
	subscription_terminal: () =>
		m['orgAdmin.members.subscriptions.paymentRefused.subscription_terminal']()
};

/** One source of truth: every code with a message is recognised. */
const REFUSAL_CODES = Object.keys(REFUSAL_MESSAGES) as MembershipPaymentEditRefusalCode[];

/**
 * Reads the machine-readable `code` off a 409 body. Branching on `code`, never on
 * the translated `detail` text. Returns null for any other error shape.
 */
export function paymentRefusalCode(error: unknown): MembershipPaymentEditRefusalCode | null {
	if (typeof error !== 'object' || error === null || !('code' in error)) return null;
	const code = (error as { code: unknown }).code;
	return REFUSAL_CODES.find((c) => c === code) ?? null;
}

/** A 409 from the edit/void endpoints: the row is not (or no longer) eligible. */
export class PaymentRefusedError extends Error {
	readonly code: MembershipPaymentEditRefusalCode;
	constructor(code: MembershipPaymentEditRefusalCode) {
		super(REFUSAL_MESSAGES[code]());
		this.name = 'PaymentRefusedError';
		this.code = code;
	}
}

/** Turns a failed edit/void response body into the Error the mutation should throw. */
export function toPaymentError(error: unknown, fallback: string): Error {
	const code = paymentRefusalCode(error);
	if (code) return new PaymentRefusedError(code);
	return new Error(backendMessage(error) || fallback);
}

/**
 * Everything an edit or void can move: the payment lists (drawer + org-wide) and
 * the subscription itself (period and status are recomputed), plus everything a
 * member write refreshes (`invalidateAfterMemberWrite`: members list, member
 * register, the person sheet's access row, subscriptions list and metrics),
 * because a recomputed period can change a member's status.
 */
export function invalidatePaymentCaches(queryClient: QueryClient, slug: string): void {
	for (const key of ['subscription-payments', 'subscription']) {
		queryClient.invalidateQueries({ queryKey: ['organization', slug, key] });
	}
	void invalidateAfterMemberWrite(queryClient, slug);
}

/** "10.00 EUR from Aug 1, 2026": the context screen readers need to tell rows apart. */
export function paymentContext(p: EditablePayment): { amount: string; date: string } {
	return {
		amount: formatMoney(p.amount, p.currency),
		date: formatDate(p.occurred_at ?? p.created_at)
	};
}
