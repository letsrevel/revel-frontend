/**
 * Pure builder for the per-ticket purchase items of the logged-in checkout.
 *
 * When the event requires holder names, every item carries a non-empty
 * guest_name (falling back to the buyer's default for the hidden
 * single-ticket input). When it doesn't, guest_name is omitted entirely so
 * the backend records a nameless ticket and the "rename later" path stays
 * unambiguous. No runes — plain function so this stays unit-testable.
 */
import type { TicketPurchaseItem } from '$lib/api/generated/types.gen';
import * as m from '$lib/paraglide/messages.js';

/**
 * Holder name for a ticket whose name input was never shown (single-ticket
 * purchase, or a non-dialog claim). The buyer's profile name, falling back to
 * a localized placeholder so guest_name is never empty when the event requires
 * one (backend min_length 1). Shared by the dialog and the checkout controller.
 */
export function defaultGuestName(userName: string): string {
	return userName.trim() || m['ticketConfirmationDialog.defaultGuestName']();
}

export interface PurchaseItemsOptions {
	guestNames: string[];
	requireTicketNames: boolean;
	/** Whether the name inputs were shown (multi-ticket purchase). */
	namesShown: boolean;
	/** Buyer's display-name fallback for a hidden single-ticket input. */
	defaultName: string;
	heldSeatIds: string[];
	/** user_choice seating: attach the held seat ids positionally. */
	useHeldSeats: boolean;
}

/**
 * The single-ticket fallback shape used when a purchase path has no per-ticket
 * items of its own. It MUST stay identical across every call site: the
 * reservation-resume fingerprint is `JSON.stringify` of the mutation params, so
 * a divergent default would silently stop identical retries from resuming.
 */
export function defaultPurchaseItems(
	requireTicketNames: boolean,
	userName: string
): TicketPurchaseItem[] {
	return requireTicketNames ? [{ guest_name: defaultGuestName(userName) }] : [{}];
}

export function buildPurchaseTicketItems(opts: PurchaseItemsOptions): TicketPurchaseItem[] {
	return opts.guestNames.map((name, index) => {
		const ticket: TicketPurchaseItem = {};
		if (opts.requireTicketNames) {
			ticket.guest_name = name.trim() || (!opts.namesShown ? opts.defaultName : '');
		}
		if (opts.useHeldSeats && opts.heldSeatIds[index]) {
			ticket.seat_id = opts.heldSeatIds[index];
		}
		return ticket;
	});
}
