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
 * refunds, FE #831). Bundles the plain-confirm cancel flow (offline /
 * at-the-door / free), the refund-aware cancel dialog for online tickets,
 * and the money-only refund dialog into one cohesive unit.
 *
 * Instantiate once at component init (it uses runes) and read/write via the
 * returned accessors. The dialogs stay in the page template, bound to this
 * state — same shape as `createTicketMemberAdmin`.
 */
export function createTicketCancelRefundAdmin(opts: Options) {
	// Plain confirm for offline/at-the-door/free tickets (behavior unchanged).
	let showCancelDialog = $state(false);
	let ticketToCancel = $state<AdminTicketSchema | null>(null);

	// Online tickets get the richer cancel dialog (optional refund alongside
	// the cancellation).
	let showOnlineCancelDialog = $state(false);
	let ticketToCancelOnline = $state<AdminTicketSchema | null>(null);

	// Refund payment dialog (money moves, ticket stays valid).
	let showRefundDialog = $state(false);
	let ticketToRefund = $state<AdminTicketSchema | null>(null);

	// The non-online cancel path: no body, fired from the generic ConfirmDialog.
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
		if (ticket.tier?.payment_method === 'online') {
			ticketToCancelOnline = ticket;
			showOnlineCancelDialog = true;
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

	function closeOnlineCancel() {
		showOnlineCancelDialog = false;
		ticketToCancelOnline = null;
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
		get showOnlineCancelDialog() {
			return showOnlineCancelDialog;
		},
		get ticketToCancelOnline() {
			return ticketToCancelOnline;
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
		closeOnlineCancel,
		openRefund,
		closeRefund
	};
}
