/**
 * Shared helpers for optimistic up/down reordering of id-keyed lists (ticket
 * tiers, membership tiers, …). Both the ticket-tier and membership-tier reorder
 * flows use the same optimistic pattern; keeping the logic here stops the two
 * copies from drifting.
 */

type WithId = { id?: string | null };

/**
 * Reorder a flat list to match `orderedIds`, dropping any id not present in the
 * list. Used to apply an optimistic reorder to cached query data.
 */
export function reorderByIds<T extends WithId>(items: T[], orderedIds: string[]): T[] {
	const byId = new Map(items.map((item) => [item.id, item]));
	return orderedIds.map((id) => byId.get(id)).filter((item): item is T => item !== undefined);
}

/**
 * Swap the items at `index`/`swapIndex` (whole objects, index-aligned with the
 * source list), then return the full id list in the new order. Returns `null` if
 * any item lacks an id — the caller should bail rather than send a partial set the
 * backend would reject, so the order can't desync on a null id.
 */
export function swapAndCollectIds<T extends WithId>(
	items: T[],
	index: number,
	swapIndex: number
): string[] | null {
	const reordered = [...items];
	[reordered[index], reordered[swapIndex]] = [reordered[swapIndex], reordered[index]];
	const ids = reordered.map((item) => item.id).filter((id): id is string => !!id);
	return ids.length === reordered.length ? ids : null;
}
