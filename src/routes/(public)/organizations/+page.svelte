<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { OrganizationCard } from '$lib/components/organizations';
	import {
		OrganizationFilters,
		MobileOrganizationFilterSheet
	} from '$lib/components/organizations/filters';
	import { Users, Filter } from 'lucide-svelte';
	import {
		parseOrganizationFilters,
		organizationFiltersToParams,
		clearOrganizationFilters,
		countActiveOrganizationFilters
	} from '$lib/utils/organizationFilters';
	import type { OrganizationFilters as FilterState } from '$lib/utils/organizationFilters';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	// Derived state from server load data
	let organizations = $derived(data.organizations);
	let totalCount = $derived(data.totalCount);
	let currentPage = $derived(data.page);
	let pageSize = $derived(data.pageSize);
	let error = $derived(data.error);

	// Parse current filters from URL
	let currentFilters = $derived(parseOrganizationFilters($page.url.searchParams));

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

		const params = organizationFiltersToParams(newFilters);
		goto(`/organizations?${params}`, { replaceState: false, keepFocus: true });
	}

	function handleClearFilters(): void {
		const params = organizationFiltersToParams(clearOrganizationFilters());
		goto(`/organizations${params.toString() ? `?${params}` : ''}`, { replaceState: false });
	}

	function handleOpenMobileFilters(): void {
		isMobileFilterOpen = true;
	}

	function handleCloseMobileFilters(): void {
		isMobileFilterOpen = false;
	}
</script>

<svelte:head>
	<title>Discover Organizations - Revel</title>
	<meta
		name="description"
		content="Browse and discover community organizations on Revel. Find LGBTQ+, queer, and sex-positive organizations near you."
	/>
	<meta property="og:title" content="Discover Organizations - Revel" />
	<meta
		property="og:description"
		content="Browse and discover community organizations on Revel. Find LGBTQ+, queer, and sex-positive organizations near you."
	/>
	<meta property="og:type" content="website" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="Discover Organizations - Revel" />
	<meta
		name="twitter:description"
		content="Browse and discover community organizations on Revel. Find LGBTQ+, queer, and sex-positive organizations near you."
	/>
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<!-- Skip to content link for keyboard navigation -->
	<a
		href="#organizations-content"
		class="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
	>
		{m['browse.organizations_skipTo']()}
	</a>

	<!-- Page Header -->
	<header class="mb-8">
		<h1 class="text-4xl font-bold">{m['browse.organizations_title']()}</h1>
		{#if !error && totalCount > 0}
			<p class="mt-2 text-muted-foreground">
				{m['browse.organizations_count']({
					count: totalCount,
					organizationPlural:
						totalCount === 1
							? m['common.plurals_organization']()
							: m['common.plurals_organizations']()
				})}
			</p>
		{/if}
	</header>

	<!-- Main Content: Sidebar + Organization Grid -->
	<div class="flex flex-col gap-8 lg:flex-row">
		<!-- Filter Sidebar (Desktop) -->
		<div class="hidden lg:block lg:w-80 lg:shrink-0">
			<div class="sticky top-8">
				<OrganizationFilters
					filters={currentFilters}
					onUpdateFilters={handleUpdateFilters}
					onClearFilters={handleClearFilters}
				/>
			</div>
		</div>

		<!-- Organization Content -->
		<div id="organizations-content" class="flex-1">
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
			{:else if organizations.length === 0}
				<!-- Empty State -->
				<div class="rounded-lg border bg-muted/50 p-12 text-center">
					<Users class="mx-auto mb-4 h-16 w-16 text-muted-foreground" aria-hidden="true" />
					<h2 class="text-2xl font-semibold">{m['browse.organizations_noOrganizationsFound']()}</h2>
					<p class="mt-2 text-muted-foreground">
						{#if currentFilters.search || currentFilters.cityId || currentFilters.tags}
							{m['browse.organizations_tryAdjustingFilters']()}
						{:else}
							{m['browse.organizations_noOrganizations']()}
						{/if}
					</p>
					{#if currentFilters.search || currentFilters.cityId || currentFilters.tags}
						<button
							type="button"
							onclick={handleClearFilters}
							class="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
						>
							{m['browse.organizations_clearFilters']()}
						</button>
					{/if}
				</div>
			{:else}
				<!-- Organization Grid -->
				<div
					class="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3"
					role="list"
					aria-label={m['browse.organizations_listingsLabel']()}
				>
					{#each organizations as org, index (`${org.id}-${index}`)}
						<div role="listitem">
							<OrganizationCard organization={org} variant="standard" />
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
							{m['common.pagination_showing']()}
							{showingFrom}–{showingTo}
							{m['common.pagination_of']()}
							{totalCount}
							{m['common.plurals_organizations']()}
						</p>

						<!-- Pagination controls -->
						<div class="flex items-center gap-2">
							{#if hasPrevPage}
								<a
									href="?{organizationFiltersToParams({
										...currentFilters,
										page: currentPage - 1
									})}"
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
									aria-label="Previous page (unavailable)"
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
								<a
									href="?{organizationFiltersToParams({
										...currentFilters,
										page: currentPage + 1
									})}"
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
									aria-label="Next page (unavailable)"
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
		{#if countActiveOrganizationFilters(currentFilters) > 0}
			<span
				class="rounded-full bg-primary-foreground px-2 py-0.5 text-xs font-medium text-primary"
				aria-label="{countActiveOrganizationFilters(currentFilters)} {m[
					'common.filters_activeFilters'
				]()}"
			>
				{countActiveOrganizationFilters(currentFilters)}
			</span>
		{/if}
	</button>

	<!-- Mobile Filter Sheet -->
	<MobileOrganizationFilterSheet
		filters={currentFilters}
		{totalCount}
		isOpen={isMobileFilterOpen}
		onUpdateFilters={handleUpdateFilters}
		onClearFilters={handleClearFilters}
		onClose={handleCloseMobileFilters}
	/>
</div>
