import { createMutation, type QueryClient } from '@tanstack/svelte-query';
import {
	eventpublicattendanceGetMyEventStatus,
	eventpublicdiscoveryResumeCheckout,
	eventpublicdiscoveryCancelCheckout
} from '$lib/api';
import type { EventTicketSchemaActual, UserEventStatus } from '$lib/utils/eligibility';
import * as m from '$lib/paraglide/messages.js';
import { toast } from 'svelte-sonner';
import { checkoutError } from './checkout-error';

/** Dependencies the checkout controller needs from the host component. */
export interface CheckoutControllerDeps {
	/** The event id used for all checkout/status calls. */
	eventId: string;
	queryClient: QueryClient;
	/** Current user's tickets (used to locate a pending payment to resume). */
	getUserTickets: () => EventTicketSchemaActual[];
	/** Push a refreshed user status into the host component state. */
	setUserStatus: (status: UserEventStatus) => void;
	/** Show / hide the "my ticket" modal. */
	setShowMyTicketModal: (open: boolean) => void;
}

/**
 * Rune-based checkout controller for the public event page.
 *
 * Owns the pending-ticket resume/cancel mutations and their success/error side
 * effects (the actual purchase path is the cart — see
 * `cart-checkout-controller.svelte.ts`), keeping the page component focused on
 * layout and local state. Must be invoked during component initialization (it
 * calls `createMutation`).
 */
export function createCheckoutController(deps: CheckoutControllerDeps) {
	const { eventId, queryClient, getUserTickets, setUserStatus, setShowMyTicketModal } = deps;

	/**
	 * Refresh user status from the API
	 */
	async function refreshUserStatus() {
		try {
			const response = await eventpublicattendanceGetMyEventStatus({
				path: { event_id: eventId }
			});
			if (response.data) {
				setUserStatus(response.data);
			}
		} catch (err) {
			console.error('Failed to refresh user status:', err);
		}
	}

	// Resume payment mutation (for pending tickets with online payment)
	const resumePaymentMutation = createMutation(() => ({
		mutationFn: async (paymentId: string) => {
			const response = await eventpublicdiscoveryResumeCheckout({
				path: { payment_id: paymentId }
			});

			if (response.error) {
				throw checkoutError(response.error, 'Failed to resume checkout');
			}
			return response.data;
		},
		onSuccess: (data) => {
			// The resume endpoint returns a checkout_url - redirect to Stripe
			if (data?.checkout_url) {
				window.location.href = data.checkout_url;
			}
		},
		onError: async (error) => {
			// If session expired (404), refresh user status - tickets may have been cleaned up
			await refreshUserStatus();
			toast.error(m['eventPage.resumePaymentFailed'](), {
				description: error.message || m['eventPage.resumePaymentFailedDesc'](),
				duration: 5000
			});
		}
	}));

	// Cancel reservation mutation (for pending tickets with online payment)
	const cancelReservationMutation = createMutation(() => ({
		mutationFn: async (paymentId: string) => {
			const response = await eventpublicdiscoveryCancelCheckout({
				path: { payment_id: paymentId }
			});

			if (response.error) {
				throw checkoutError(response.error, 'Failed to cancel reservation');
			}
			return response.data;
		},
		onSuccess: async () => {
			// Close the modal
			setShowMyTicketModal(false);

			// Refresh user status to update tickets list
			await refreshUserStatus();

			// Invalidate cache
			queryClient.invalidateQueries({ queryKey: ['event-status', eventId] });

			toast.success(m['eventPage.reservationCancelled'](), {
				description: m['eventPage.reservationCancelledDesc'](),
				duration: 4000
			});
		},
		onError: async (error) => {
			await refreshUserStatus();
			toast.error(m['eventPage.cancelReservationFailed'](), {
				description: error.message || m['eventPage.cancelReservationFailedDesc'](),
				duration: 5000
			});
		}
	}));

	function handleResumePayment(paymentId: string) {
		resumePaymentMutation.mutate(paymentId);
	}

	/**
	 * Wrapper for EventActionSidebar that finds the first pending ticket's payment ID
	 * The sidebar doesn't know which ticket to resume, so we find it for them
	 */
	function handleResumePaymentFromSidebar() {
		const pendingTicket = getUserTickets().find((t) => t.status === 'pending' && t.payment?.id);
		if (pendingTicket?.payment?.id) {
			handleResumePayment(pendingTicket.payment.id);
		}
	}

	function handleCancelReservation(paymentId: string) {
		cancelReservationMutation.mutate(paymentId);
	}

	return {
		refreshUserStatus,
		resumePaymentMutation,
		cancelReservationMutation,
		handleResumePayment,
		handleResumePaymentFromSidebar,
		handleCancelReservation
	};
}
