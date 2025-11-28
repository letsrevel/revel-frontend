<script lang="ts">
	import type { EventInListSchema } from '$lib/api/generated/types.gen';
	import {
		type CalendarView as ViewType,
		getMonthCalendarGrid,
		getWeekDays,
		getYearMonths,
		isToday,
		isInMonth,
		formatCalendarDate,
		getEventsForDay,
		groupEventsByDate
	} from '$lib/utils/calendar';
	import { CalendarDay, CalendarWeekView, CalendarYearView } from '$lib/components/calendar';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		view: ViewType;
		year: number;
		month: number;
		week: number;
		events: EventInListSchema[];
		onEventClick?: (event: EventInListSchema) => void;
		isLoading?: boolean;
	}

	let { view, year, month, week, events, onEventClick, isLoading = false }: Props = $props();

	// Group events by date for efficient lookup
	let eventsByDate = $derived(groupEventsByDate(events));

	// Get calendar data based on view
	let calendarGrid = $derived(view === 'month' ? getMonthCalendarGrid(year, month) : []);
	let weekDays = $derived(view === 'week' ? getWeekDays(year, week) : []);
	let yearMonths = $derived(view === 'year' ? getYearMonths(year) : []);

	// Weekday labels (Mon-Sun)
	const weekdayLabels = [
		m['calendar.monday_short'](),
		m['calendar.tuesday_short'](),
		m['calendar.wednesday_short'](),
		m['calendar.thursday_short'](),
		m['calendar.friday_short'](),
		m['calendar.saturday_short'](),
		m['calendar.sunday_short']()
	];
</script>

<div class="calendar-view" role="region" aria-label={m['calendar.label']()}>
	{#if view === 'month'}
		<!-- Month View -->
		<div class="calendar-grid">
			<!-- Weekday headers -->
			<div class="calendar-header" role="row">
				{#each weekdayLabels as label, index (index)}
					<div class="calendar-header-cell" role="columnheader">
						<span class="md:hidden">{label.charAt(0)}</span>
						<span class="hidden md:inline">{label}</span>
					</div>
				{/each}
			</div>

			<!-- Calendar days -->
			<div class="calendar-body">
				{#each calendarGrid as weekRow, weekIndex (weekIndex)}
					<div class="calendar-week" role="row">
						{#each weekRow as day (day.getTime())}
							{@const dayEvents = getEventsForDay(events, day)}
							{@const isCurrentMonth = isInMonth(day, year, month)}
							{@const isTodayDate = isToday(day)}

							<CalendarDay
								date={day}
								{dayEvents}
								{isCurrentMonth}
								isToday={isTodayDate}
								{isLoading}
								onclick={(event) => {
									if (dayEvents.length === 1) {
										onEventClick?.(dayEvents[0]);
									}
								}}
								{onEventClick}
							/>
						{/each}
					</div>
				{/each}
			</div>
		</div>
	{:else if view === 'week'}
		<!-- Week View -->
		<CalendarWeekView {year} {week} days={weekDays} {events} {isLoading} {onEventClick} />
	{:else if view === 'year'}
		<!-- Year View -->
		<CalendarYearView {year} months={yearMonths} {events} {isLoading} />
	{/if}
</div>

<style>
	.calendar-view {
		@apply w-full;
	}

	.calendar-grid {
		@apply flex flex-col;
	}

	.calendar-header {
		@apply grid grid-cols-7 border-b border-border;
	}

	.calendar-header-cell {
		@apply p-2 text-center text-sm font-semibold text-muted-foreground;
	}

	.calendar-body {
		@apply flex flex-col;
	}

	.calendar-week {
		@apply grid grid-cols-7 border-b border-border last:border-b-0;
	}
</style>
