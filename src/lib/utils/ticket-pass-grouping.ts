import type { HeldSeriesPassSchema, UserTicketSchema } from '$lib/api/generated/types.gen';

export type TicketListEntry =
	{ kind: 'ticket'; ticket: UserTicketSchema } | { kind: 'pass'; heldPass: HeldSeriesPassSchema };

/**
 * Collapse pass-derived tickets into their held pass for the "my tickets" list.
 *
 * Tickets that belong to a series pass are replaced by a single pass entry (at
 * the position of the first such ticket, preserving list order). Tickets whose
 * pass isn't in `passesById` — e.g. the passes query is still loading or
 * errored — fall back to their plain ticket card so nothing silently
 * disappears.
 */
export function groupTicketsWithPasses(
	tickets: UserTicketSchema[],
	passesById: Map<string, HeldSeriesPassSchema>
): TicketListEntry[] {
	const entries: TicketListEntry[] = [];
	const emittedPassIds = new Set<string>();

	for (const ticket of tickets) {
		const heldPassId = ticket.series_pass?.held_pass_id;
		if (!heldPassId) {
			entries.push({ kind: 'ticket', ticket });
			continue;
		}
		const heldPass = passesById.get(heldPassId);
		if (!heldPass) {
			entries.push({ kind: 'ticket', ticket });
			continue;
		}
		if (!emittedPassIds.has(heldPassId)) {
			emittedPassIds.add(heldPassId);
			entries.push({ kind: 'pass', heldPass });
		}
	}

	return entries;
}
