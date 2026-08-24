/**
 * Pure mapping from a guest email-confirmation response's ticket array to
 * what `ConfirmationResult.svelte` renders (#853 PR 4 Task 7).
 *
 * The guest confirmation token now mints tickets across MULTIPLE tiers in
 * one go — `BatchCheckoutResponse.tickets` — since the guest flow moved to
 * the cart checkout (PR 3/4). All tickets in a single confirmation response
 * share one event, so the event id (and the first ticket's id, which
 * `post-redirect-params.ts` only ever uses as a presence flag) come from
 * `tickets[0]`. No runes, no I/O — unit-testable without mounting anything.
 */
import type { UserTicketSchema } from '$lib/api';

export interface TierBreakdownEntry {
	tierName: string;
	count: number;
}

export interface ConfirmedTicketsSummary {
	eventId: string | undefined;
	ticketId: string | undefined;
	count: number;
	/** Per-tier counts, in first-seen tier order. */
	tierBreakdown: TierBreakdownEntry[];
}

export function summarizeConfirmedTickets(tickets: UserTicketSchema[]): ConfirmedTicketsSummary {
	const firstTicket = tickets[0];
	const eventId = firstTicket?.event?.id;
	const ticketId = firstTicket?.id ?? undefined;

	const tierOrder: string[] = [];
	const tierCounts = new Map<string, TierBreakdownEntry>();
	for (const t of tickets) {
		const key = t.tier?.id ?? t.tier?.name ?? '';
		const existing = tierCounts.get(key);
		if (existing) {
			existing.count += 1;
		} else {
			tierCounts.set(key, { tierName: t.tier?.name ?? '', count: 1 });
			tierOrder.push(key);
		}
	}

	return {
		eventId,
		ticketId,
		count: tickets.length,
		tierBreakdown: tierOrder.map((key) => tierCounts.get(key) as TierBreakdownEntry)
	};
}
