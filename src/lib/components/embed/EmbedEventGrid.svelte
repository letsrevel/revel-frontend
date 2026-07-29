<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import EventCard from '$lib/components/events/EventCard.svelte';
	import type { EventInListSchema } from '$lib/api/generated/types.gen';
	import type { EmbedPrice } from '$lib/embed/pricing';
	import { buildEmbedLink, eventPath, type EmbedLinkContext } from '$lib/embed/links';
	import { CalendarOff } from '@lucide/svelte';

	interface Props {
		events: EventInListSchema[];
		/** Cheapest entry price per event id; missing entries render no price. */
		prices?: Record<string, EmbedPrice>;
		links: EmbedLinkContext;
		/** Labelled-by id of the surrounding heading, for the list landmark. */
		labelledBy?: string;
	}

	const { events, prices = {}, links, labelledBy }: Props = $props();
</script>

{#if events.length === 0}
	<div class="flex flex-col items-center gap-2 px-4 py-10 text-center">
		<CalendarOff class="h-8 w-8 text-muted-foreground" aria-hidden="true" />
		<p class="text-sm font-medium">{m['embed.noEvents']()}</p>
		<p class="text-xs text-muted-foreground">{m['embed.noEventsHint']()}</p>
	</div>
{:else}
	<ul
		aria-labelledby={labelledBy}
		class="grid list-none grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3"
	>
		{#each events as event (event.id)}
			<li>
				<EventCard
					{event}
					lean
					target="_blank"
					class="h-full"
					priceFrom={prices[event.id] ?? null}
					href={buildEmbedLink(links.origin, eventPath(event.organization.slug, event.slug), links)}
				/>
			</li>
		{/each}
	</ul>
{/if}
