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
import { seatingBodyFields, type SeatingCheckoutFields } from '$lib/types/tickets';
import type { EventTicketSchemaActual, UserEventStatus } from '$lib/utils/eligibility';
import {
	createReservationRetry,
	resolveCheckoutUrl,
	CheckoutSessionError
} from '$lib/utils/checkout-session';
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
	/** Best-available seating fields (zone + accessible opt-in), when seated. */
	seating?: SeatingCheckoutFields;
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

	// Held reservation from a session step that is pending or failed — an
	// identical retry (same fingerprint) replays only the idempotent session
	// call instead of re-reserving, which would strand the first reservation
	// and can trip max_tickets_per_user (PENDING tickets count toward it).
	const reservationRetry = createReservationRetry('user');

	function sessionFailureError(error: CheckoutSessionError): Error {
		return new Error(m['eventPage.paymentStartFailed'](), { cause: error });
	}

	/**
	 * Resume a previously reserved purchase whose session step didn't complete
	 * (retryable failure, or the buyer came back from Stripe and bought again
	 * with identical parameters). Returns a redirect-ready response, or `null`
	 * when there is nothing to resume and the caller should reserve afresh.
	 */
	async function resumeHeldCheckout(fingerprint: string): Promise<BatchCheckoutResponse | null> {
		try {
			const checkoutUrl = await reservationRetry.resume(fingerprint);
			return checkoutUrl
				? { checkout_url: checkoutUrl, tickets: [], requires_payment: true }
				: null;
		} catch (error) {
			if (error instanceof CheckoutSessionError) {
				throw sessionFailureError(error);
			}
			throw error;
		}
	}

	/**
	 * Two-step online checkout (#464): the checkout endpoints only RESERVE
	 * (returning `reservation_id`); the Stripe URL comes from a second,
	 * idempotent checkout-session call. Chain it here, inside the mutation, so
	 * the pending/disabled state spans both requests, and merge the URL back
	 * into the response so the success handler stays payment-agnostic.
	 *
	 * If the session step fails the reservation is still held server-side:
	 * the handle is kept so an identical retry resumes it, the user status is
	 * refreshed so the pending ticket's "Resume Payment" action (which also
	 * recreates the session) appears, and a retryable error is surfaced.
	 */
	async function withCheckoutSessionUrl(
		data: BatchCheckoutResponse,
		fingerprint: string
	): Promise<BatchCheckoutResponse> {
		if (data.requires_payment && data.reservation_id) {
			reservationRetry.remember(data.reservation_id, fingerprint);
		}
		try {
			const checkoutUrl = await resolveCheckoutUrl(data, 'user');
			return checkoutUrl ? { ...data, checkout_url: checkoutUrl } : data;
		} catch (error) {
			if (error instanceof CheckoutSessionError) {
				if (error.expired) {
					reservationRetry.clear();
				}
				await refreshUserStatus();
				queryClient.invalidateQueries({ queryKey: ['event-status', eventId] });
				throw sessionFailureError(error);
			}
			throw error;
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
				toast.success(m['eventPage.ticketReserved']({ count: ticketCount }), {
					description: m['eventPage.ticketReservedDesc'](),
					duration: 5000
				});
			} else {
				// Free ticket claimed
				toast.success(m['eventPage.ticketClaimed']({ count: ticketCount }), {
					description: m['eventPage.ticketClaimedDesc'](),
					duration: 4000
				});
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
		mutationFn: async (params: CheckoutParams) => {
			const fingerprint = JSON.stringify(params);
			const resumed = await resumeHeldCheckout(fingerprint);
			if (resumed) return resumed;
			const { tierId, tickets, discountCode, billingInfo, seating } = params;
			const body: BatchCheckoutPayload = {
				tickets,
				discount_code: discountCode || undefined,
				billing_info: billingInfo || undefined,
				...seatingBodyFields(seating)
			};
			const response = await eventpublicticketsTicketCheckout({
				path: { event_id: eventId, tier_id: tierId },
				body
			});
			if (response.error) {
				throw new Error(errorDetailOr(response.error, 'Failed to claim ticket'));
			}
			return withCheckoutSessionUrl(response.data, fingerprint);
		},
		onSuccess: handleCheckoutSuccess
	}));

	// Fixed-price checkout mutation (for online payments) - batch version
	const checkoutMutation = createMutation(() => ({
		mutationFn: async (params: CheckoutParams) => {
			const fingerprint = JSON.stringify(params);
			const resumed = await resumeHeldCheckout(fingerprint);
			if (resumed) return resumed;
			const { tierId, tickets, discountCode, billingInfo, seating } = params;
			const body: BatchCheckoutPayload = {
				tickets,
				discount_code: discountCode || undefined,
				billing_info: billingInfo || undefined,
				...seatingBodyFields(seating)
			};
			const response = await eventpublicticketsTicketCheckout({
				path: { event_id: eventId, tier_id: tierId },
				body
			});
			if (response.error) {
				throw new Error(errorDetailOr(response.error, 'Failed to checkout'));
			}
			return withCheckoutSessionUrl(response.data, fingerprint);
		},
		onSuccess: handleCheckoutSuccess
	}));

	// PWYC checkout mutation - batch version
	const pwycCheckoutMutation = createMutation(() => ({
		mutationFn: async (params: PwycCheckoutParams) => {
			const fingerprint = JSON.stringify(params);
			const resumed = await resumeHeldCheckout(fingerprint);
			if (resumed) return resumed;
			const { tierId, tickets, pricePerTicket, billingInfo, seating } = params;
			const body: BatchCheckoutPwycPayload = {
				tickets,
				price_per_ticket: pricePerTicket,
				billing_info: billingInfo || undefined,
				...seatingBodyFields(seating)
			};
			const response = await eventpublicticketsTicketPwycCheckout({
				path: { event_id: eventId, tier_id: tierId },
				body
			});
			if (response.error) {
				throw new Error(errorDetailOr(response.error, 'Failed to checkout'));
			}
			return withCheckoutSessionUrl(response.data, fingerprint);
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
		billingInfo?: BuyerBillingInfoSchema,
		seating?: SeatingCheckoutFields
	) {
		const ticketItems = tickets || [{ guest_name: getDefaultGuestName() }];
		await claimTicketMutation.mutateAsync({
			tierId,
			tickets: ticketItems,
			discountCode,
			billingInfo,
			seating
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
		billingInfo?: BuyerBillingInfoSchema,
		seating?: SeatingCheckoutFields
	) {
		const ticketItems = tickets || [{ guest_name: getDefaultGuestName() }];

		if (isPwyc && amount !== undefined) {
			// PWYC checkout with amount from confirmation dialog
			await pwycCheckoutMutation.mutateAsync({
				tierId,
				tickets: ticketItems,
				pricePerTicket: amount,
				billingInfo,
				seating
			});
		} else {
			// Direct checkout for fixed-price tiers
			await checkoutMutation.mutateAsync({
				tierId,
				tickets: ticketItems,
				discountCode,
				billingInfo,
				seating
			});
		}
	}

	/**
	 * Peek: would `handleClaimTicket`/`handleCheckout` with these arguments
	 * resume the held reservation instead of reserving afresh? Pure — no
	 * network call, and the handle is left untouched.
	 *
	 * Used by the confirmation dialog to skip re-holding a best-available seat
	 * block on an identical retry: the resumed reservation already consumed its
	 * holds at reserve time, so holding a fresh block would only orphan it.
	 * MUST build the params exactly like the mutations above do (same shapes,
	 * same key order) — the fingerprint is JSON.stringify of the params object.
	 */
	function hasResumableCheckout(
		tierId: string,
		isPwyc: boolean,
		amount?: number,
		tickets?: TicketPurchaseItem[],
		discountCode?: string,
		billingInfo?: BuyerBillingInfoSchema,
		seating?: SeatingCheckoutFields
	): boolean {
		const ticketItems = tickets || [{ guest_name: getDefaultGuestName() }];
		const params =
			isPwyc && amount !== undefined
				? { tierId, tickets: ticketItems, pricePerTicket: amount, billingInfo, seating }
				: { tierId, tickets: ticketItems, discountCode, billingInfo, seating };
		return reservationRetry.wouldResume(JSON.stringify(params));
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
		handleClaimTicket,
		handleCheckout,
		hasResumableCheckout,
		handleResumePayment,
		handleResumePaymentFromSidebar,
		handleCancelReservation
	};
}
