import type {
	CombinedTotalsSchema,
	CurrencyFinancialsSchema,
	MembershipFinancialsSchema,
	OrganizationFinancialsSchema
} from '$lib/api/generated';

/**
 * Pick the figures for the currently-active currency, falling back to the first
 * available so a row is never blank when currencies are mixed.
 *
 * Ticket totals, membership money and combined totals are all keyed by currency,
 * so one helper serves all three lists.
 */
export function entryFor<T extends { currency: string }>(
	entries: T[],
	currency: string | null
): T | undefined {
	if (entries.length === 0) return undefined;
	if (!currency) return entries[0];
	return entries.find((entry) => entry.currency === currency) ?? entries[0];
}

/** Which financial blocks the page should render for the active currency. */
export interface FinancialsSections {
	/** Ticket money. `undefined` when this currency saw no ticket sales. */
	totals: CurrencyFinancialsSchema | undefined;
	/** Membership subscription money — org-level, never folded into `totals`. */
	memberships: MembershipFinancialsSchema | undefined;
	/** Tickets + memberships. Only set when *both* sides have money to add. */
	combined: CombinedTotalsSchema | undefined;
	/**
	 * True only when there is genuinely nothing to report for this currency:
	 * no ticket money, no membership money, no events. Distinct from "no ticket
	 * sales", which is a statement about the by-event list alone — an org whose
	 * only revenue is memberships must never be told it had no revenue.
	 */
	nothingAtAll: boolean;
}

/**
 * Resolve the page's sections for one currency.
 *
 * `combined` is deliberately withheld unless both a ticket and a membership
 * entry exist: with one side missing the combined figure merely restates that
 * side, which reads as a second, contradictory total.
 */
export function selectSections(
	financials: OrganizationFinancialsSchema | undefined,
	currency: string | null
): FinancialsSections {
	if (!financials) {
		return { totals: undefined, memberships: undefined, combined: undefined, nothingAtAll: false };
	}

	const totals = entryFor(financials.totals, currency);
	const memberships = entryFor(financials.memberships, currency);
	const combined =
		totals && memberships ? entryFor(financials.combined_totals, currency) : undefined;

	return {
		totals,
		memberships,
		combined,
		nothingAtAll: !totals && !memberships && financials.events.length === 0
	};
}
