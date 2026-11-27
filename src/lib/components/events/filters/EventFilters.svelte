<script lang="ts">
	import type { EventFilters as FilterState } from '$lib/utils/filters';
	import { countActiveFilters, hasActiveFilters } from '$lib/utils/filters';
	import { cn } from '$lib/utils/cn';
	import { Filter, X } from '@lucide/svelte';
	import SearchInput from './SearchInput.svelte';
	import DateFilter from './DateFilter.svelte';
	import TicketedFilter from './TicketedFilter.svelte';
	import TagsFilter from './TagsFilter.svelte';
	import EventTypeFilter from './EventTypeFilter.svelte';
	import CityFilter from './CityFilter.svelte';
	import OrganizationFilter from './OrganizationFilter.svelte';
	import OrderByFilter from './OrderByFilter.svelte';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		filters: FilterState;
		onUpdateFilters: (updates: Partial<FilterState>) => void;
		onClearFilters: () => void;
		/** Tenant host: the list is already scoped to one organization (#1056). */
		hideOrganization?: boolean;
		/** Calendar view: sort order, "include past" and search don't apply (the calendar shows the whole period, ordered by start, and its endpoint takes no search). */
		hideListControls?: boolean;
		class?: string;
	}

	const {
		filters,
		onUpdateFilters,
		onClearFilters,
		hideOrganization = false,
		hideListControls = false,
		class: className
	}: Props = $props();

	// Computed values
	const activeFilterCount = $derived(
		countActiveFilters(filters, { ignoreListOnly: hideListControls })
	);
	const hasFilters = $derived(hasActiveFilters(filters, { ignoreListOnly: hideListControls }));

	function handleSearch(value: string): void {
		onUpdateFilters({ search: value || undefined });
	}

	function handleTogglePast(value: boolean): void {
		onUpdateFilters({ includePast: value });
	}

	function handleChangeTicketType(type: FilterState['ticketType']): void {
		onUpdateFilters({ ticketType: type });
	}

	function handleToggleTag(tag: string): void {
		const currentTags = filters.tags || [];
		const newTags = currentTags.includes(tag)
			? currentTags.filter((t) => t !== tag)
			: [...currentTags, tag];
		onUpdateFilters({ tags: newTags.length > 0 ? newTags : undefined });
	}

	function handleChangeEventType(type: FilterState['eventType']): void {
		onUpdateFilters({ eventType: type });
	}

	function handleChangeCity(city: { id: number; name: string; country: string } | null): void {
		onUpdateFilters({ cityId: city?.id });
	}

	function handleChangeOrganization(org: { id: string; name: string; slug: string } | null): void {
		if (org) {
			onUpdateFilters({
				organizationId: org.id,
				organizationName: org.name,
				organizationSlug: org.slug
			});
		} else {
			onUpdateFilters({
				organizationId: undefined,
				organizationName: undefined,
				organizationSlug: undefined
			});
		}
	}

	function handleChangeOrderBy(orderBy: FilterState['orderBy']): void {
		onUpdateFilters({ orderBy });
	}

	// Derive selected organization object from filters
	const selectedOrganization = $derived.by(() => {
		if (!filters.organizationId) return null;
		// Use stored name and slug from URL params if available
		return {
			id: filters.organizationId,
			name: filters.organizationName || m['eventFilters.unknownOrganization'](),
			slug: filters.organizationSlug || 'unknown'
		};
	});
</script>

<aside
	class={cn('flex w-full flex-col gap-6 rounded-lg border-2 bg-card p-6 shadow-poster', className)}
	aria-label={m['eventFilters.eventFilters']()}
>
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-2">
			<Filter class="h-5 w-5 text-muted-foreground" aria-hidden="true" />
			<h2 class="text-xl font-extrabold">{m['common.filters_filters']()}</h2>
			{#if activeFilterCount > 0}
				<span
					class="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground"
					aria-label="{activeFilterCount} {m['common.filters_activeFilters']()}"
				>
					{activeFilterCount}
				</span>
			{/if}
		</div>

		{#if hasFilters}
			<button
				type="button"
				onclick={onClearFilters}
				class="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			>
				<X class="h-4 w-4" aria-hidden="true" />
				{m['common.filters_clearAll']()}
			</button>
		{/if}
	</div>

	<!-- Divider -->
	<div class="border-t" role="separator"></div>

	<!-- City Filter (Location - Top Priority) -->
	<CityFilter selectedCityId={filters.cityId} onChangeCity={handleChangeCity} />

	<!-- Divider -->
	<div class="border-t" role="separator"></div>

	{#if !hideListControls}
		<!-- Order By Filter -->
		<OrderByFilter orderBy={filters.orderBy ?? 'distance'} onChangeOrderBy={handleChangeOrderBy} />

		<!-- Divider -->
		<div class="border-t" role="separator"></div>

		<!-- Search Input (list only: the calendar endpoint takes no search, #1297) -->
		<div class="space-y-2">
			<label for="event-search" class="text-sm font-bold">{m['common.search_label']()}</label>
			<SearchInput
				id="event-search"
				value={filters.search ?? ''}
				onSearch={handleSearch}
				placeholder={m['filters.search.eventsPlaceholder']()}
			/>
		</div>

		<!-- Divider -->
		<div class="border-t" role="separator"></div>

		<!-- Date Filter -->
		<DateFilter includePast={filters.includePast ?? false} onTogglePast={handleTogglePast} />

		<!-- Divider -->
		<div class="border-t" role="separator"></div>
	{/if}

	<!-- Ticket Type Filter -->
	<TicketedFilter ticketType={filters.ticketType} onChangeTicketType={handleChangeTicketType} />

	<!-- Divider -->
	<div class="border-t" role="separator"></div>

	{#if !hideOrganization}
		<!-- Organization Filter -->
		<OrganizationFilter {selectedOrganization} onChangeOrganization={handleChangeOrganization} />

		<!-- Divider -->
		<div class="border-t" role="separator"></div>
	{/if}

	<!-- Event Type Filter -->
	<EventTypeFilter eventType={filters.eventType} onChangeEventType={handleChangeEventType} />

	<!-- Divider -->
	<div class="border-t" role="separator"></div>

	<!-- Tags Filter -->
	<TagsFilter selectedTags={filters.tags ?? []} onToggleTag={handleToggleTag} />

	<!-- Future filters: Organization, Visibility -->

	<!-- Footer hint -->
	{#if activeFilterCount > 0}
		<div class="border-t pt-4" role="separator">
			<p class="text-xs text-muted-foreground">
				{activeFilterCount}
				{activeFilterCount !== 1
					? m['common.filters_filtersPlural']()
					: m['common.filters_filter']()}
				{m['common.filters_applied']()}
			</p>
		</div>
	{/if}
</aside>
