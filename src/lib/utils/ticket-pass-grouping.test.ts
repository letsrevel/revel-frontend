import { describe, it, expect } from 'vitest';
import { groupTicketsWithPasses } from './ticket-pass-grouping';
import type { HeldSeriesPassSchema, UserTicketSchema } from '$lib/api/generated/types.gen';

function makeTicket(id: string, heldPassId?: string): UserTicketSchema {
	return {
		id,
		event: { id: `event-${id}`, name: `Event ${id}` },
		tier: { name: 'Standard' },
		status: 'active',
		created_at: '2026-07-08T10:00:00Z',
		series_pass: heldPassId
			? { held_pass_id: heldPassId, series_pass_id: 'pass-1', name: 'Full course' }
			: null
	} as unknown as UserTicketSchema;
}

function makeHeldPass(id: string): HeldSeriesPassSchema {
	return {
		id,
		status: 'active',
		series_pass: {
			id: 'pass-1',
			name: 'Full course',
			price: '24.00',
			pro_rata_discount: '8.00',
			currency: 'EUR',
			payment_method: 'online',
			purchasable_by: 'public'
		},
		series: { id: 'series-1', name: 'Weekly Yoga', slug: 'weekly-yoga' },
		remaining_event_count: 2,
		total_event_count: 3,
		price_paid: '24.00',
		created_at: '2026-07-08T10:00:00Z'
	} as HeldSeriesPassSchema;
}

describe('groupTicketsWithPasses', () => {
	const passes = new Map([['held-1', makeHeldPass('held-1')]]);

	it('passes through tickets without a series pass', () => {
		const result = groupTicketsWithPasses([makeTicket('t1'), makeTicket('t2')], passes);
		expect(result).toHaveLength(2);
		expect(result.every((e) => e.kind === 'ticket')).toBe(true);
	});

	it('collapses multiple pass tickets into one pass entry at the first position', () => {
		const result = groupTicketsWithPasses(
			[makeTicket('t1', 'held-1'), makeTicket('t2'), makeTicket('t3', 'held-1')],
			passes
		);
		expect(result).toHaveLength(2);
		expect(result[0]).toMatchObject({ kind: 'pass', heldPass: { id: 'held-1' } });
		expect(result[1]).toMatchObject({ kind: 'ticket', ticket: { id: 't2' } });
	});

	it('falls back to the ticket card when the pass is not loaded', () => {
		const result = groupTicketsWithPasses(
			[makeTicket('t1', 'held-unknown'), makeTicket('t2', 'held-unknown')],
			passes
		);
		expect(result).toHaveLength(2);
		expect(result.every((e) => e.kind === 'ticket')).toBe(true);
	});

	it('emits one entry per distinct pass', () => {
		const twoPasses = new Map([
			['held-1', makeHeldPass('held-1')],
			['held-2', makeHeldPass('held-2')]
		]);
		const result = groupTicketsWithPasses(
			[makeTicket('t1', 'held-1'), makeTicket('t2', 'held-2'), makeTicket('t3', 'held-1')],
			twoPasses
		);
		expect(result).toHaveLength(2);
		expect(result.map((e) => e.kind)).toEqual(['pass', 'pass']);
	});
});
