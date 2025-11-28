<script lang="ts">
	import type { EventInListSchema } from '$lib/api/generated/types.gen';
	import { formatCalendarDate, getEventsForDay, isToday } from '$lib/utils/calendar';
	import { Clock, MapPin, Loader2 } from 'lucide-svelte';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		year: number;
		week: number;
		days: Date[];
		events: EventInListSchema[];
		isLoading?: boolean;
		onEventClick?: (event: EventInListSchema) => void;
	}

	let { year, week, days, events, isLoading = false, onEventClick }: Props = $props();

	// Get events for each day
	function getEventsByDay(day: Date) {
		return getEventsForDay(events, day).sort((a, b) => {
			return new Date(a.start).getTime() - new Date(b.start).getTime();
		});
	}

	function formatEventTime(dateString: string): string {
		const date = new Date(dateString);
		return date.toLocaleTimeString(undefined, {
			hour: 'numeric',
			minute: '2-digit',
			hour12: true
		});
	}
</script>

<div class="week-view" role="region" aria-label="{m['calendar.week']()} {week}, {year}">
	{#if isLoading}
		<div class="flex items-center justify-center py-12">
			<Loader2 class="h-8 w-8 animate-spin text-muted-foreground" aria-hidden="true" />
			<span class="sr-only">{m['calendar.loading']()}</span>
		</div>
	{:else}
		<div class="week-grid">
			{#each days as day}
				{@const dayEvents = getEventsByDay(day)}
				{@const isTodayDate = isToday(day)}

				<div class="week-day" class:week-day--today={isTodayDate}>
					<div class="week-day-header">
						<div class="week-day-date">
							<span class="week-day-weekday">
								{day.toLocaleDateString(undefined, { weekday: 'short' })}
							</span>
							<span class="week-day-number" class:week-day-number--today={isTodayDate}>
								{formatCalendarDate(day, 'short')}
							</span>
						</div>
					</div>

					<div class="week-day-events">
						{#if dayEvents.length === 0}
							<p class="week-day-empty">{m['calendar.no_events']()}</p>
						{:else}
							{#each dayEvents as event}
								<button
									type="button"
									class="week-event-card"
									onclick={() => onEventClick?.(event)}
									aria-label="{event.name} at {formatEventTime(event.start)}"
								>
									<div class="week-event-time">
										<Clock class="h-3 w-3" aria-hidden="true" />
										<span>{formatEventTime(event.start)}</span>
									</div>
									<h3 class="week-event-title">{event.name}</h3>
									{#if event.city?.name}
										<div class="week-event-location">
											<MapPin class="h-3 w-3" aria-hidden="true" />
											<span>{event.city.name}</span>
										</div>
									{/if}
								</button>
							{/each}
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.week-view {
		@apply w-full;
	}

	.week-grid {
		@apply grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-7 lg:gap-2;
	}

	.week-day {
		@apply flex flex-col rounded-lg border border-border bg-background;
	}

	.week-day--today {
		@apply border-primary bg-primary/5;
	}

	.week-day-header {
		@apply border-b border-border p-3;
	}

	.week-day-date {
		@apply flex items-center gap-2;
	}

	.week-day-weekday {
		@apply text-sm font-medium text-muted-foreground;
	}

	.week-day-number {
		@apply flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold;
	}

	.week-day-number--today {
		@apply bg-primary text-primary-foreground;
	}

	.week-day-events {
		@apply flex flex-col gap-2 p-3;
	}

	.week-day-empty {
		@apply text-center text-sm text-muted-foreground;
	}

	.week-event-card {
		@apply w-full rounded-md border border-border bg-card p-2 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2;
	}

	.week-event-time {
		@apply mb-1 flex items-center gap-1 text-xs text-muted-foreground;
	}

	.week-event-title {
		@apply mb-1 text-sm font-medium leading-tight;
	}

	.week-event-location {
		@apply flex items-center gap-1 text-xs text-muted-foreground;
	}
</style>
