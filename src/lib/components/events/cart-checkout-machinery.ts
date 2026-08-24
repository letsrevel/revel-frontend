/**
 * Two-step reserve → checkout-session machinery shared by the authed cart
 * controller (`cart-checkout-controller.svelte.ts`, kind `'user'`) and the
 * guest cart controller (`guest-cart-checkout-controller.svelte.ts`, kind
 * `'guest'`). Extracted from the authed controller (#853 PR4) so the guest
 * controller doesn't reimplement reservation-retry semantics; the authed
 * controller's own tests/E2E record is the fidelity proof for this move — its
 * behavior is unchanged, it just calls these helpers instead of defining them
 * inline.
 */
import type { QueryClient } from '@tanstack/svelte-query';
import {
	createReservationRetry,
	resolveCheckoutUrl,
	CheckoutSessionError,
	type CheckoutSessionKind,
	type ReserveResponseLike
} from '$lib/utils/checkout-session';
import * as m from '$lib/paraglide/messages.js';

/** Dependencies the shared machinery needs from the owning controller. */
export interface CheckoutMachineryDeps {
	eventId: string;
	queryClient: QueryClient;
	kind: CheckoutSessionKind;
	/**
	 * Refresh whatever "pending purchase" UI a session-step failure should
	 * surface (the authed controller's "Resume Payment" action on a pending
	 * ticket). Optional: guests have no such UI, so their controller omits it.
	 */
	onSessionFailure?: () => Promise<void>;
}

/**
 * Build the reserve → checkout-session helpers for one controller instance.
 * `TResponse` is the controller's reserve-response shape (`BatchCheckoutResponse`
 * for authed, `GuestCheckoutResponseSchema` for guest) — both are structural
 * supersets of `ReserveResponseLike`, so the machinery can construct and merge
 * response objects generically.
 */
export function createCheckoutMachinery<TResponse extends ReserveResponseLike>(
	deps: CheckoutMachineryDeps
) {
	const { eventId, queryClient, kind, onSessionFailure } = deps;

	// Held reservation from a session step that is pending or failed — an
	// identical retry (same fingerprint) replays only the idempotent session
	// call instead of re-reserving, which would strand the first reservation
	// and can trip max_tickets_per_user (PENDING tickets count toward it).
	const reservationRetry = createReservationRetry(kind);

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
	async function resumeHeldCheckout(fingerprint: string): Promise<TResponse | null> {
		try {
			const checkoutUrl = await reservationRetry.resume(fingerprint);
			if (!checkoutUrl) return null;
			// Common to both response shapes (BatchCheckoutResponse and
			// GuestCheckoutResponseSchema both declare these three fields) — the
			// generic cast is safe because callers only ever read fields declared
			// on ReserveResponseLike plus `tickets`/`message`, and this literal
			// deliberately supplies neither `reservation_id` nor `message`.
			return {
				checkout_url: checkoutUrl,
				tickets: [],
				requires_payment: true
			} as unknown as TResponse;
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
	 * the handle is kept so an identical retry resumes it, `onSessionFailure`
	 * (when provided) refreshes any "Resume Payment" UI, and a retryable error
	 * is surfaced.
	 */
	async function withCheckoutSessionUrl(data: TResponse, fingerprint: string): Promise<TResponse> {
		if (data.requires_payment && data.reservation_id) {
			reservationRetry.remember(data.reservation_id, fingerprint);
		}
		try {
			const checkoutUrl = await resolveCheckoutUrl(data, kind);
			return checkoutUrl ? { ...data, checkout_url: checkoutUrl } : data;
		} catch (error) {
			if (error instanceof CheckoutSessionError) {
				if (error.expired) {
					reservationRetry.clear();
				}
				if (onSessionFailure) {
					await onSessionFailure();
				}
				queryClient.invalidateQueries({ queryKey: ['event-status', eventId] });
				throw sessionFailureError(error);
			}
			throw error;
		}
	}

	return { reservationRetry, resumeHeldCheckout, withCheckoutSessionUrl, sessionFailureError };
}
