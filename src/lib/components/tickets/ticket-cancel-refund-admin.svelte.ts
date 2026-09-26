import * as m from '$lib/paraglide/messages.js';
import { createMutation } from '@tanstack/svelte-query';
import { invalidateAll } from '$app/navigation';
import { eventadminticketsCancelTicket } from '$lib/api';
import type { AdminTicketSchema } from '$lib/api/generated/types.gen';

interface Options {
	/** Event id for the event-admin ticket endpoints. */
	getEventId: () => string;
	/** Bearer access token, or nullish when unauthenticated. */
	getAccessToken: () => string | null | undefined;
}

/**
 * Cancel + refund admin actions for the event tickets list (organizer
 * refunds, FE #831). Bundles the plain-confirm cancel flow (free tickets),
 * the refund-aware cancel dialog for every paid method (online refunds via
 * Stripe; offline / at-the-door refunds are recorded, FE #960), and the
 * money-only refund dialog into one cohesive unit.
 *
 * Instantiate once at component init (it uses runes) and read/write via the
 * returned accessors. The dialogs stay in the page template, bound to this
 * state — same shape as `createTicketMemberAdmin`.
 */
export function createTicketCancelRefundAdmin(opts: Options) {
	// Plain confirm for free tickets: nothing was paid, so nothing to refund.
	let showCancelDialog = $state(false);
	let ticketToCancel = $state<AdminTicketSchema | null>(null);

	// Paid tickets get the richer cancel dialog (optional refund alongside the
	// cancellation). It asks the refund context what is refundable, so an
	// unpaid offline reservation simply shows no refund section.
	let showRefundCancelDialog = $state(false);
	let ticketToCancelWithRefund = $state<AdminTicketSchema | null>(null);

	// Refund payment dialog (money moves, ticket stays valid).
	let showRefundDialog = $state(false);
	let ticketToRefund = $state<AdminTicketSchema | null>(null);

	// The free-ticket cancel path: no body, fired from the generic ConfirmDialog.
	const cancelTicketMutation = createMutation(() => ({
		mutationFn: async (ticketId: string) => {
			// Never send a literal "Bearer null" during the auth bootstrap window.
			const accessToken = opts.getAccessToken();
			if (!accessToken) {
				throw new Error(m['adminCancelTicket.errorGeneric']());
			}
			const response = await eventadminticketsCancelTicket({
				path: { event_id: opts.getEventId(), ticket_id: ticketId },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error(m['adminCancelTicket.errorGeneric']());
			}

			return response.data;
		},
		onSuccess: () => {
			showCancelDialog = false;
			ticketToCancel = null;
			invalidateAll();
		}
	}));

	/** Route a cancel request by payment method. */
	function openCancel(ticket: AdminTicketSchema) {
		if (ticket.tier?.payment_method !== 'free') {
			ticketToCancelWithRefund = ticket;
			showRefundCancelDialog = true;
			return;
		}
		ticketToCancel = ticket;
		showCancelDialog = true;
	}

	function submitCancel() {
		if (ticketToCancel?.id) {
			cancelTicketMutation.mutate(ticketToCancel.id);
		}
	}

	function closeCancel() {
		showCancelDialog = false;
		ticketToCancel = null;
	}

	function closeRefundCancel() {
		showRefundCancelDialog = false;
		ticketToCancelWithRefund = null;
	}

	function openRefund(ticket: AdminTicketSchema) {
		ticketToRefund = ticket;
		showRefundDialog = true;
	}

	function closeRefund() {
		showRefundDialog = false;
		ticketToRefund = null;
	}

	return {
		get showCancelDialog() {
			return showCancelDialog;
		},
		get ticketToCancel() {
			return ticketToCancel;
		},
		get showRefundCancelDialog() {
			return showRefundCancelDialog;
		},
		get ticketToCancelWithRefund() {
			return ticketToCancelWithRefund;
		},
		get showRefundDialog() {
			return showRefundDialog;
		},
		get ticketToRefund() {
			return ticketToRefund;
		},
		get cancelTicketPending() {
			return cancelTicketMutation.isPending;
		},
		openCancel,
		submitCancel,
		closeCancel,
		closeRefundCancel,
		openRefund,
		closeRefund
	};
}
