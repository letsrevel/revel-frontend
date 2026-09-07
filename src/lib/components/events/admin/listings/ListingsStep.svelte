<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { AlertCircle, Loader2, Megaphone } from '@lucide/svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import type { EventDetailSchema, EventListingSchema } from '$lib/api/generated/types.gen';
	import { eventintegrationsListListings } from '$lib/api/generated/sdk.gen';
	import ListingCard from './ListingCard.svelte';
	import { hasPendingLink, listingsRefetchInterval, PENDING_SLOW_AFTER_MS } from './listing-view';

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

	// When the current pending stretch began; null while nothing is pending.
	// Plain (not `$state`): it is written from the query function, and the
	// derived below re-reads it whenever a fetch lands (`dataUpdatedAt`).
	let pendingSinceRef: number | null = null;

	const listings = createQuery(() => ({
		queryKey,
		queryFn: async (): Promise<EventListingSchema[]> => {
			const res = await eventintegrationsListListings({ path: { event_id: eventId } });
			if (res.error || !res.data) throw new Error(m['listings.loadFailed']());
			const pending = hasPendingLink(res.data);
			if (pending && pendingSinceRef === null) pendingSinceRef = Date.now();
			if (!pending) pendingSinceRef = null;
			return res.data;
		},
		// Poll only while a push is in flight; slow down after ten minutes.
		refetchInterval: (query) =>
			listingsRefetchInterval(query.state.data, pendingSinceRef, Date.now()),
		refetchIntervalInBackground: false
	}));

	// Re-evaluated on every fetch, which is at least every 30 s while pending.
	const pendingSlow = $derived.by(() => {
		void listings.dataUpdatedAt;
		return pendingSinceRef !== null && Date.now() - pendingSinceRef >= PENDING_SLOW_AFTER_MS;
	});

	function refresh() {
		void queryClient.invalidateQueries({ queryKey });
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
			level={3}
		/>
	{:else if listings.data}
		{#each listings.data as listing (listing.provider)}
			<ListingCard
				{organizationSlug}
				{eventId}
				{listing}
				{event}
				{isOwner}
				{pendingSlow}
				onChanged={refresh}
			/>
		{/each}
	{/if}
</div>
