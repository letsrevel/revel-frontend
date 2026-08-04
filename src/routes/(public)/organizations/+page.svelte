<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import { OrganizationCard } from '$lib/components/organizations';
	import {
		OrganizationFilters,
		MobileOrganizationFilterSheet
	} from '$lib/components/organizations/filters';
	import { Users, Filter } from '@lucide/svelte';
	import {
		parseOrganizationFilters,
		organizationFiltersToParams,
		clearOrganizationFilters,
		countActiveOrganizationFilters
	} from '$lib/utils/organizationFilters';
	import type { OrganizationFilters as FilterState } from '$lib/utils/organizationFilters';
	import { Button } from '$lib/components/ui/button';
	import PageHeader from '$lib/components/common/PageHeader.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import { SeoHead } from '$lib/seo';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		data: PageData;
	}

	const { data }: Props = $props();

	// Derived state from server load data
	const organizations = $derived(data.organizations);
	const totalCount = $derived(data.totalCount);
	const currentPage = $derived(data.page);
	const pageSize = $derived(data.pageSize);
	const error = $derived(data.error);

	// Parse current filters from URL
	const currentFilters = $derived(parseOrganizationFilters($page.url.searchParams));

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

		const params = organizationFiltersToParams(newFilters);
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve() validates the route id; the appended query string cannot be expressed through resolve()
		goto(`${resolve('/(public)/organizations', {})}?${params}`, {
			replaceState: false,
			keepFocus: true
		});
	}

	function handleClearFilters(): void {
		const params = organizationFiltersToParams(clearOrganizationFilters());
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve() validates the route id; the appended query string cannot be expressed through resolve()
		goto(`${resolve('/(public)/organizations', {})}${params.toString() ? `?${params}` : ''}`, {
			replaceState: false
		});
	}

	function handleOpenMobileFilters(): void {
		isMobileFilterOpen = true;
	}

	function handleCloseMobileFilters(): void {
		isMobileFilterOpen = false;
	}
</script>

<SeoHead config={data.seo} />

<div class="bg-background">
	<!--
		Color-block header band (uplift, spec §9) — the twin of /events, so the two
		discovery entrances read as one system rather than two designs. Same
		full-strength `bg-secondary` poster panel (audit-enforced pair in both
		modes), same shallow depth: a listing is a work surface.

		No sticker chip: discovery speaks for no single organization, and the
		sticker-chip rule forbids the Revel mark as filler.
	-->
	<section class="bg-secondary text-secondary-foreground">
		<div class="container mx-auto px-4 pb-16 pt-8">
			<!-- Skip to content link for keyboard navigation -->
			<a
				href="#organizations-content"
				class="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
			>
				{m['browse.organizations_skipTo']()}
			</a>

			<!-- Page Header -->
			<PageHeader
				volume="poster"
				onBand
				kicker={m['browse.organizations_kicker']()}
				title={m['browse.organizations_title']()}
				subtitle={!error && totalCount > 0
					? m['browse.organizations_count']({
							count: totalCount,
							organizationPlural:
								totalCount === 1
									? m['common.plurals_organization']()
									: m['common.plurals_organizations']()
						})
					: undefined}
			/>
		</div>
	</section>

	<!--
		Tinted content panel — identical composite to /events and the event detail
		page, so the same hand-verified ratios govern (a composited alpha is
		invisible to scripts/audit-brand-themes.py):
		  light — secondary@55 over background ⇒ hsl(231 88% 90%);
		          foreground 12.42:1 · muted-foreground 6.45:1 · primary 4.97:1
		  dark  — secondary@28 over background ⇒ hsl(246 33% 15%);
		          foreground 15.75:1 · muted-foreground 7.47:1 · primary 6.30:1
		(`muted-foreground` is the pagination tally, `foreground` the page indicator.)
	-->
	<div class="bg-secondary/55 pb-16 dark:bg-secondary/[0.28]">
		<div class="container mx-auto px-4">
			<!-- Main Content: Sidebar + Organization Grid -->
			<div class="-mt-8 flex flex-col gap-8 lg:flex-row">
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
					{:else if organizations.length === 0}
						<!-- level 2: the page's only other heading is the h1 above. -->
						<EmptyState
							level={2}
							icon={Users}
							title={m['browse.organizations_noOrganizationsFound']()}
							body={currentFilters.search || currentFilters.cityId || currentFilters.tags
								? m['browse.organizations_tryAdjustingFilters']()
								: m['browse.organizations_noOrganizations']()}
						>
							{#snippet action()}
								{#if currentFilters.search || currentFilters.cityId || currentFilters.tags}
									<Button onclick={handleClearFilters}>
										{m['browse.organizations_clearFilters']()}
									</Button>
								{/if}
							{/snippet}
						</EmptyState>
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
								aria-label={m['organizationsListPage.paginationLabel']()}
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
										<!-- eslint-disable svelte/no-navigation-without-resolve -- resolve() validates the path; the appended query/fragment cannot be expressed through resolve() -->
										<a
											href="?{organizationFiltersToParams({
												...currentFilters,
												page: currentPage - 1
											})}"
											class="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
											aria-label={m['organizationsListPage.goToPreviousPage']()}
										>
											{m['common.pagination_previous']()}
										</a>
										<!-- eslint-enable svelte/no-navigation-without-resolve -->
									{:else}
										<button
											type="button"
											disabled
											class="inline-flex h-10 cursor-not-allowed items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium opacity-50"
											aria-label={m['organizationsListPage.previousPageUnavailable']()}
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
										<!-- eslint-disable svelte/no-navigation-without-resolve -- resolve() validates the path; the appended query/fragment cannot be expressed through resolve() -->
										<a
											href="?{organizationFiltersToParams({
												...currentFilters,
												page: currentPage + 1
											})}"
											class="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
											aria-label={m['organizationsListPage.goToNextPage']()}
										>
											{m['common.pagination_next']()}
										</a>
										<!-- eslint-enable svelte/no-navigation-without-resolve -->
									{:else}
										<button
											type="button"
											disabled
											class="inline-flex h-10 cursor-not-allowed items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium opacity-50"
											aria-label={m['organizationsListPage.nextPageUnavailable']()}
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
