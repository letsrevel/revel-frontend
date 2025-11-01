<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { EventCard } from '$lib/components/events';
	import { EventFilters, MobileFilterSheet } from '$lib/components/events/filters';
	import { Calendar, Filter } from 'lucide-svelte';
	import {
		parseFilters,
		filtersToParams,
		clearFilters,
		countActiveFilters
	} from '$lib/utils/filters';
	import type { EventFilters as FilterState } from '$lib/utils/filters';
	import { generateEventsListingMeta } from '$lib/utils/seo';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	// Generate comprehensive meta tags for events listing page
	let metaTags = $derived(generateEventsListingMeta($page.url.origin));

	// Derived state from server load data
	let events = $derived(data.events);
	let totalCount = $derived(data.totalCount);
	let currentPage = $derived(data.page);
	let pageSize = $derived(data.pageSize);
	let error = $derived(data.error);

	// Parse current filters from URL
	let currentFilters = $derived(parseFilters($page.url.searchParams));

	// Mobile filter sheet state
	let isMobileFilterOpen = $state(false);

	// Calculate pagination info
	let totalPages = $derived(Math.ceil(totalCount / pageSize));
	let hasNextPage = $derived(currentPage < totalPages);
	let hasPrevPage = $derived(currentPage > 1);
	let showingFrom = $derived((currentPage - 1) * pageSize + 1);
	let showingTo = $derived(Math.min(currentPage * pageSize, totalCount));

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
		goto(`/events?${params}`, { replaceState: false, keepFocus: true });
	}

	function handleClearFilters(): void {
		const params = filtersToParams(clearFilters());
		goto(`/events${params.toString() ? `?${params}` : ''}`, { replaceState: false });
	}

	function handleOpenMobileFilters(): void {
		isMobileFilterOpen = true;
	}

	function handleCloseMobileFilters(): void {
		isMobileFilterOpen = false;
	}
</script>

<svelte:head>
	<title>{metaTags.title}</title>
	<meta name="description" content={metaTags.description} />
	{#if metaTags.canonical}
		<link rel="canonical" href={metaTags.canonical} />
	{/if}

	<!-- Open Graph -->
	<meta property="og:type" content={metaTags.ogType || 'website'} />
	<meta property="og:title" content={metaTags.ogTitle || metaTags.title} />
	<meta property="og:description" content={metaTags.ogDescription || metaTags.description} />
	<meta property="og:url" content={metaTags.ogUrl || $page.url.href} />
	<meta property="og:site_name" content="Revel" />
	<meta property="og:locale" content="en_US" />

	<!-- Twitter Card -->
	<meta name="twitter:card" content={metaTags.twitterCard || 'summary_large_image'} />
	<meta name="twitter:title" content={metaTags.twitterTitle || metaTags.title} />
	<meta name="twitter:description" content={metaTags.twitterDescription || metaTags.description} />

	<!-- Additional SEO meta tags -->
	<meta name="robots" content="index, follow" />
	<meta
		name="keywords"
		content="events, community, discover, browse, concerts, workshops, meetups"
	/>
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<!-- Skip to content link for keyboard navigation -->
	<a
		href="#events-content"
		class="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
	>
		{m['browse.events_skipTo']()}
	</a>

	<!-- Page Header -->
	<header class="mb-8">
		<h1 class="text-4xl font-bold">{m['browse.events_title']()}</h1>
		{#if !error && totalCount > 0}
			<p class="mt-2 text-muted-foreground">
				{m['browse.events_count']({
					count: totalCount,
					eventPlural: totalCount === 1 ? m['common.plurals_event']() : m['common.plurals_events']()
				})}
			</p>
		{/if}
	</header>

	<!-- Main Content: Sidebar + Event Grid -->
	<div class="flex flex-col gap-8 lg:flex-row">
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
			{#if error}
				<!-- Error State -->
				<div
					class="rounded-lg border border-destructive bg-destructive/10 p-8 text-center"
					role="alert"
					aria-live="polite"
				>
					<p class="font-semibold text-destructive">{error}</p>
					<p class="mt-2 text-sm text-muted-foreground">
						{m['common.errors_refreshPage']()}
					</p>
				</div>
			{:else if events.length === 0}
				<!-- Empty State -->
				<div class="rounded-lg border bg-muted/50 p-12 text-center">
					<Calendar class="mx-auto mb-4 h-16 w-16 text-muted-foreground" aria-hidden="true" />
					<h2 class="text-2xl font-semibold">{m['browse.events_noEventsFound']()}</h2>
					<p class="mt-2 text-muted-foreground">
						{#if currentFilters.search || currentFilters.cityId || currentFilters.tags}
							{m['browse.events_tryAdjustingFilters']()}
						{:else}
							{m['browse.events_noUpcomingEvents']()}
						{/if}
					</p>
					{#if currentFilters.search || currentFilters.cityId || currentFilters.tags}
						<button
							type="button"
							onclick={handleClearFilters}
							class="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
						>
							{m['browse.events_clearFilters']()}
						</button>
					{/if}
				</div>
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
						aria-label="Pagination"
					>
						<!-- Results info -->
						<p class="text-sm text-muted-foreground" aria-live="polite">
							{m['common.pagination_showing']()} {showingFrom}–{showingTo} {m['common.pagination_of']()} {totalCount} {m['common.plurals_events']()}
						</p>

						<!-- Pagination controls -->
						<div class="flex items-center gap-2">
							{#if hasPrevPage}
								<a
									href="?{filtersToParams({ ...currentFilters, page: currentPage - 1 })}"
									class="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
									aria-label="Go to previous page"
								>
									{m['common.pagination_previous']()}
								</a>
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
								{m['common.pagination_page']()} {currentPage} {m['common.pagination_of']()} {totalPages}
							</span>

							{#if hasNextPage}
								<a
									href="?{filtersToParams({ ...currentFilters, page: currentPage + 1 })}"
									class="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
									aria-label="Go to next page"
								>
									{m['common.pagination_next']()}
								</a>
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
</div>
