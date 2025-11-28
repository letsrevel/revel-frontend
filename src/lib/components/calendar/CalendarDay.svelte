<script lang="ts">
	import type { EventInListSchema } from '$lib/api/generated/types.gen';
	import { formatCalendarDate } from '$lib/utils/calendar';
	import { Loader2 } from 'lucide-svelte';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		date: Date;
		dayEvents: EventInListSchema[];
		isCurrentMonth: boolean;
		isToday: boolean;
		isLoading?: boolean;
		onclick?: (event: MouseEvent) => void;
		onEventClick?: (event: EventInListSchema) => void;
	}

	let {
		date,
		dayEvents,
		isCurrentMonth,
		isToday,
		isLoading = false,
		onclick,
		onEventClick
	}: Props = $props();

	const maxVisibleEvents = 3;
	let visibleEvents = $derived(dayEvents.slice(0, maxVisibleEvents));
	let hiddenCount = $derived(Math.max(0, dayEvents.length - maxVisibleEvents));
</script>

<div
	class="calendar-day"
	class:calendar-day--current-month={isCurrentMonth}
	class:calendar-day--other-month={!isCurrentMonth}
	class:calendar-day--today={isToday}
	class:calendar-day--has-events={dayEvents.length > 0}
	role="gridcell"
	aria-label="{formatCalendarDate(date, 'long')}, {dayEvents.length} {m['calendar.events']()}"
>
	<div class="calendar-day-header">
		<span class="calendar-day-number">{formatCalendarDate(date, 'short')}</span>
		{#if isLoading}
			<Loader2 class="h-3 w-3 animate-spin text-muted-foreground" aria-hidden="true" />
		{/if}
	</div>

	{#if dayEvents.length > 0}
		<div class="calendar-day-events">
			{#each visibleEvents as event}
				<button
					type="button"
					class="calendar-event-badge"
					onclick={(e) => {
						onEventClick?.(event);
					}}
					aria-label={event.name}
				>
					<span class="calendar-event-dot" aria-hidden="true"></span>
					<span class="calendar-event-name">{event.name}</span>
				</button>
			{/each}

			{#if hiddenCount > 0}
				<span class="calendar-more-events" aria-label="{hiddenCount} {m['calendar.more_events']()}">
					+{hiddenCount}
					{m['calendar.more']()}
				</span>
			{/if}
		</div>
	{/if}
</div>

<style>
	.calendar-day {
		@apply relative min-h-20 w-full border-r border-border p-2 text-left transition-colors last:border-r-0 hover:bg-accent focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2;
		@apply md:min-h-24 md:p-3;
	}

	.calendar-day--current-month {
		@apply bg-background;
	}

	.calendar-day--other-month {
		@apply bg-muted/30 text-muted-foreground;
	}

	.calendar-day--today {
		@apply bg-primary/5;
	}

	.calendar-day--has-events {
		@apply cursor-pointer;
	}

	.calendar-day-header {
		@apply mb-1 flex items-center justify-between;
	}

	.calendar-day-number {
		@apply inline-flex h-6 w-6 items-center justify-center rounded-full text-sm font-medium;
	}

	.calendar-day--today .calendar-day-number {
		@apply bg-primary text-primary-foreground;
	}

	.calendar-day-events {
		@apply flex flex-col gap-1;
	}

	.calendar-event-badge {
		@apply flex w-full items-center gap-1 overflow-hidden rounded px-1 py-0.5 text-left text-xs transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring;
	}

	.calendar-event-dot {
		@apply h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary;
	}

	.calendar-event-name {
		@apply truncate;
	}

	.calendar-more-events {
		@apply px-1 text-xs text-muted-foreground;
	}
</style>
