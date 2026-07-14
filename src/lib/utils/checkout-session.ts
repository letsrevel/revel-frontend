/**
 * Two-step online checkout (#464 / backend #632).
 *
 * Online (Stripe) purchases are two requests: the checkout endpoints RESERVE
 * capacity (creating PENDING tickets/passes server-side) and return a
 * `reservation_id`; a second call to the matching checkout-session endpoint
 * creates the Stripe session and returns the URL to redirect to. The session
 * endpoints are idempotent (Stripe idempotency key = reservation_id), so
 * retrying after a network blip is safe and reuses the same Stripe session.
 * Abandoned reservations auto-expire server-side — no client-side cleanup.
 */
import {
	eventpublicticketsCheckoutSession,
	eventpublicguestGuestCheckoutSession,
	seriespassSeriesPassCheckoutSession
} from '$lib/api';
import { extractErrorMessage } from '$lib/utils/errors';

/** Which checkout-session endpoint to hit (they differ by auth and URL). */
export type CheckoutSessionKind = 'user' | 'guest' | 'series-pass';

/** Structural shape shared by the three reserve responses. */
export interface ReserveResponseLike {
	checkout_url?: string | null;
	reservation_id?: string | null;
	requires_payment?: boolean;
}

/**
 * The reserve step succeeded but the Stripe-session step failed. The
 * reservation is still held server-side: callers can retry the session call
 * with `reservationId` (idempotent) unless `expired` is true (404 — unknown or
 * already reclaimed), in which case the purchase must restart from reserve.
 */
export class CheckoutSessionError extends Error {
	readonly reservationId: string;
	readonly expired: boolean;

	constructor(message: string, reservationId: string, expired: boolean) {
		super(message);
		this.name = 'CheckoutSessionError';
		this.reservationId = reservationId;
		this.expired = expired;
	}
}

/** Minimal structural result shape shared by the three session ops. */
interface SessionCallResult {
	data?: { checkout_url: string };
	error?: unknown;
	response?: Response;
}

const SESSION_CALLS: Record<
	CheckoutSessionKind,
	(reservationId: string) => Promise<SessionCallResult>
> = {
	user: (reservationId) =>
		eventpublicticketsCheckoutSession({ path: { reservation_id: reservationId } }),
	guest: (reservationId) =>
		eventpublicguestGuestCheckoutSession({ path: { reservation_id: reservationId } }),
	'series-pass': (reservationId) =>
		seriespassSeriesPassCheckoutSession({ path: { reservation_id: reservationId } })
};

/**
 * Create the Stripe checkout session for a held reservation and return its URL.
 *
 * @throws CheckoutSessionError when the call fails or returns no URL.
 */
export async function createCheckoutSession(
	kind: CheckoutSessionKind,
	reservationId: string
): Promise<string> {
	let response: SessionCallResult;
	try {
		response = await SESSION_CALLS[kind](reservationId);
	} catch (error) {
		// Network-level failure: the reservation is still held — retryable.
		throw new CheckoutSessionError(
			extractErrorMessage(error, 'Failed to start the payment.'),
			reservationId,
			false
		);
	}
	if (response.error || !response.data?.checkout_url) {
		throw new CheckoutSessionError(
			extractErrorMessage(response.error, 'Failed to start the payment.'),
			reservationId,
			response.response?.status === 404
		);
	}
	return response.data.checkout_url;
}

/**
 * Resolve the Stripe URL for a reserve response, chaining the session call
 * when the new two-step contract applies.
 *
 * Returns the URL to redirect to, or `null` for free/offline results that are
 * already complete (tickets/pass returned directly).
 *
 * @throws CheckoutSessionError when the session step fails (see class docs).
 */
export async function resolveCheckoutUrl(
	reserve: ReserveResponseLike,
	kind: CheckoutSessionKind
): Promise<string | null> {
	// Defensive: a reserve response that already carries a URL (legacy shape).
	if (reserve.checkout_url) {
		return reserve.checkout_url;
	}
	if (reserve.requires_payment && reserve.reservation_id) {
		return createCheckoutSession(kind, reserve.reservation_id);
	}
	return null;
}
