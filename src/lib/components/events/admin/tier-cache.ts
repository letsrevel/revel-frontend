import type { QueryClient } from '@tanstack/svelte-query';
import type { TicketTierDetailSchema } from '$lib/api/generated/types.gen';

/**
 * The ticket-tier list query (TicketingStep) resolves to the SDK result, so the
 * tiers live at `cache.data.results`. Writing a saved tier straight into that
 * entry means a reopened dialog seeds from the saved values without waiting on
 * a refetch.
 */
type TierListCache = { data?: { results?: TicketTierDetailSchema[]; count?: number } };

export const tierListKey = (eventId: string): readonly unknown[] => [
	'event-admin',
	eventId,
	'ticket-tiers'
];

function patchResults(
	client: QueryClient,
	eventId: string,
	update: (results: TicketTierDetailSchema[]) => TicketTierDetailSchema[]
): void {
	// No entry yet (or an unexpected shape): leave it to the invalidation.
	client.setQueryData<TierListCache>(tierListKey(eventId), (old) => {
		const results = old?.data?.results;
		if (!old?.data || !results) return old;
		const next = update(results);
		const count = old.data.count;
		return {
			...old,
			data: {
				...old.data,
				results: next,
				...(typeof count === 'number' ? { count: count + (next.length - results.length) } : {})
			}
		};
	});
}

/** Replace the tier by id, or append it when it is new. */
export function upsertTierInCache(
	client: QueryClient,
	eventId: string,
	saved: TicketTierDetailSchema | undefined
): void {
	if (!saved?.id) return;
	patchResults(client, eventId, (results) =>
		results.some((t) => t.id === saved.id)
			? results.map((t) => (t.id === saved.id ? saved : t))
			: [...results, saved]
	);
}

export function removeTierFromCache(client: QueryClient, eventId: string, tierId: string): void {
	patchResults(client, eventId, (results) => results.filter((t) => t.id !== tierId));
}

/** Refresh server-derived fields in the background; the cache write already seeded the UI. */
export function refreshTierList(client: QueryClient, eventId: string): void {
	void client.invalidateQueries({ queryKey: tierListKey(eventId) });
}

export type TierChange = { saved?: TicketTierDetailSchema; deletedId?: string | null };

/** Save/delete succeeded: update the cache from the result, sync in the background. */
export function commitTier(client: QueryClient, eventId: string, change: TierChange): void {
	if (change.deletedId) removeTierFromCache(client, eventId, change.deletedId);
	else upsertTierInCache(client, eventId, change.saved);
	refreshTierList(client, eventId);
}
