<script lang="ts">
	import { resolve } from '$app/paths';
	import { EventCard } from '$lib/components/events';
	import EventCardSkeleton from '$lib/components/common/EventCardSkeleton.svelte';
	import SectionHeader from '$lib/components/common/SectionHeader.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import { Calendar, ChevronRight } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages.js';
	import type { EventInListSchema } from '$lib/api/generated/types.gen';

	interface Props {
		upcomingEvents: EventInListSchema[];
		isLoading: boolean;
	}
	let { upcomingEvents, isLoading }: Props = $props();
</script>

{#snippet seeAllAction()}
	<a
		href={resolve('/(public)/events', {})}
		class="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
	>
		<span>{m['dashboard.activityCards.seeAll']()}</span>
		<ChevronRight class="h-4 w-4" aria-hidden="true" />
	</a>
{/snippet}

<!-- Upcoming Events Section. This can be the FIRST block below the dashboard's
     -mt-12 band pull-up (brand-new user: no activity cards, no "Your Events"
     section). It carries its own bg-card/border-2/shadow-poster wrapper so
     that whenever it lands there, the "See all" link's `text-primary` sits on
     an audited surface instead of the band itself (4.12:1, below AA). -->
<section aria-labelledby="upcoming-events-heading">
	<div class="mb-4 rounded-lg border-2 border-border bg-card p-4 shadow-poster sm:p-6">
		<SectionHeader
			title={m['dashboard.sections.discoverEvents']()}
			volume="celebration"
			id="upcoming-events-heading"
			actions={upcomingEvents.length > 0 ? seeAllAction : undefined}
		/>
	</div>

	{#if isLoading}
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each Array(6) as _, i (i)}
				<EventCardSkeleton />
			{/each}
		</div>
	{:else if upcomingEvents.length === 0}
		<!-- Empty State -->
		<EmptyState
			icon={Calendar}
			title={m['dashboard.emptyStates.noEventsAvailable']()}
			body={m['dashboard.emptyStates.noEventsHint']()}
			tone="neutral"
		/>
	{:else}
		<!-- Event Cards -->
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each upcomingEvents.slice(0, 6) as event (event.id)}
				<EventCard {event} />
			{/each}
		</div>
	{/if}
</section>
