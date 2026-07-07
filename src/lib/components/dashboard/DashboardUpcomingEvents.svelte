<script lang="ts">
	import { resolve } from '$app/paths';
	import { EventCard } from '$lib/components/events';
	import EventCardSkeleton from '$lib/components/common/EventCardSkeleton.svelte';
	import { Calendar, Sparkles, ChevronRight } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages.js';
	import type { EventInListSchema } from '$lib/api/generated/types.gen';

	interface Props {
		upcomingEvents: EventInListSchema[];
		isLoading: boolean;
	}
	let { upcomingEvents, isLoading }: Props = $props();
</script>

<!-- Upcoming Events Section -->
<section aria-labelledby="upcoming-events-heading">
	<div class="mb-4 flex items-center justify-between">
		<h2 id="upcoming-events-heading" class="flex items-center gap-2 text-xl font-semibold">
			<Sparkles class="h-5 w-5 text-primary" aria-hidden="true" />
			<span>{m['dashboard.sections.discoverEvents']()}</span>
		</h2>
		{#if upcomingEvents.length > 0}
			<a
				href={resolve('/(public)/events', {})}
				class="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
			>
				<span>{m['dashboard.activityCards.seeAll']()}</span>
				<ChevronRight class="h-4 w-4" aria-hidden="true" />
			</a>
		{/if}
	</div>

	{#if isLoading}
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each Array(6) as _, i (i)}
				<EventCardSkeleton />
			{/each}
		</div>
	{:else if upcomingEvents.length === 0}
		<!-- Empty State -->
		<div class="rounded-lg border bg-card p-8 text-center">
			<Calendar class="mx-auto mb-4 h-12 w-12 text-muted-foreground" aria-hidden="true" />
			<h3 class="mb-2 text-lg font-semibold">
				{m['dashboard.emptyStates.noEventsAvailable']()}
			</h3>
			<p class="mb-4 text-sm text-muted-foreground">
				{m['dashboard.emptyStates.noEventsHint']()}
			</p>
		</div>
	{:else}
		<!-- Event Cards -->
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each upcomingEvents.slice(0, 6) as event (event.id)}
				<EventCard {event} />
			{/each}
		</div>
	{/if}
</section>
