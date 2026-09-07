<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { SvelteMap } from 'svelte/reactivity';
	import { createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { AlertCircle, Loader2, Megaphone } from '@lucide/svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import type { EventDetailSchema, EventListingSchema } from '$lib/api/generated/types.gen';
	import {
		eventadminticketsListTicketTiers,
		eventintegrationsListListings
	} from '$lib/api/generated/sdk.gen';
	import ListingCard from './ListingCard.svelte';
	import { listingsRefetchInterval, PENDING_SLOW_AFTER_MS } from './listing-view';

	interface Props {
		organizationSlug: string;
		eventId: string;
		/** The saved event, for the eligibility pre-check on the cards. */
		event: Pick<EventDetailSchema, 'event_type' | 'end' | 'requires_ticket'>;
		isOwner: boolean;
	}
	const { organizationSlug, eventId, event, isOwner }: Props = $props();

	const queryClient = useQueryClient();
	const queryKey = $derived(['event-admin', eventId, 'listings'] as const);

	// When each provider's current pending stretch began, written from the query
	// function and read by the derived below on every fetch. Per provider, so a
	// push that starts on one platform does not inherit another platform's
	// ten-minute-old clock.
	const pendingSince = new SvelteMap<string, number>();

	const listings = createQuery(() => ({
		queryKey,
		queryFn: async (): Promise<EventListingSchema[]> => {
			const res = await eventintegrationsListListings({ path: { event_id: eventId } });
			if (res.error || !res.data) throw new Error(m['listings.loadFailed']());
			const now = Date.now();
			for (const listing of res.data) {
				if (listing.link?.sync_state === 'pending') {
					if (!pendingSince.has(listing.provider)) pendingSince.set(listing.provider, now);
				} else {
					pendingSince.delete(listing.provider);
				}
			}
			return res.data;
		},
		// Poll only while a push is in flight; slow down once the oldest pending
		// stretch passes ten minutes.
		refetchInterval: (query) =>
			listingsRefetchInterval(query.state.data, earliestPending(), Date.now()),
		refetchIntervalInBackground: false
	}));

	function earliestPending(): number | null {
		let earliest: number | null = null;
		for (const t of pendingSince.values()) if (earliest === null || t < earliest) earliest = t;
		return earliest;
	}

	// Re-evaluated on every fetch, which is at least every 30 s while pending.
	const slowProviders = $derived.by((): string[] => {
		void listings.dataUpdatedAt;
		const now = Date.now();
		return [...pendingSince]
			.filter(([, since]) => now - since >= PENDING_SLOW_AFTER_MS)
			.map(([provider]) => provider);
	});

	// Same key as the Ticketing tab, so the two tabs share one cache entry.
	const tiersKey = $derived(['event-admin', eventId, 'ticket-tiers'] as const);
	const tiersQuery = createQuery(() => ({
		queryKey: tiersKey,
		queryFn: () => eventadminticketsListTicketTiers({ path: { event_id: eventId } })
	}));
	const tiers = $derived(tiersQuery.data?.data?.results ?? []);

	function refresh() {
		void queryClient.invalidateQueries({ queryKey });
		void queryClient.invalidateQueries({ queryKey: tiersKey });
	}
</script>

<div class="space-y-6">
	<p class="text-sm text-muted-foreground">{m['listings.intro']()}</p>

	{#if listings.isPending}
		<p class="flex items-center gap-2 text-sm text-muted-foreground" role="status">
			<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
			<span class="sr-only">{m['listings.intro']()}</span>
		</p>
	{:else if listings.isError}
		<div
			class="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3"
			role="alert"
		>
			<AlertCircle class="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
			<p class="text-sm text-foreground">{m['listings.loadFailed']()}</p>
		</div>
	{:else if listings.data && listings.data.length === 0}
		<EmptyState
			icon={Megaphone}
			title={m['listings.empty.title']()}
			body={m['listings.empty.body']()}
			level={2}
		/>
	{:else if listings.data}
		{#each listings.data as listing (listing.provider)}
			<ListingCard
				{organizationSlug}
				{eventId}
				{listing}
				{event}
				{isOwner}
				{tiers}
				pendingSlow={slowProviders.includes(listing.provider)}
				onChanged={refresh}
			/>
		{/each}
	{/if}
</div>
