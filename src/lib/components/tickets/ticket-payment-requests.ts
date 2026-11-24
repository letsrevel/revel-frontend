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
 * Offline payment confirm. A 400/409 carries the backend `detail` (for example
 * "ticket state changed meanwhile"); it is thrown as the Error message so the
 * caller can toast it, then refetch the list to drop the stale row state.
 */
export async function requestConfirmTicketPayment(
	args: PaymentRequestArgs & { pricePaid?: string }
) {
	const response = await eventadminticketsConfirmTicketPayment({
		path: { event_id: args.eventId, ticket_id: args.ticketId },
		body: args.pricePaid ? { price_paid: args.pricePaid } : undefined,
		headers: { Authorization: `Bearer ${args.accessToken}` }
	});
	if (response.error) {
		throw new Error(extractErrorMessage(response.error, args.fallbackMessage));
	}
	return response.data;
}

/** Reverts a confirmed offline payment to pending; same error contract as the confirm. */
export async function requestUnconfirmTicketPayment(args: PaymentRequestArgs) {
	const response = await eventadminticketsUnconfirmTicketPayment({
		path: { event_id: args.eventId, ticket_id: args.ticketId },
		headers: { Authorization: `Bearer ${args.accessToken}` }
	});
	if (response.error) {
		throw new Error(extractErrorMessage(response.error, args.fallbackMessage));
	}
	return response.data;
}
