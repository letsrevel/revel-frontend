/**
 * Guest cart checkout controller (#853) over POST
 * /events/{event_id}/checkout/public — the guest mirror of
 * `cart-checkout-controller.svelte.ts`, sharing its two-step reserve →
 * checkout-session machinery (`cart-checkout-machinery.ts`, kind `'guest'`)
 * but with a distinct response shape (`GuestCheckoutResponseSchema`, which
 * adds the `message` email-confirmation branch and drops the ticket-modal
 * concern entirely) and its own error mapping: a 400 refusal whose
 * `next_step` has no guest-compatible path means "you need an account to do
 * that", which the sheet must surface as its own CTA rather than a generic
 * checkout-failed toast.
 */
import { createMutation, type QueryClient } from '@tanstack/svelte-query';
import { eventpublicguestGuestMultiTierCheckout } from '$lib/api';
import type { GuestCheckoutResponseSchema, GuestMultiTierCheckoutPayload } from '$lib/api';
import type { GuestCartCheckoutParams } from '../tickets/cart-payload';
import { createCheckoutMachinery } from './cart-checkout-machinery';
import * as m from '$lib/paraglide/messages.js';
import { toast } from 'svelte-sonner';
import { checkoutError } from './checkout-error';
import { extractApiErrorDetail } from '$lib/utils/api-error-detail';
import { getEligibilityRefusalMessage } from '$lib/utils/eligibility';

/** Next steps a guest can complete without an account (eligibility check). */
// eslint-disable-next-line svelte/prefer-svelte-reactivity -- module-level constant, never mutated, not read from a template
export const GUEST_COMPATIBLE_STEPS: ReadonlySet<string> = new Set([
	'purchase_ticket',
	'rsvp',
	'wait_for_event_to_open',
	'wait_for_open_spot'
]);

/**
 * Thrown when a guest checkout is refused because the next required step
 * (e.g. `become_member`, `complete_questionnaire`) has no guest-compatible
 * path — the sheet must offer sign-in / create-account instead of retrying.
 */
export class GuestAccountRequiredError extends Error {
	constructor(message: string, cause?: unknown) {
		super(message, { cause });
		this.name = 'GuestAccountRequiredError';
	}
}

/**
 * Pure mapping from a failed guest checkout response to a throwable Error.
 * Exported for unit testing; `mutationFn` is the only production caller. Any
 * side effect belonging to a branch (cache invalidation on 404) stays in the
 * mutation, not here.
 */
export function mapGuestCheckoutError(error: unknown, status: number | undefined): Error {
	if (status === 404) {
		// Stale cart: a tier vanished or became invisible (spec §5).
		return new Error(m['cart.staleCart'](), { cause: error });
	}
	if (status === 403) {
		// The backend also 403s tier purchasability ("You are not allowed to
		// purchase from this tier.") on top of a closed sale window —
		// shape-safe: prefer the backend's own detail, fall back to the
		// sale-window copy rather than matching on message text.
		return new Error(extractApiErrorDetail(error) ?? m['cart.saleWindowClosed'](), {
			cause: error
		});
	}
	if (status === 400) {
		// The runtime error payload can carry eligibility fields (next_step)
		// that are not part of the declared error type, so narrow from unknown.
		const nextStep =
			typeof error === 'object' && error !== null && 'next_step' in error
				? (error as { next_step?: unknown }).next_step
				: undefined;
		if (typeof nextStep === 'string' && !GUEST_COMPATIBLE_STEPS.has(nextStep)) {
			return new GuestAccountRequiredError(
				getEligibilityRefusalMessage(error) ?? m['cart.checkoutFailed'](),
				error
			);
		}
	}
	return checkoutError(error, m['cart.checkoutFailed']());
}

/** Dependencies the guest cart checkout controller needs from the host component. */
export interface GuestCartCheckoutDeps {
	/** The event id used for the checkout call. */
	eventId: string;
	queryClient: QueryClient;
	/** Called after any fully-successful purchase (clear the cart). */
	onPurchaseComplete: () => void;
	/**
	 * The `message` branch: no ticket exists client-side yet, the backend
	 * emailed a confirm link. Called with the backend's message and the email
	 * it was sent to, so the host can render the confirmation state.
	 */
	onEmailConfirmationPending: (message: string, email: string) => void;
}

/**
 * Rune-based checkout controller for the guest cart quick-buy flow.
 *
 * Owns the guest multi-tier checkout mutation and its success/error side
 * effects, keeping the host component focused on layout and local cart
 * state. Must be invoked during component initialization (it calls
 * `createMutation`).
 */
export function createGuestCartCheckoutController(deps: GuestCartCheckoutDeps) {
	const { eventId, queryClient, onPurchaseComplete, onEmailConfirmationPending } = deps;

	// Shared reserve → checkout-session machinery (see cart-checkout-machinery.ts).
	// Guests have no "my status" to refresh on a retryable session failure, so
	// `onSessionFailure` is omitted — the reservation-retry handle still lets an
	// identical resubmit resume instead of re-reserving.
	const { reservationRetry, resumeHeldCheckout, withCheckoutSessionUrl } =
		createCheckoutMachinery<GuestCheckoutResponseSchema>({
			eventId,
			queryClient,
			kind: 'guest'
		});

	/**
	 * Handle a successful guest cart checkout response. Unlike the authed
	 * controller there is no ticket modal to open; instead every branch calls
	 * `onPurchaseComplete` to clear the cart — including the `message` branch,
	 * where the reservation's HOLDS stay alive server-side for the emailed
	 * confirmation (released on confirm or expiry). The host is responsible for
	 * marking its own "handed off" state BEFORE clearing so the seat-hold
	 * release effect doesn't race the confirmation UI (ruling 8).
	 */
	async function handleCheckoutSuccess(response: GuestCheckoutResponseSchema, email: string) {
		if (!response) return;

		if (response.checkout_url) {
			// Online payment - redirect to Stripe.
			onPurchaseComplete();
			window.location.href = response.checkout_url;
			return;
		}

		if (response.message) {
			// Non-online tiers: the backend emailed a confirmation link. There is
			// no ticket to show yet, so the host renders its own success state.
			onEmailConfirmationPending(response.message, email);
			onPurchaseComplete();
			return;
		}

		// Defensive fallback: guests with a non-online cart normally get
		// `message` above, never `tickets` directly (that only happens after
		// the guest confirms by email). Handle it anyway in case the shape
		// ever changes, mirroring the authed controller's tickets branch.
		if (response.tickets && response.tickets.length > 0) {
			const ticketCount = response.tickets.length;
			const firstTicket = response.tickets[0];
			const isPending = firstTicket?.status === 'pending';

			if (isPending) {
				toast.success(m['eventPage.ticketReserved']({ count: ticketCount }), {
					description: m['eventPage.ticketReservedDesc'](),
					duration: 5000
				});
			} else {
				toast.success(m['eventPage.ticketClaimed']({ count: ticketCount }), {
					description: m['eventPage.ticketClaimedDesc'](),
					duration: 4000
				});
			}

			onPurchaseComplete();
		}
	}

	const checkoutCartMutation = createMutation(() => ({
		mutationFn: async (params: GuestCartCheckoutParams) => {
			const fingerprint = JSON.stringify(params); // key order: items, email, first_name, last_name, discountCode, billingInfo — always
			const resumed = await resumeHeldCheckout(fingerprint);
			if (resumed) return resumed;
			const body: GuestMultiTierCheckoutPayload = {
				items: params.items,
				email: params.email,
				first_name: params.first_name,
				last_name: params.last_name,
				discount_code: params.discountCode || undefined,
				billing_info: params.billingInfo || undefined
			};
			const response = await eventpublicguestGuestMultiTierCheckout({
				path: { event_id: eventId },
				body
			});
			if (response.error) {
				const status = response.response?.status;
				if (status === 404) {
					queryClient.invalidateQueries({ queryKey: ['event-status', eventId] });
				}
				throw mapGuestCheckoutError(response.error, status);
			}
			return withCheckoutSessionUrl(response.data, fingerprint);
		},
		onSuccess: (response, params) => handleCheckoutSuccess(response, params.email),
		onError: (error: Error) => {
			toast.error(m['cart.checkoutFailed'](), { description: error.message, duration: 6000 });
		}
	}));

	return {
		checkoutCart: async (params: GuestCartCheckoutParams) => {
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
		wouldResume: (params: GuestCartCheckoutParams): boolean => {
			const fingerprint = JSON.stringify(params); // must match mutationFn's fingerprint exactly
			return reservationRetry.wouldResume(fingerprint);
		},
		get isPending() {
			return checkoutCartMutation.isPending;
		}
	};
}
