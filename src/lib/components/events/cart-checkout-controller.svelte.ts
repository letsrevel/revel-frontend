/**
 * Cart checkout controller (#853) over POST /events/{event_id}/checkout — the
 * multi-tier cart endpoint that replaces the single-tier checkout flow.
 *
 * The two-step reserve → checkout-session machinery below (`resumeHeldCheckout`,
 * `withCheckoutSessionUrl`, `sessionFailureError`, `handleCheckoutSuccess`) is
 * mirrored from `event-checkout-controller.svelte.ts`, which this cart flow will
 * fully replace: its single-tier mutations are deleted in PR 2 of this series
 * once the cart UI ships everywhere the old ticket-tier modal does today.
 */
import { createMutation, type QueryClient } from '@tanstack/svelte-query';
import { eventpublicticketsMultiTierCheckout } from '$lib/api';
import type {
	CheckoutGroupSchema,
	MultiTierCheckoutPayload,
	BatchCheckoutResponse,
	BuyerBillingInfoSchema
} from '$lib/api/generated/types.gen';
import {
	createReservationRetry,
	resolveCheckoutUrl,
	CheckoutSessionError
} from '$lib/utils/checkout-session';
import * as m from '$lib/paraglide/messages.js';
import { toast } from 'svelte-sonner';
import { checkoutError } from './checkout-error';

export interface CartCheckoutParams {
	items: CheckoutGroupSchema[];
	discountCode?: string;
	billingInfo?: BuyerBillingInfoSchema;
}

/** Dependencies the cart checkout controller needs from the host component. */
export interface CartCheckoutDeps {
	/** The event id used for the checkout call. */
	eventId: string;
	queryClient: QueryClient;
	/** Push a refreshed user status into the host component state. */
	refreshUserStatus: () => Promise<void>;
	/** Show / hide the "my ticket" modal. */
	setShowMyTicketModal: (open: boolean) => void;
	/** Called after any fully-successful purchase (clear the cart). */
	onPurchaseComplete: () => void;
}

/**
 * Rune-based checkout controller for the cart quick-buy flow.
 *
 * Owns the multi-tier checkout mutation and its success/error side effects,
 * keeping the host component focused on layout and local cart state. Must be
 * invoked during component initialization (it calls `createMutation`).
 */
export function createCartCheckoutController(deps: CartCheckoutDeps) {
	const { eventId, queryClient, refreshUserStatus, setShowMyTicketModal, onPurchaseComplete } =
		deps;

	// Held reservation from a session step that is pending or failed — an
	// identical retry (same fingerprint) replays only the idempotent session
	// call instead of re-reserving, which would strand the first reservation
	// and can trip max_tickets_per_user (PENDING tickets count toward it).
	const reservationRetry = createReservationRetry('user');

	// An expired reservation was released server-side — there is no pending
	// ticket left to "Resume Payment" on, so it gets its own message.
	function sessionFailureError(error: CheckoutSessionError): Error {
		const message = error.expired
			? m['eventPage.paymentStartFailedExpired']()
			: m['eventPage.paymentStartFailed']();
		return new Error(message, { cause: error });
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
	 * Two-step online checkout (#464): the checkout endpoint only RESERVES
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
	 * Handle a successful cart checkout response. Unlike the single-tier
	 * controller there is no tier modal to close; instead `onPurchaseComplete`
	 * clears the cart after EITHER branch — the redirect branch clears it too,
	 * since the reservation now owns the tickets and "Resume payment" takes
	 * over if the buyer backs out of Stripe.
	 */
	async function handleCheckoutSuccess(response: BatchCheckoutResponse) {
		if (!response) return;

		// Check if we got tickets directly (free/offline payment)
		if (response.tickets && response.tickets.length > 0) {
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

			onPurchaseComplete();

			// Open ticket modal after a short delay to show the new ticket
			setTimeout(() => {
				setShowMyTicketModal(true);
			}, 500);
		}
		// Check if we got a checkout URL (redirect to Stripe)
		else if (response.checkout_url) {
			onPurchaseComplete();
			window.location.href = response.checkout_url;
		}
	}

	const checkoutCartMutation = createMutation(() => ({
		mutationFn: async (params: CartCheckoutParams) => {
			const fingerprint = JSON.stringify(params); // key order: items, discountCode, billingInfo — always
			const resumed = await resumeHeldCheckout(fingerprint);
			if (resumed) return resumed;
			const body: MultiTierCheckoutPayload = {
				items: params.items,
				discount_code: params.discountCode || undefined,
				billing_info: params.billingInfo || undefined
			};
			const response = await eventpublicticketsMultiTierCheckout({
				path: { event_id: eventId },
				body
			});
			if (response.error) {
				const status = response.response?.status;
				if (status === 404) {
					// Stale cart: a tier vanished or became invisible (spec §5).
					queryClient.invalidateQueries({ queryKey: ['event-status', eventId] });
					throw new Error(m['cart.staleCart'](), { cause: response.error });
				}
				if (status === 403) {
					throw new Error(m['cart.saleWindowClosed'](), { cause: response.error });
				}
				throw checkoutError(response.error, m['cart.checkoutFailed']());
			}
			return withCheckoutSessionUrl(response.data, fingerprint);
		},
		onSuccess: handleCheckoutSuccess,
		onError: (error: Error) => {
			toast.error(m['cart.checkoutFailed'](), { description: error.message, duration: 6000 });
		}
	}));

	return {
		checkoutCart: async (params: CartCheckoutParams) => {
			await checkoutCartMutation.mutateAsync(params);
		},
		get isPending() {
			return checkoutCartMutation.isPending;
		}
	};
}
