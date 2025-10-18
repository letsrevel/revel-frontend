<script lang="ts">
	import type { EventFilters as FilterState } from '$lib/utils/filters';
	import { countActiveFilters, hasActiveFilters } from '$lib/utils/filters';
	import { cn } from '$lib/utils/cn';
	import { Filter, X } from 'lucide-svelte';
	import SearchInput from './SearchInput.svelte';
	import DateFilter from './DateFilter.svelte';
	import TagsFilter from './TagsFilter.svelte';
	import EventTypeFilter from './EventTypeFilter.svelte';

	interface Props {
		filters: FilterState;
		onUpdateFilters: (updates: Partial<FilterState>) => void;
		onClearFilters: () => void;
		class?: string;
	}

	let { filters, onUpdateFilters, onClearFilters, class: className }: Props = $props();

	// Computed values
	let activeFilterCount = $derived(countActiveFilters(filters));
	let hasFilters = $derived(hasActiveFilters(filters));

	function handleSearch(value: string): void {
		onUpdateFilters({ search: value || undefined });
	}

	function handleTogglePast(value: boolean): void {
		onUpdateFilters({ includePast: value });
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
</script>

<aside
	class={cn('flex w-full flex-col gap-6 rounded-lg border bg-card p-6', className)}
	aria-label="Event filters"
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

	<!-- Search Input -->
	<div class="space-y-2">
		<label for="event-search" class="text-sm font-medium">Search</label>
		<SearchInput
			value={filters.search ?? ''}
			onSearch={handleSearch}
			placeholder="Search events..."
		/>
	</div>

	<!-- Divider -->
	<div class="border-t" role="separator"></div>

	<!-- Date Filter -->
	<DateFilter
		includePast={filters.includePast ?? false}
		onTogglePast={handleTogglePast}
	/>

	<!-- Divider -->
	<div class="border-t" role="separator"></div>

	<!-- Event Type Filter -->
	<EventTypeFilter
		eventType={filters.eventType}
		onChangeEventType={handleChangeEventType}
	/>

	<!-- Divider -->
	<div class="border-t" role="separator"></div>

	<!-- Tags Filter -->
	<TagsFilter
		selectedTags={filters.tags ?? []}
		onToggleTag={handleToggleTag}
	/>

	<!-- Future filters: Location, Organization, Visibility -->

	<!-- Footer hint -->
	{#if activeFilterCount > 0}
		<div class="border-t pt-4" role="separator">
			<p class="text-xs text-muted-foreground">
				{activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} applied
			</p>
		</div>
	{/if}
</aside>
