<script lang="ts">
	import type { PageData } from './$types';
	import type { EventInListSchema } from '$lib/api/generated/types.gen';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import { EventCard } from '$lib/components/events';
	import { EventFilters, MobileFilterSheet } from '$lib/components/events/filters';
	import { CalendarView, CalendarControls, EventModal } from '$lib/components/calendar';
	import { Calendar, Filter, List } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { createQuery } from '@tanstack/svelte-query';
	import { eventpublicdiscoveryCalendarEvents } from '$lib/api/generated/sdk.gen';
	import {
		parseFilters,
		filtersToParams,
		clearFilters,
		countActiveFilters
	} from '$lib/utils/filters';
	import type { EventFilters as FilterState } from '$lib/utils/filters';
	import { parseCalendarParams, getCurrentPeriod } from '$lib/utils/calendar';
	import PageHeader from '$lib/components/common/PageHeader.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import { SeoHead } from '$lib/seo';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		data: PageData;
	}

	const { data }: Props = $props();

	// Derived state from server load data
	const events = $derived(data.events);
	const totalCount = $derived(data.totalCount);
	const currentPage = $derived(data.page);
	const pageSize = $derived(data.pageSize);
	const error = $derived(data.error);

	// Parse current filters from URL
	const currentFilters = $derived(parseFilters($page.url.searchParams));

	// View mode (list or calendar)
	const viewMode = $derived<'list' | 'calendar'>(
		($page.url.searchParams.get('viewMode') as 'list' | 'calendar') || 'list'
	);

	// Calendar state
	const calendarParams = $derived(parseCalendarParams($page.url.searchParams));
	let selectedEvent = $state<EventInListSchema | null>(null);

	// Calendar data query
	const calendarQuery = createQuery(() => ({
		queryKey: [
			'events-calendar',
			calendarParams.view,
			calendarParams.year,
			calendarParams.month,
			calendarParams.week,
			currentFilters
		],
		queryFn: async () => {
			const result = await eventpublicdiscoveryCalendarEvents({
				query: {
					week: calendarParams.view === 'week' ? calendarParams.week : undefined,
					month: calendarParams.view === 'month' ? calendarParams.month : undefined,
					year: calendarParams.year,
					// Apply filters
					city_id: currentFilters.cityId,
					organization: currentFilters.organizationId,
					event_type: currentFilters.eventType,
					visibility: currentFilters.visibility,
					tags: currentFilters.tags,
					requires_ticket:
						currentFilters.ticketType === 'ticketed'
							? true
							: currentFilters.ticketType === 'free'
								? false
								: undefined
				}
			});

			if (result.error) {
				throw new Error('Failed to load calendar events');
			}

			return result.data || [];
		},
		enabled: viewMode === 'calendar'
	}));

	const calendarEvents = $derived(calendarQuery.data || []);
	const isCalendarLoading = $derived(calendarQuery.isLoading);

	/**
	 * "N events found", or the calendar period's tally — `undefined` when there is
	 * nothing to count, which is what `PageHeader` reads as "no subtitle".
	 */
	const countLabel = $derived.by((): string | undefined => {
		if (error) return undefined;
		if (viewMode === 'list') {
			if (totalCount <= 0) return undefined;
			return m['browse.events_count']({
				count: totalCount,
				eventPlural: totalCount === 1 ? m['common.plurals_event']() : m['common.plurals_events']()
			});
		}
		const count = calendarEvents.length;
		if (count <= 0) return undefined;
		return `${count} ${count === 1 ? m['common.plurals_event']() : m['common.plurals_events']()}`;
	});

	// Mobile filter sheet state
	let isMobileFilterOpen = $state(false);

	// Calculate pagination info
	const totalPages = $derived(Math.ceil(totalCount / pageSize));
	const hasNextPage = $derived(currentPage < totalPages);
	const hasPrevPage = $derived(currentPage > 1);
	const showingFrom = $derived((currentPage - 1) * pageSize + 1);
	const showingTo = $derived(Math.min(currentPage * pageSize, totalCount));

	// Filter update handlers
	function handleUpdateFilters(updates: Partial<FilterState>): void {
		const newFilters = { ...currentFilters, ...updates };

		// Reset to page 1 when filters change (not pagination)
		const nonPaginationChanged = Object.keys(updates).some(
			(key) => key !== 'page' && key !== 'pageSize'
		);
		if (nonPaginationChanged) {
			newFilters.page = 1;
		}

		const params = filtersToParams(newFilters);
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve() validates the route id; the appended query string cannot be expressed through resolve()
		goto(`${resolve('/(public)/events', {})}?${params}`, { replaceState: false, keepFocus: true });
	}

	function handleClearFilters(): void {
		const params = filtersToParams(clearFilters());
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve() validates the route id; the appended query string cannot be expressed through resolve()
		goto(`${resolve('/(public)/events', {})}${params.toString() ? `?${params}` : ''}`, {
			replaceState: false
		});
	}

	function handleOpenMobileFilters(): void {
		isMobileFilterOpen = true;
	}

	function handleCloseMobileFilters(): void {
		isMobileFilterOpen = false;
	}

	function toggleViewMode(): void {
		const newMode = viewMode === 'list' ? 'calendar' : 'list';
		const url = new URL(window.location.href);
		url.searchParams.set('viewMode', newMode);

		// If switching to calendar, add default calendar params
		if (newMode === 'calendar' && !url.searchParams.has('view')) {
			const current = getCurrentPeriod();
			url.searchParams.set('view', 'month');
			url.searchParams.set('year', String(current.year));
			url.searchParams.set('month', String(current.month));
			url.searchParams.set('week', String(current.week));
		}

		// eslint-disable-next-line svelte/no-navigation-without-resolve -- target is derived from the live page URL (base path already applied); resolve() cannot express search params
		goto(url.toString(), { keepFocus: true, replaceState: false });
	}

	function handleEventClick(event: EventInListSchema): void {
		selectedEvent = event;
	}

	function handleCloseEventModal(): void {
		selectedEvent = null;
	}
</script>

<SeoHead config={data.seo} />

<div class="bg-background">
	<!--
		Color-block header band (uplift, spec §9). The same full-strength
		`bg-secondary` poster panel the questionnaire routes opened on — an
		audit-enforced pair in both modes, so it is a real poster surface that
		still respects the light/dark axis. Deliberately SHALLOWER than a detail
		page's: a listing is a work surface, the band is only its entrance, and
		the toolbar + grid below must stay above the fold on a phone.

		No sticker chip here by the sticker-chip rule (spec §9): discovery has no
		organization to speak for, and the Revel mark is never filler.
	-->
	<section class="bg-secondary text-secondary-foreground">
		<div class="container mx-auto px-4 pb-16 pt-8">
			<!-- Skip to content link for keyboard navigation -->
			<a
				href="#events-content"
				class="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
			>
				{m['browse.events_skipTo']()}
			</a>

			<!-- Page Header. The result count rides `subtitle`, exactly as /organizations
			     does, rather than a paragraph pulled back under the header with a
			     negative margin that breaks the moment the header wraps. -->
			<PageHeader
				volume="poster"
				onBand
				kicker={m['browse.events_kicker']()}
				title={m['browse.events_title']()}
				subtitle={countLabel}
			>
				{#snippet actions()}
					<!-- View Toggle. Left on the stock `outline` chrome on purpose: its
					     `bg-background` reads as a light control chip against the band
					     and keeps the audited foreground pair, where a transparent
					     override would have to re-derive contrast per mode. -->
					<Button
						variant="outline"
						size="sm"
						onclick={toggleViewMode}
						class="flex items-center gap-2"
					>
						{#if viewMode === 'list'}
							<Calendar class="h-4 w-4" aria-hidden="true" />
							{m['calendar.calendar_view']()}
						{:else}
							<List class="h-4 w-4" aria-hidden="true" />
							{m['calendar.list_view']()}
						{/if}
					</Button>
				{/snippet}
			</PageHeader>
		</div>
	</section>

	<!--
		Body on plain `--background`, pulled up over the band's bottom edge — the
		merged questionnaire page's arrangement, not the event page's tinted wash.
		Both were tried: a `bg-secondary/55` wash under a `bg-secondary` band lands
		within 5 points of lightness of it in light mode, so the band stops reading
		as a colour BLOCK and the page becomes one flat field. The event page can
		afford the wash because its band is the mode-inert poster-purple ribbon,
		which is dark enough that the step is unmissable. Here the separation has
		to come from the band itself, and the float comes from the cards:
		`shadow-poster` over paper, overlapping the cut.
	-->
	<div class="pb-16">
		<div class="container mx-auto px-4">
			<!-- Main Content: Sidebar + Event Grid -->
			<div class="-mt-8 flex flex-col gap-8 lg:flex-row">
				<!-- Filter Sidebar (Desktop) -->
				<div class="hidden lg:block lg:w-80 lg:shrink-0">
					<div class="sticky top-8">
						<EventFilters
							filters={currentFilters}
							onUpdateFilters={handleUpdateFilters}
							onClearFilters={handleClearFilters}
						/>
					</div>
				</div>

				<!-- Event Content -->
				<div id="events-content" class="flex-1">
					{#if viewMode === 'list'}
						<!-- List View -->
						{#if error}
							<!-- Error State. `bg-card` rather than the old `bg-destructive/10`
						     wash: the panel underneath is itself tinted now, so a second
						     alpha would stack two composites under `text-destructive`. On
						     card it is the audited token pair, and the doubled destructive
						     edge carries the alarm. -->
							<div
								class="rounded-lg border-2 border-destructive bg-card p-8 text-center shadow-poster"
								role="alert"
								aria-live="polite"
							>
								<p class="font-semibold text-destructive">{error}</p>
								<p class="mt-2 text-sm text-muted-foreground">
									{m['common.errors_refreshPage']()}
								</p>
							</div>
						{:else if events.length === 0}
							<!-- level 2: the page's only other heading is the h1 above. -->
							<EmptyState
								level={2}
								icon={Calendar}
								title={m['browse.events_noEventsFound']()}
								body={currentFilters.search || currentFilters.cityId || currentFilters.tags
									? m['browse.events_tryAdjustingFilters']()
									: m['browse.events_noUpcomingEvents']()}
							>
								{#snippet action()}
									{#if currentFilters.search || currentFilters.cityId || currentFilters.tags}
										<Button onclick={handleClearFilters}>
											{m['browse.events_clearFilters']()}
										</Button>
									{/if}
								{/snippet}
							</EmptyState>
						{:else}
							<!-- Event Grid -->
							<div
								class="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3"
								role="list"
								aria-label={m['browse.events_listingsLabel']()}
							>
								{#each events as event, index (`${event.id}-${index}`)}
									<div role="listitem">
										<EventCard {event} variant="standard" />
									</div>
								{/each}
							</div>

							<!-- Pagination -->
							{#if totalPages > 1}
								<nav
									class="mt-12 flex flex-col items-center justify-between gap-4 sm:flex-row"
									aria-label={m['eventsListPage.paginationLabel']()}
								>
									<!-- Results info -->
									<p class="text-sm text-muted-foreground" aria-live="polite">
										{m['common.pagination_showing']()}
										{showingFrom}–{showingTo}
										{m['common.pagination_of']()}
										{totalCount}
										{m['common.plurals_events']()}
									</p>

									<!-- Pagination controls -->
									<div class="flex items-center gap-2">
										{#if hasPrevPage}
											<!-- eslint-disable svelte/no-navigation-without-resolve -- same-route query-only update; the relative "?"+params string preserves the current pathname (resolve() cannot express search params) -->
											<a
												href="?{filtersToParams({ ...currentFilters, page: currentPage - 1 })}"
												class="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
												aria-label={m['eventsListPage.goToPreviousPage']()}
											>
												{m['common.pagination_previous']()}
											</a>
											<!-- eslint-enable svelte/no-navigation-without-resolve -->
										{:else}
											<button
												type="button"
												disabled
												class="inline-flex h-10 cursor-not-allowed items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium opacity-50"
												aria-label={m['common.pagination_previousUnavailable']()}
											>
												{m['common.pagination_previous']()}
											</button>
										{/if}

										<!-- Page indicator -->
										<span
											class="inline-flex h-10 items-center justify-center px-4 text-sm font-medium"
											aria-current="page"
										>
											{m['common.pagination_page']()}
											{currentPage}
											{m['common.pagination_of']()}
											{totalPages}
										</span>

										{#if hasNextPage}
											<!-- eslint-disable svelte/no-navigation-without-resolve -- same-route query-only update; the relative "?"+params string preserves the current pathname (resolve() cannot express search params) -->
											<a
												href="?{filtersToParams({ ...currentFilters, page: currentPage + 1 })}"
												class="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
												aria-label={m['eventsListPage.goToNextPage']()}
											>
												{m['common.pagination_next']()}
											</a>
											<!-- eslint-enable svelte/no-navigation-without-resolve -->
										{:else}
											<button
												type="button"
												disabled
												class="inline-flex h-10 cursor-not-allowed items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium opacity-50"
												aria-label={m['common.pagination_nextUnavailable']()}
											>
												{m['common.pagination_next']()}
											</button>
										{/if}
									</div>
								</nav>
							{/if}
						{/if}
					{:else}
						<!-- Calendar View. Wrapped in a card surface: the grid draws no
					     background of its own, and its day cells tint with
					     `bg-muted/30` / `bg-primary/5` — over the page's new tinted
					     panel those would be a second stacked composite. On `bg-card`
					     they composite exactly as they always did, and the calendar
					     floats like every other block on this page. -->
						<div class="rounded-lg border-2 bg-card p-4 shadow-poster md:p-6">
							<CalendarControls
								view={calendarParams.view}
								year={calendarParams.year}
								month={calendarParams.month}
								week={calendarParams.week}
								baseUrl="/events"
								preserveParams={[
									'viewMode',
									'city_id',
									'organization',
									'event_type',
									'visibility',
									'tags',
									'ticket_type'
								]}
							/>

							<CalendarView
								view={calendarParams.view}
								year={calendarParams.year}
								month={calendarParams.month}
								week={calendarParams.week}
								events={calendarEvents}
								isLoading={isCalendarLoading}
								onEventClick={handleEventClick}
							/>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>

	<!-- Mobile Filter Button (Floating) -->
	<button
		type="button"
		onclick={handleOpenMobileFilters}
		class="fixed bottom-6 right-6 z-30 flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-lg transition-all hover:bg-primary/90 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 lg:hidden"
		aria-label={m['common.filters_openFilters']()}
	>
		<Filter class="h-4 w-4" aria-hidden="true" />
		{m['common.filters_filters']()}
		{#if countActiveFilters(currentFilters) > 0}
			<span
				class="rounded-full bg-primary-foreground px-2 py-0.5 text-xs font-medium text-primary"
				aria-label="{countActiveFilters(currentFilters)} {m['common.filters_activeFilters']()}"
			>
				{countActiveFilters(currentFilters)}
			</span>
		{/if}
	</button>

	<!-- Mobile Filter Sheet -->
	<MobileFilterSheet
		filters={currentFilters}
		{totalCount}
		isOpen={isMobileFilterOpen}
		onUpdateFilters={handleUpdateFilters}
		onClearFilters={handleClearFilters}
		onClose={handleCloseMobileFilters}
	/>

	<!-- Event Modal (for calendar clicks) -->
	<EventModal event={selectedEvent} open={selectedEvent !== null} onClose={handleCloseEventModal} />
</div>
