import {
	eventadminticketsConfirmTicketPayment,
	eventadminticketsUnconfirmTicketPayment
} from '$lib/api/generated/sdk.gen';
import { extractErrorMessage } from '$lib/utils/errors';

interface PaymentRequestArgs {
	eventId: string;
	ticketId: string;
	accessToken: string | null | undefined;
	/** Already-translated text for failures that carry no backend `detail`. */
	fallbackMessage: string;
}

/**
 * A failed payment request. `status` is the HTTP status of an error response, if
 * the SDK gave one. `network` is true only when the call itself threw (offline,
 * DNS), so no response came back.
 */
export class TicketPaymentRequestError extends Error {
	readonly status: number | undefined;
	readonly network: boolean;

	constructor(message: string, options: { status?: number; network?: boolean } = {}) {
		super(message);
		this.name = 'TicketPaymentRequestError';
		this.status = options.status;
		this.network = options.network ?? false;
	}
}

/** Transient 4xx statuses: a timeout (408) or a rate limit (429). A retry can pass. */
const TRANSIENT_CLIENT_STATUSES = new Set([408, 429]);

/**
 * True only when retrying the same request from the open dialog can succeed: a
 * network failure, a server failure (>= 500), a timeout (408) or a rate limit (429).
 * Every other 4xx is final: a 404/409 means the ticket changed meanwhile (the backend
 * looks it up by status), and a 400 is a server validation (series-pass ticket, price
 * rules for the tier) that the same input will hit again. An error response with no
 * status is also final, because we cannot show that a retry can succeed.
 */
export function isRetryablePaymentError(error: unknown): boolean {
	if (!(error instanceof TicketPaymentRequestError)) return false;
	if (error.network) return true;
	const { status } = error;
	if (status === undefined) return false;
	return status >= 500 || TRANSIENT_CLIENT_STATUSES.has(status);
}

/**
 * Runs the SDK call and turns every failure into a `TicketPaymentRequestError`.
 * A 4xx carries the backend `detail` (for example "ticket state changed
 * meanwhile"). A thrown fetch error (offline, DNS) would carry a raw English
 * browser message, so it becomes the translated fallback instead.
 */
async function run<T extends { data?: unknown; error?: unknown; response?: Response }>(
	call: () => Promise<T>,
	fallbackMessage: string
): Promise<T['data']> {
	let response: T;
	try {
		response = await call();
	} catch {
		throw new TicketPaymentRequestError(fallbackMessage, { network: true });
	}
	if (response.error) {
		throw new TicketPaymentRequestError(extractErrorMessage(response.error, fallbackMessage), {
			status: response.response?.status
		});
	}
	return response.data;
}

/**
 * Offline payment confirm. On an error the caller toasts the message and refetches
 * the list. Unless `isRetryablePaymentError`, it also closes the dialog.
 */
export function requestConfirmTicketPayment(args: PaymentRequestArgs & { pricePaid?: string }) {
	return run(
		() =>
			eventadminticketsConfirmTicketPayment({
				path: { event_id: args.eventId, ticket_id: args.ticketId },
				body: args.pricePaid ? { price_paid: args.pricePaid } : undefined,
				headers: { Authorization: `Bearer ${args.accessToken}` }
			}),
		args.fallbackMessage
	);
}

/** Reverts a confirmed offline payment to pending; same error contract as the confirm. */
export function requestUnconfirmTicketPayment(args: PaymentRequestArgs) {
	return run(
		() =>
			eventadminticketsUnconfirmTicketPayment({
				path: { event_id: args.eventId, ticket_id: args.ticketId },
				headers: { Authorization: `Bearer ${args.accessToken}` }
			}),
		args.fallbackMessage
	);
}
