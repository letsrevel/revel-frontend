import { createMutation, type QueryClient } from '@tanstack/svelte-query';
import {
	eventpublicticketsTicketCheckout,
	eventpublicticketsTicketPwycCheckout,
	eventpublicattendanceGetMyEventStatus,
	eventpublicdiscoveryResumeCheckout,
	eventpublicdiscoveryCancelCheckout
} from '$lib/api';
import type {
	BatchCheckoutPayload,
	BatchCheckoutPwycPayload,
	BatchCheckoutResponse,
	TicketPurchaseItem,
	BuyerBillingInfoSchema
} from '$lib/api/generated/types.gen';
import type { EventTicketSchemaActual, UserEventStatus } from '$lib/utils/eligibility';
import * as m from '$lib/paraglide/messages.js';
import { toast } from 'svelte-sonner';

/**
 * Read the (undeclared) runtime `detail` field some backend error payloads carry.
 * Returns the detail when it is a non-empty string, otherwise the fallback.
 */
function errorDetailOr(error: unknown, fallback: string): string {
	if (typeof error === 'object' && error !== null && 'detail' in error) {
		const { detail } = error;
		if (typeof detail === 'string' && detail) return detail;
	}
	return fallback;
}

// Type for checkout parameters
interface CheckoutParams {
	tierId: string;
	tickets: TicketPurchaseItem[];
	discountCode?: string;
	billingInfo?: BuyerBillingInfoSchema;
}

interface PwycCheckoutParams extends CheckoutParams {
	pricePerTicket: number;
}

/** Dependencies the checkout controller needs from the host component. */
export interface CheckoutControllerDeps {
	/** The event id used for all checkout/status calls. */
	eventId: string;
	queryClient: QueryClient;
	/** Current user's tickets (used to locate a pending payment to resume). */
	getUserTickets: () => EventTicketSchemaActual[];
	/** Logged-in user's display name (fallback for guest_name). */
	getUserDisplayName: () => string;
	/** Push a refreshed user status into the host component state. */
	setUserStatus: (status: UserEventStatus) => void;
	/** Close the ticket-tier selection modal. */
	onCloseTicketTierModal: () => void;
	/** Show / hide the "my ticket" modal. */
	setShowMyTicketModal: (open: boolean) => void;
}

/**
 * Rune-based checkout controller for the public event page.
 *
 * Owns the ticket purchase / resume / cancel mutations and their success/error
 * side effects, keeping the page component focused on layout and local state.
 * Must be invoked during component initialization (it calls `createMutation`).
 */
export function createCheckoutController(deps: CheckoutControllerDeps) {
	const {
		eventId,
		queryClient,
		getUserTickets,
		getUserDisplayName,
		setUserStatus,
		onCloseTicketTierModal,
		setShowMyTicketModal
	} = deps;

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

	/**
	 * Handle successful batch checkout response
	 */
	async function handleCheckoutSuccess(response: BatchCheckoutResponse) {
		if (!response) return;

		// Check if we got tickets directly (free/offline payment)
		if (response.tickets && response.tickets.length > 0) {
			// Close the tier modal
			onCloseTicketTierModal();

			// Refresh user status to get updated tickets - this updates local state
			await refreshUserStatus();

			// Also invalidate TanStack Query cache for other components
			queryClient.invalidateQueries({ queryKey: ['event-status', eventId] });

			// Show success toast
			const ticketCount = response.tickets.length;
			const firstTicket = response.tickets[0];
			const isPending = firstTicket?.status === 'pending';

			if (isPending) {
				// Offline payment - ticket reserved but not yet paid
				toast.success(
					m['eventPage.ticketReserved']?.({ count: ticketCount }) ??
						`${ticketCount} ticket${ticketCount > 1 ? 's' : ''} reserved! Complete payment as instructed.`,
					{
						description:
							m['eventPage.ticketReservedDesc']?.() ?? 'View your ticket for payment details.',
						duration: 5000
					}
				);
			} else {
				// Free ticket claimed
				toast.success(
					m['eventPage.ticketClaimed']?.({ count: ticketCount }) ??
						`${ticketCount} ticket${ticketCount > 1 ? 's' : ''} claimed!`,
					{
						description: m['eventPage.ticketClaimedDesc']?.() ?? 'Your ticket is ready.',
						duration: 4000
					}
				);
			}

			// Open ticket modal after a short delay to show the new ticket
			setTimeout(() => {
				setShowMyTicketModal(true);
			}, 500);
		}
		// Check if we got a checkout URL (redirect to Stripe)
		else if (response.checkout_url) {
			window.location.href = response.checkout_url;
		}
	}

	// Ticket claiming mutation (for free/offline tickets) - batch version
	const claimTicketMutation = createMutation(() => ({
		mutationFn: async ({ tierId, tickets, discountCode, billingInfo }: CheckoutParams) => {
			const body: BatchCheckoutPayload = {
				tickets,
				discount_code: discountCode || undefined,
				billing_info: billingInfo || undefined
			};
			const response = await eventpublicticketsTicketCheckout({
				path: { event_id: eventId, tier_id: tierId },
				body
			});
			if (response.error) {
				throw new Error(errorDetailOr(response.error, 'Failed to claim ticket'));
			}
			return response.data;
		},
		onSuccess: handleCheckoutSuccess
	}));

	// Fixed-price checkout mutation (for online payments) - batch version
	const checkoutMutation = createMutation(() => ({
		mutationFn: async ({ tierId, tickets, discountCode, billingInfo }: CheckoutParams) => {
			const body: BatchCheckoutPayload = {
				tickets,
				discount_code: discountCode || undefined,
				billing_info: billingInfo || undefined
			};
			const response = await eventpublicticketsTicketCheckout({
				path: { event_id: eventId, tier_id: tierId },
				body
			});
			if (response.error) {
				throw new Error(errorDetailOr(response.error, 'Failed to checkout'));
			}
			return response.data;
		},
		onSuccess: handleCheckoutSuccess
	}));

	// PWYC checkout mutation - batch version
	const pwycCheckoutMutation = createMutation(() => ({
		mutationFn: async ({ tierId, tickets, pricePerTicket, billingInfo }: PwycCheckoutParams) => {
			const body: BatchCheckoutPwycPayload = {
				tickets,
				price_per_ticket: pricePerTicket,
				billing_info: billingInfo || undefined
			};
			const response = await eventpublicticketsTicketPwycCheckout({
				path: { event_id: eventId, tier_id: tierId },
				body
			});
			if (response.error) {
				throw new Error(errorDetailOr(response.error, 'Failed to checkout'));
			}
			return response.data;
		},
		onSuccess: handleCheckoutSuccess
	}));

	/**
	 * Get default guest name for single ticket purchase
	 * Uses logged-in user's display name when available, falling back to a
	 * localized placeholder so guest_name is never empty (backend min_length 1).
	 */
	function getDefaultGuestName(): string {
		return getUserDisplayName().trim() || m['ticketConfirmationDialog.defaultGuestName']();
	}

	/**
	 * Handle claiming free/offline tickets
	 * @param tierId - Tier ID to purchase from
	 * @param tickets - Optional tickets array (defaults to single ticket with empty guest name)
	 * @param discountCode - Optional discount code
	 */
	async function handleClaimTicket(
		tierId: string,
		tickets?: TicketPurchaseItem[],
		discountCode?: string,
		billingInfo?: BuyerBillingInfoSchema
	) {
		const ticketItems = tickets || [{ guest_name: getDefaultGuestName() }];
		await claimTicketMutation.mutateAsync({
			tierId,
			tickets: ticketItems,
			discountCode,
			billingInfo
		});
	}

	/**
	 * Handle paid ticket checkout
	 * @param tierId - Tier ID to purchase from
	 * @param isPwyc - Whether this is a PWYC tier
	 * @param amount - Price per ticket for PWYC tiers
	 * @param tickets - Optional tickets array (defaults to single ticket with empty guest name)
	 * @param discountCode - Optional discount code
	 * @param billingInfo - Optional billing info for invoicing
	 */
	async function handleCheckout(
		tierId: string,
		isPwyc: boolean,
		amount?: number,
		tickets?: TicketPurchaseItem[],
		discountCode?: string,
		billingInfo?: BuyerBillingInfoSchema
	) {
		const ticketItems = tickets || [{ guest_name: getDefaultGuestName() }];

		if (isPwyc && amount !== undefined) {
			// PWYC checkout with amount from confirmation dialog
			await pwycCheckoutMutation.mutateAsync({
				tierId,
				tickets: ticketItems,
				pricePerTicket: amount,
				billingInfo
			});
		} else {
			// Direct checkout for fixed-price tiers
			await checkoutMutation.mutateAsync({
				tierId,
				tickets: ticketItems,
				discountCode,
				billingInfo
			});
		}
	}

	// Resume payment mutation (for pending tickets with online payment)
	const resumePaymentMutation = createMutation(() => ({
		mutationFn: async (paymentId: string) => {
			const response = await eventpublicdiscoveryResumeCheckout({
				path: { payment_id: paymentId }
			});

			if (response.error) {
				throw new Error(errorDetailOr(response.error, 'Failed to resume checkout'));
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
			toast.error(m['eventPage.resumePaymentFailed']?.() ?? 'Could not resume payment', {
				description:
					error.message ||
					(m['eventPage.resumePaymentFailedDesc']?.() ??
						'The checkout session may have expired. Please try purchasing again.'),
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
				throw new Error(errorDetailOr(response.error, 'Failed to cancel reservation'));
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

			toast.success(m['eventPage.reservationCancelled']?.() ?? 'Reservation cancelled', {
				description:
					m['eventPage.reservationCancelledDesc']?.() ??
					'Your ticket reservation has been cancelled.',
				duration: 4000
			});
		},
		onError: async (error) => {
			await refreshUserStatus();
			toast.error(m['eventPage.cancelReservationFailed']?.() ?? 'Could not cancel reservation', {
				description:
					error.message ||
					(m['eventPage.cancelReservationFailedDesc']?.() ??
						'Please try again or contact support.'),
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
		handleClaimTicket,
		handleCheckout,
		handleResumePayment,
		handleResumePaymentFromSidebar,
		handleCancelReservation
	};
}
