<script lang="ts">
	import type { EventInListSchema } from '$lib/api/generated/types.gen';
	import { goto } from '$app/navigation';
	import { formatMonthYear } from '$lib/utils/calendar';
	import { Calendar, Loader2 } from 'lucide-svelte';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		year: number;
		months: number[];
		events: EventInListSchema[];
		isLoading?: boolean;
	}

	let { year, months, events, isLoading = false }: Props = $props();

	// Count events per month
	function getEventsInMonth(month: number): number {
		return events.filter((event) => {
			const eventDate = new Date(event.start);
			return eventDate.getFullYear() === year && eventDate.getMonth() === month - 1;
		}).length;
	}

	function handleMonthClick(month: number) {
		const currentUrl = new URL(window.location.href);
		currentUrl.searchParams.set('view', 'month');
		currentUrl.searchParams.set('month', String(month));
		currentUrl.searchParams.set('year', String(year));
		goto(currentUrl.toString(), { keepFocus: true });
	}
</script>

<div class="year-view" role="region" aria-label="{m['calendar.year']()} {year}">
	{#if isLoading}
		<div class="flex items-center justify-center py-12">
			<Loader2 class="h-8 w-8 animate-spin text-muted-foreground" aria-hidden="true" />
			<span class="sr-only">{m['calendar.loading']()}</span>
		</div>
	{:else}
		<div class="year-grid">
			{#each months as month}
				{@const eventCount = getEventsInMonth(month)}
				{@const monthName = formatMonthYear(year, month)}

				<button
					type="button"
					class="year-month-card"
					onclick={() => handleMonthClick(month)}
					aria-label="{monthName}, {eventCount} {m['calendar.events']()}"
				>
					<div class="year-month-header">
						<Calendar class="h-5 w-5 text-primary" aria-hidden="true" />
						<h3 class="year-month-name">{monthName.split(' ')[0]}</h3>
					</div>

					<div class="year-month-events">
						<span class="year-month-count">{eventCount}</span>
						<span class="year-month-label">
							{eventCount === 1 ? m['calendar.event']() : m['calendar.events']()}
						</span>
					</div>
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.year-view {
		@apply w-full;
	}

	.year-grid {
		@apply grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4;
	}

	.year-month-card {
		@apply flex flex-col items-center justify-center rounded-lg border border-border bg-card p-6 transition-all hover:border-primary hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2;
	}

	.year-month-header {
		@apply mb-4 flex flex-col items-center gap-2;
	}

	.year-month-name {
		@apply text-lg font-semibold;
	}

	.year-month-events {
		@apply flex flex-col items-center;
	}

	.year-month-count {
		@apply text-3xl font-bold text-primary;
	}

	.year-month-label {
		@apply text-sm text-muted-foreground;
	}
</style>
