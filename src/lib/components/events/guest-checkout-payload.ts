/**
 * Pure payload/fingerprint builders for the guest ticket checkout dialog.
 *
 * The fingerprint is the full purchase serialized — the key that decides
 * whether a resubmit may resume a held reservation or must reserve afresh.
 * `accessible_required` and the zone are part of it: toggling either must
 * re-hold from the right pool/zone instead of resuming the old reservation.
 *
 * The zone (`priceCategoryId`) is the buyer's pick on a MAPPED best-available
 * tier — mandatory there (single-zone included), and must stay absent on any
 * other tier (the backend rejects an uninvited zone). The email-confirm flow
 * carries it in the confirmation token for confirm-time assignment.
 *
 * No runes here — plain functions so this stays unit-testable.
 */
import * as m from '$lib/paraglide/messages.js';
import type {
	BuyerBillingInfoSchema,
	GuestBatchCheckoutPayload,
	GuestBatchCheckoutPwycPayload,
	TicketPurchaseItem
} from '$lib/api/generated/types.gen';

/**
 * Localized validation error for the per-ticket guest-name inputs, or '' when
 * every shown name is filled (single-ticket dialogs skip the inputs entirely).
 */
export function guestNamesError(guestNames: string[], showGuestNames: boolean): string {
	if (!showGuestNames) return '';
	const emptyIndex = guestNames.findIndex((name) => !name.trim());
	if (emptyIndex < 0) return '';
	return emptyIndex === 0
		? m['guestTicketDialog.pleaseEnterYourName']()
		: m['guestTicketDialog.pleaseEnterTicketHolderName']({ number: emptyIndex + 1 });
}

/** Next steps a guest can complete without an account (eligibility check). */
export const GUEST_COMPATIBLE_STEPS: ReadonlySet<string> = new Set([
	'purchase_ticket',
	'rsvp',
	'wait_for_event_to_open',
	'wait_for_open_spot'
]);

export interface GuestCheckoutArgs {
	email: string;
	/** Omitted (undefined) on events that don't require ticket names. */
	firstName: string | undefined;
	lastName: string | undefined;
	tickets: TicketPurchaseItem[];
	billingInfo: BuyerBillingInfoSchema | undefined;
	accessibleRequired: boolean;
	/** Zone on a mapped best-available tier; undefined everywhere else. */
	priceCategoryId: string | undefined;
	/** PWYC price per ticket; undefined for fixed-price tiers. */
	pricePerTicket: number | undefined;
}

export interface GuestTicketItemsArgs {
	/** One entry per ticket; the per-ticket inputs when they are shown. */
	guestNames: string[];
	/** Whether the per-ticket name inputs were shown (multi-ticket purchase). */
	namesShown: boolean;
	/** Event requires holder names; when false no guest_name is sent at all. */
	requireTicketNames: boolean;
	/** Purchaser's own name — the fallback for a hidden single-ticket input. */
	primaryName: string;
	heldSeatIds: string[];
	/** user_choice seating: attach the buyer's held seat ids positionally. */
	useHeldSeats: boolean;
}

/**
 * Per-ticket purchase items for the guest checkout. Key order matters: the
 * resume fingerprint is `JSON.stringify` of these, so guest_name must stay
 * before seat_id.
 */
export function guestTicketItems(args: GuestTicketItemsArgs): TicketPurchaseItem[] {
	return args.guestNames.map((name, index) => {
		const ticket: TicketPurchaseItem = {};
		if (args.requireTicketNames) {
			ticket.guest_name = (args.namesShown ? name : args.primaryName).trim();
		}
		// Seats only ride along in user_choice mode; every other mode sends an
		// explicit null — best_available seats are assigned server-side from the
		// buyer's live holds, never via seat_id.
		ticket.seat_id = args.useHeldSeats && args.heldSeatIds[index] ? args.heldSeatIds[index] : null;
		return ticket;
	});
}

export function guestCheckoutFingerprint(args: GuestCheckoutArgs): string {
	return JSON.stringify({
		email: args.email,
		first_name: args.firstName,
		last_name: args.lastName,
		tickets: args.tickets,
		billing_info: args.billingInfo,
		accessible_required: args.accessibleRequired,
		price_category_id: args.priceCategoryId,
		price_per_ticket: args.pricePerTicket
	});
}

export function guestCheckoutBody(args: GuestCheckoutArgs): GuestBatchCheckoutPayload {
	return {
		email: args.email,
		...(args.firstName ? { first_name: args.firstName } : {}),
		...(args.lastName ? { last_name: args.lastName } : {}),
		tickets: args.tickets,
		billing_info: args.billingInfo,
		accessible_required: args.accessibleRequired,
		...(args.priceCategoryId ? { price_category_id: args.priceCategoryId } : {})
	};
}

export function guestPwycCheckoutBody(args: GuestCheckoutArgs): GuestBatchCheckoutPwycPayload {
	return {
		...guestCheckoutBody(args),
		price_per_ticket: args.pricePerTicket ?? 0
	};
}
