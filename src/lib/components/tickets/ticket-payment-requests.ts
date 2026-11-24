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
 * A failed payment request. `status` is the HTTP status of an error response, and
 * `undefined` when the request never got one (network failure).
 */
export class TicketPaymentRequestError extends Error {
	readonly status: number | undefined;

	constructor(message: string, status?: number) {
		super(message);
		this.name = 'TicketPaymentRequestError';
		this.status = status;
	}
}

/** True for a 409: the ticket changed meanwhile, so the open dialog and list are stale. */
export function isTicketStateConflict(error: unknown): boolean {
	return error instanceof TicketPaymentRequestError && error.status === 409;
}

/**
 * Runs the SDK call and turns every failure into a `TicketPaymentRequestError`.
 * A 400/409 carries the backend `detail` (for example "ticket state changed
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
		throw new TicketPaymentRequestError(fallbackMessage);
	}
	if (response.error) {
		throw new TicketPaymentRequestError(
			extractErrorMessage(response.error, fallbackMessage),
			response.response?.status
		);
	}
	return response.data;
}

/**
 * Offline payment confirm. The caller toasts the error message. On a 409 the ticket
 * changed meanwhile, so it refetches the list; on a 400 the dialog stays open.
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
