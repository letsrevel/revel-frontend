<script lang="ts">
	import type { OrganizationFilters as FilterState } from '$lib/utils/organizationFilters';
	import {
		countActiveOrganizationFilters,
		hasActiveOrganizationFilters
	} from '$lib/utils/organizationFilters';
	import { cn } from '$lib/utils/cn';
	import { Filter, X } from 'lucide-svelte';
	import SearchInput from '$lib/components/events/filters/SearchInput.svelte';
	import CityFilter from '$lib/components/events/filters/CityFilter.svelte';
	import TagsFilter from '$lib/components/events/filters/TagsFilter.svelte';
	import OrganizationOrderByFilter from './OrganizationOrderByFilter.svelte';

	interface Props {
		filters: FilterState;
		onUpdateFilters: (updates: Partial<FilterState>) => void;
		onClearFilters: () => void;
		class?: string;
	}

	let { filters, onUpdateFilters, onClearFilters, class: className }: Props = $props();

	// Computed values
	let activeFilterCount = $derived(countActiveOrganizationFilters(filters));
	let hasFilters = $derived(hasActiveOrganizationFilters(filters));

	function handleSearch(value: string): void {
		onUpdateFilters({ search: value || undefined });
	}

	function handleToggleTag(tag: string): void {
		const currentTags = filters.tags || [];
		const newTags = currentTags.includes(tag)
			? currentTags.filter((t) => t !== tag)
			: [...currentTags, tag];
		onUpdateFilters({ tags: newTags.length > 0 ? newTags : undefined });
	}

	function handleChangeCity(city: { id: number; name: string; country: string } | null): void {
		onUpdateFilters({ cityId: city?.id });
	}

	function handleChangeOrderBy(orderBy: FilterState['orderBy']): void {
		onUpdateFilters({ orderBy });
	}

	// Derive selected city object from cityId
	let selectedCity = $derived.by(() => {
		if (!filters.cityId) return null;
		// We don't have the full city object, just the ID
		// In a real implementation, you might want to store the full city object in the URL
		// or fetch it. For now, we'll just track the ID and let the component handle it.
		return null;
	});
</script>

<aside
	class={cn('flex w-full flex-col gap-6 rounded-lg border bg-card p-6', className)}
	aria-label="Organization filters"
>
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-2">
			<Filter class="h-5 w-5 text-muted-foreground" aria-hidden="true" />
			<h2 class="text-lg font-semibold">Filters</h2>
			{#if activeFilterCount > 0}
				<span
					class="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground"
					aria-label="{activeFilterCount} active filters"
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
				Clear all
			</button>
		{/if}
	</div>

	<!-- Divider -->
	<div class="border-t" role="separator"></div>

	<!-- Order By Filter (Top Priority) -->
	<OrganizationOrderByFilter
		orderBy={filters.orderBy ?? 'distance'}
		onChangeOrderBy={handleChangeOrderBy}
	/>

	<!-- Divider -->
	<div class="border-t" role="separator"></div>

	<!-- Search Input -->
	<div class="space-y-2">
		<label for="organization-search" class="text-sm font-medium">Search</label>
		<SearchInput
			value={filters.search ?? ''}
			onSearch={handleSearch}
			placeholder="Search organizations..."
		/>
	</div>

	<!-- Divider -->
	<div class="border-t" role="separator"></div>

	<!-- City Filter -->
	<CityFilter {selectedCity} onChangeCity={handleChangeCity} />

	<!-- Divider -->
	<div class="border-t" role="separator"></div>

	<!-- Tags Filter -->
	<TagsFilter selectedTags={filters.tags ?? []} onToggleTag={handleToggleTag} />

	<!-- Footer hint -->
	{#if activeFilterCount > 0}
		<div class="border-t pt-4" role="separator">
			<p class="text-xs text-muted-foreground">
				{activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} applied
			</p>
		</div>
	{/if}
</aside>
