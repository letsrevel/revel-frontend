<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { resolve } from '$app/paths';
	import { ChevronRight } from '@lucide/svelte';
	import type { EventInListSchema } from '$lib/api/generated/types.gen';
	import SectionHeader from '$lib/components/common/SectionHeader.svelte';
	import EventStatusBadge from '$lib/components/events/EventStatusBadge.svelte';
	import { formatTimeOfDay } from '$lib/utils/date';
	import { formatAgendaDate } from '$lib/utils/calendar';

	interface Props {
		events: EventInListSchema[];
		orgSlug: string;
	}

	const { events, orgSlug }: Props = $props();
</script>

{#if events.length > 0}
	<section class="space-y-3" aria-labelledby="coming-up-heading">
		{#snippet allEventsLink()}
			<a
				href={resolve('/(auth)/org/[slug]/admin/events', { slug: orgSlug })}
				class="rounded-sm text-sm font-bold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			>
				{m['orgAdmin.dashboard.comingUp.allEvents']()}
			</a>
		{/snippet}
		<SectionHeader
			id="coming-up-heading"
			title={m['orgAdmin.dashboard.comingUp.heading']()}
			actions={allEventsLink}
		/>

		<ol class="divide-y divide-border rounded-lg border border-border bg-card">
			{#each events as event (event.id)}
				{@const count = event.attendee_count ?? 0}
				<li class="first:[&>a]:rounded-t-lg last:[&>a]:rounded-b-lg">
					<a
						href={resolve('/(auth)/org/[slug]/admin/events/[event_id]/edit', {
							slug: orgSlug,
							event_id: event.id
						})}
						class="grid grid-cols-[5.75rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
					>
						<span class="self-start sm:self-center">
							<span class="block whitespace-nowrap text-sm font-bold">
								{formatAgendaDate(event.start, event.timezone)}
							</span>
							<span class="block text-xs text-muted-foreground">
								{formatTimeOfDay(event.start, event.timezone)}
							</span>
						</span>
						<!-- Mobile: the name wraps and capacity drops beneath it (a one-line
						     truncate left "Contempor…" at 390px). sm+: one line, capacity right. -->
						<span
							class="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
						>
							<span class="min-w-0">
								<span class="block font-bold sm:truncate">{event.name}</span>
								{#if event.venue}
									<span class="block truncate text-xs text-muted-foreground"
										>{event.venue.name}</span
									>
								{/if}
							</span>
							<span class="shrink-0">
								{#if event.status !== 'open' || event.is_full}
									<EventStatusBadge {event} />
								{:else if event.max_attendees}
									<span class="sr-only">
										{m['orgAdmin.dashboard.nextUp.going']({ count, max: event.max_attendees })}
									</span>
									<span class="text-sm tabular-nums text-muted-foreground" aria-hidden="true">
										{count} / {event.max_attendees}
									</span>
								{:else}
									<span class="text-sm tabular-nums text-muted-foreground">
										{m['orgAdmin.dashboard.nextUp.goingNoCap']({ count })}
									</span>
								{/if}
							</span>
						</span>
						<ChevronRight class="h-4 w-4 text-muted-foreground" aria-hidden="true" />
					</a>
				</li>
			{/each}
		</ol>
	</section>
{/if}
