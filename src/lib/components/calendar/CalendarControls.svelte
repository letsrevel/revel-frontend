<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		type CalendarView,
		formatMonthYear,
		formatWeekRange,
		getCurrentPeriod,
		getNextPeriod,
		getPreviousPeriod,
		buildCalendarParams
	} from '$lib/utils/calendar';
	import { Button } from '$lib/components/ui/button';
	import { ChevronLeft, ChevronRight, Calendar } from 'lucide-svelte';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		view: CalendarView;
		year: number;
		month: number;
		week: number;
		baseUrl: string;
		preserveParams?: string[];
	}

	let { view, year, month, week, baseUrl, preserveParams = [] }: Props = $props();

	// Display title based on view
	let displayTitle = $derived.by(() => {
		if (view === 'month') {
			return formatMonthYear(year, month);
		} else if (view === 'week') {
			return `${m['calendar.week_of']()} ${formatWeekRange(year, week)}`;
		} else {
			return String(year);
		}
	});

	function navigate(newView: CalendarView, newYear: number, newMonth: number, newWeek: number) {
		const url = new URL(window.location.href);
		const params = buildCalendarParams(newView, newYear, newMonth, newWeek);

		// Preserve specified params
		for (const param of preserveParams) {
			const value = url.searchParams.get(param);
			if (value) {
				params.set(param, value);
			}
		}

		goto(`${baseUrl}?${params.toString()}`, { keepFocus: true, replaceState: false });
	}

	function handlePrevious() {
		const prev = getPreviousPeriod(view, year, month, week);
		navigate(view, prev.year, prev.month, prev.week);
	}

	function handleNext() {
		const next = getNextPeriod(view, year, month, week);
		navigate(view, next.year, next.month, next.week);
	}

	function handleToday() {
		const current = getCurrentPeriod();
		navigate(view, current.year, current.month, current.week);
	}

	function handleViewChange(newView: CalendarView) {
		navigate(newView, year, month, week);
	}
</script>

<div class="calendar-controls">
	<!-- Mobile layout -->
	<div class="calendar-controls-mobile">
		<div class="calendar-controls-header">
			<h2 class="calendar-controls-title">{displayTitle}</h2>
			<div class="calendar-controls-nav">
				<Button
					variant="outline"
					size="icon"
					onclick={handlePrevious}
					aria-label={m['calendar.previous']()}
				>
					<ChevronLeft class="h-4 w-4" aria-hidden="true" />
				</Button>
				<Button variant="outline" size="sm" onclick={handleToday}>
					{m['calendar.today']()}
				</Button>
				<Button
					variant="outline"
					size="icon"
					onclick={handleNext}
					aria-label={m['calendar.next']()}
				>
					<ChevronRight class="h-4 w-4" aria-hidden="true" />
				</Button>
			</div>
		</div>

		<div
			class="calendar-controls-view-switcher"
			role="radiogroup"
			aria-label={m['calendar.view']()}
		>
			<Button
				variant={view === 'month' ? 'default' : 'outline'}
				size="sm"
				onclick={() => handleViewChange('month')}
				role="radio"
				aria-checked={view === 'month'}
			>
				<Calendar class="mr-2 h-4 w-4 md:hidden" aria-hidden="true" />
				{m['calendar.month']()}
			</Button>
			<Button
				variant={view === 'week' ? 'default' : 'outline'}
				size="sm"
				onclick={() => handleViewChange('week')}
				role="radio"
				aria-checked={view === 'week'}
			>
				<Calendar class="mr-2 h-4 w-4 md:hidden" aria-hidden="true" />
				{m['calendar.week_view']()}
			</Button>
			<Button
				variant={view === 'year' ? 'default' : 'outline'}
				size="sm"
				onclick={() => handleViewChange('year')}
				role="radio"
				aria-checked={view === 'year'}
			>
				<Calendar class="mr-2 h-4 w-4 md:hidden" aria-hidden="true" />
				{m['calendar.year']()}
			</Button>
		</div>
	</div>

	<!-- Desktop layout -->
	<div class="calendar-controls-desktop">
		<div class="calendar-controls-left">
			<div class="calendar-controls-nav">
				<Button
					variant="outline"
					size="icon"
					onclick={handlePrevious}
					aria-label={m['calendar.previous']()}
				>
					<ChevronLeft class="h-4 w-4" aria-hidden="true" />
				</Button>
				<Button
					variant="outline"
					size="icon"
					onclick={handleNext}
					aria-label={m['calendar.next']()}
				>
					<ChevronRight class="h-4 w-4" aria-hidden="true" />
				</Button>
			</div>
			<h2 class="calendar-controls-title">{displayTitle}</h2>
			<Button variant="outline" size="sm" onclick={handleToday}>
				{m['calendar.today']()}
			</Button>
		</div>

		<div
			class="calendar-controls-view-switcher"
			role="radiogroup"
			aria-label={m['calendar.view']()}
		>
			<Button
				variant={view === 'month' ? 'default' : 'outline'}
				size="sm"
				onclick={() => handleViewChange('month')}
				role="radio"
				aria-checked={view === 'month'}
			>
				{m['calendar.month']()}
			</Button>
			<Button
				variant={view === 'week' ? 'default' : 'outline'}
				size="sm"
				onclick={() => handleViewChange('week')}
				role="radio"
				aria-checked={view === 'week'}
			>
				{m['calendar.week_view']()}
			</Button>
			<Button
				variant={view === 'year' ? 'default' : 'outline'}
				size="sm"
				onclick={() => handleViewChange('year')}
				role="radio"
				aria-checked={view === 'year'}
			>
				{m['calendar.year']()}
			</Button>
		</div>
	</div>
</div>

<style>
	.calendar-controls {
		@apply mb-6;
	}

	/* Mobile layout */
	.calendar-controls-mobile {
		@apply flex flex-col gap-4 md:hidden;
	}

	.calendar-controls-header {
		@apply flex items-center justify-between gap-4;
	}

	.calendar-controls-title {
		@apply flex-1 text-xl font-semibold;
	}

	.calendar-controls-nav {
		@apply flex items-center gap-2;
	}

	.calendar-controls-view-switcher {
		@apply flex gap-2;
	}

	/* Desktop layout */
	.calendar-controls-desktop {
		@apply hidden items-center justify-between md:flex;
	}

	.calendar-controls-left {
		@apply flex items-center gap-4;
	}
</style>
