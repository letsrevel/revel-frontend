<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils/cn';
	import SearchInput from '$lib/components/events/filters/SearchInput.svelte';

	interface Props {
		searchInput: string;
		activeStatusFilters: string[];
		totalCount: number;
		onSearch: (value: string) => void;
		onStatusFilter: (status: string | null) => void;
	}

	const { searchInput, activeStatusFilters, totalCount, onSearch, onStatusFilter }: Props =
		$props();
</script>

<div class="space-y-4">
	<!-- Search bar -->
	<SearchInput
		value={searchInput}
		{onSearch}
		placeholder={m['attendeesAdmin.searchPlaceholder']()}
		ariaLabel={m['attendeesAdmin.searchPlaceholder']()}
	/>

	<!-- Filter buttons -->
	<div class="flex flex-wrap gap-2" role="group" aria-label={m['attendeesAdmin.filterByStatus']()}>
		<button
			type="button"
			onclick={() => onStatusFilter(null)}
			aria-pressed={activeStatusFilters.length === 0}
			class={cn(
				'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
				activeStatusFilters.length === 0
					? 'bg-primary text-primary-foreground'
					: 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
			)}
		>
			{m['attendeesAdmin.filterAll']({ count: totalCount })}
		</button>
		<button
			type="button"
			onclick={() => onStatusFilter('yes')}
			aria-pressed={activeStatusFilters.includes('yes')}
			class={cn(
				'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
				activeStatusFilters.includes('yes')
					? 'bg-green-600 text-white'
					: 'border border-green-600 text-green-600 hover:bg-green-50 dark:hover:bg-green-950'
			)}
		>
			{m['attendeesAdmin.statsYes']()}
		</button>
		<button
			type="button"
			onclick={() => onStatusFilter('maybe')}
			aria-pressed={activeStatusFilters.includes('maybe')}
			class={cn(
				'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
				activeStatusFilters.includes('maybe')
					? 'bg-yellow-600 text-white'
					: 'border border-yellow-600 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-950'
			)}
		>
			{m['attendeesAdmin.statsMaybe']()}
		</button>
		<button
			type="button"
			onclick={() => onStatusFilter('no')}
			aria-pressed={activeStatusFilters.includes('no')}
			class={cn(
				'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
				activeStatusFilters.includes('no')
					? 'bg-red-600 text-white'
					: 'border border-red-600 text-red-600 hover:bg-red-50 dark:hover:bg-red-950'
			)}
		>
			{m['attendeesAdmin.statsNo']()}
		</button>
	</div>
</div>
