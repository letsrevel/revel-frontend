import { describe, it, expect } from 'vitest';
import { summarizeConfirmedTickets } from './confirmation-tickets';
import type { UserTicketSchema } from '$lib/api';

// The guest email-confirmation token can now mint tickets across MULTIPLE
// tiers in one go (a cart, #853 PR 4). `summarizeConfirmedTickets` is the
// pure mapping from the raw `BatchCheckoutResponse.tickets` array to what
// `ConfirmationResult.svelte` renders: the shared event id (all tickets in
// a single confirmation share one event), the first ticket's id (only used
// as a presence flag by `post-redirect-params.ts`), the total count, and a
// per-tier breakdown for display.

function ticket(overrides: Partial<UserTicketSchema> = {}): UserTicketSchema {
	return {
		event: { id: 'event-1', slug: 'party', name: 'Party' } as UserTicketSchema['event'],
		tier: { id: 'tier-1', name: 'General' } as UserTicketSchema['tier'],
		status: 'valid',
		apple_pass_available: false,
		google_pass_available: false,
		guest_name: 'Jane Doe',
		id: 'ticket-1',
		created_at: '2026-08-19T00:00:00Z',
		...overrides
	} as UserTicketSchema;
}

describe('summarizeConfirmedTickets', () => {
	it('returns undefined eventId/ticketId and a zero count for an empty array', () => {
		expect(summarizeConfirmedTickets([])).toEqual({
			eventId: undefined,
			ticketId: undefined,
			count: 0,
			tierBreakdown: []
		});
	});

	it('summarizes a single ticket', () => {
		const tickets = [ticket()];
		expect(summarizeConfirmedTickets(tickets)).toEqual({
			eventId: 'event-1',
			ticketId: 'ticket-1',
			count: 1,
			tierBreakdown: [{ tierName: 'General', count: 1 }]
		});
	});

	it('takes eventId and ticketId from the FIRST ticket when there are several', () => {
		const tickets = [
			ticket({ id: 'ticket-1' }),
			ticket({ id: 'ticket-2', event: { id: 'event-1' } as UserTicketSchema['event'] })
		];
		const result = summarizeConfirmedTickets(tickets);
		expect(result.eventId).toBe('event-1');
		expect(result.ticketId).toBe('ticket-1');
	});

	it('counts every ticket regardless of tier', () => {
		const tickets = [ticket(), ticket({ id: 'ticket-2' }), ticket({ id: 'ticket-3' })];
		expect(summarizeConfirmedTickets(tickets).count).toBe(3);
	});

	it('groups the per-tier breakdown, preserving first-seen tier order', () => {
		const tickets = [
			ticket({ id: 't1', tier: { id: 'tier-vip', name: 'VIP' } as UserTicketSchema['tier'] }),
			ticket({
				id: 't2',
				tier: { id: 'tier-general', name: 'General' } as UserTicketSchema['tier']
			}),
			ticket({ id: 't3', tier: { id: 'tier-vip', name: 'VIP' } as UserTicketSchema['tier'] }),
			ticket({ id: 't4', tier: { id: 'tier-vip', name: 'VIP' } as UserTicketSchema['tier'] })
		];
		expect(summarizeConfirmedTickets(tickets).tierBreakdown).toEqual([
			{ tierName: 'VIP', count: 3 },
			{ tierName: 'General', count: 1 }
		]);
	});

	it('handles a ticket missing an id (id is optional on UserTicketSchema)', () => {
		const tickets = [ticket({ id: null })];
		expect(summarizeConfirmedTickets(tickets).ticketId).toBeUndefined();
	});
});
