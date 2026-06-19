/**
 * Ticket-list ordering helpers.
 *
 * The union mirrors the backend `order_by` enum on
 * `GET /api/event-admin/{event_id}/tickets` (revel-backend#517). It is declared
 * manually rather than derived from the generated client because the generated
 * Data type carries an unstable hash in its name.
 */

export type TicketOrderBy =
	| 'created_at'
	| '-created_at'
	| 'tier__name'
	| '-tier__name'
	| 'status'
	| '-status'
	| 'tier__payment_method'
	| '-tier__payment_method'
	| 'price'
	| '-price'
	| 'price_paid'
	| '-price_paid';

/** Columns the admin table lets you sort by (each toggles asc/desc). */
export type TicketSortField =
	| 'tier__name'
	| 'price'
	| 'tier__payment_method'
	| 'status'
	| 'created_at';

const VALID_ORDER_BY: readonly TicketOrderBy[] = [
	'created_at',
	'-created_at',
	'tier__name',
	'-tier__name',
	'status',
	'-status',
	'tier__payment_method',
	'-tier__payment_method',
	'price',
	'-price',
	'price_paid',
	'-price_paid'
];

/** Validate a raw URL value, returning a safe `TicketOrderBy` or `undefined`. */
export function parseTicketOrderBy(raw: string | null | undefined): TicketOrderBy | undefined {
	if (!raw) return undefined;
	return (VALID_ORDER_BY as readonly string[]).includes(raw) ? (raw as TicketOrderBy) : undefined;
}

/**
 * Next ordering when a sortable column header is clicked: ascending when the
 * column is inactive (or currently descending), descending when it is already
 * ascending. Clicking thus cycles asc ↔ desc.
 */
export function nextOrderBy(
	current: TicketOrderBy | undefined,
	field: TicketSortField
): TicketOrderBy {
	return current === field ? (`-${field}` as TicketOrderBy) : field;
}

/** Active sort direction for a field, for `aria-sort` and indicator icons. */
export function sortDirection(
	current: TicketOrderBy | undefined,
	field: TicketSortField
): 'asc' | 'desc' | null {
	if (current === field) return 'asc';
	if (current === `-${field}`) return 'desc';
	return null;
}
