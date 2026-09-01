/**
 * Cart checkout controller (#853) over POST /events/{event_id}/checkout — the
 * multi-tier cart endpoint that replaces the single-tier checkout flow.
 *
 * The two-step reserve → checkout-session machinery (`resumeHeldCheckout`,
 * `withCheckoutSessionUrl`, `sessionFailureError`) that this controller used to
 * define inline now lives in `cart-checkout-machinery.ts`, shared with the
 * guest cart controller (`guest-cart-checkout-controller.svelte.ts`) — this
 * controller's own behavior, error branches, toasts, and success flow are
 * unchanged, it just calls the extracted helpers. `handleCheckoutSuccess`
 * stays here: the guest response shape differs (a `message` email-confirmation
 * branch, no ticket-modal), so it isn't shared machinery.
 */
import { createMutation, type QueryClient } from '@tanstack/svelte-query';
import { eventpublicticketsMultiTierCheckout } from '$lib/api';
import type {
	CheckoutGroupSchema,
	MultiTierCheckoutPayload,
	BatchCheckoutResponse,
	BuyerBillingInfoSchema
} from '$lib/api/generated/types.gen';
import { createCheckoutMachinery } from './cart-checkout-machinery';
import * as m from '$lib/paraglide/messages.js';
import { toast } from 'svelte-sonner';
import { checkoutError } from './checkout-error';
import { extractApiErrorDetail } from '$lib/utils/api-error-detail';

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

	// Shared reserve → checkout-session machinery (see cart-checkout-machinery.ts):
	// resume/reserve/session-chaining semantics are byte-identical to before this
	// was extracted, just no longer defined inline. On a retryable session
	// failure, refresh the user status so the pending ticket's "Resume Payment"
	// action (which also recreates the session) appears.
	const { reservationRetry, resumeHeldCheckout, withCheckoutSessionUrl } =
		createCheckoutMachinery<BatchCheckoutResponse>({
			eventId,
			queryClient,
			kind: 'user',
			onSessionFailure: refreshUserStatus
		});

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
					// The backend also 403s tier purchasability ("You are not allowed
					// to purchase from this tier.") on top of a closed sale window —
					// shape-safe: prefer the backend's own detail, fall back to the
					// sale-window copy rather than matching on message text.
					throw new Error(extractApiErrorDetail(response.error) ?? m['cart.saleWindowClosed'](), {
						cause: response.error
					});
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
		/**
		 * Pure peek: would `checkoutCart(params)` RESUME a held reservation
		 * instead of reserving afresh? Rebuilds the fingerprint the exact same
		 * way the mutation does (`JSON.stringify(params)` — the two must never
		 * drift) and forwards to `reservationRetry.wouldResume`, which makes no
		 * network call and never consumes the held handle.
		 *
		 * Callers (the confirm-time best-available hold step) use this to skip
		 * re-holding seats: a resumed reservation already owns its holds from
		 * the original reserve call, so holding again would just release and
		 * reacquire the same block for nothing.
		 */
		wouldResume: (params: CartCheckoutParams): boolean => {
			const fingerprint = JSON.stringify(params); // must match mutationFn's fingerprint exactly
			return reservationRetry.wouldResume(fingerprint);
		},
		get isPending() {
			return checkoutCartMutation.isPending;
		}
	};
}
