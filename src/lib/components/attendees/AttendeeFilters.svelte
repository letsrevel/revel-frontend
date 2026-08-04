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
				'rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
				activeStatusFilters.includes('yes')
					? 'border-success bg-success text-success-foreground'
					: 'border-success/50 bg-card text-foreground hover:bg-success/10'
			)}
		>
			{m['attendeesAdmin.statsYes']()}
		</button>
		<button
			type="button"
			onclick={() => onStatusFilter('maybe')}
			aria-pressed={activeStatusFilters.includes('maybe')}
			class={cn(
				'rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
				activeStatusFilters.includes('maybe')
					? 'border-highlight bg-highlight text-highlight-foreground'
					: 'border-highlight/50 bg-card text-foreground hover:bg-highlight/10'
			)}
		>
			{m['attendeesAdmin.statsMaybe']()}
		</button>
		<button
			type="button"
			onclick={() => onStatusFilter('no')}
			aria-pressed={activeStatusFilters.includes('no')}
			class={cn(
				'rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
				activeStatusFilters.includes('no')
					? 'border-destructive bg-destructive text-destructive-foreground'
					: 'border-destructive/50 bg-card text-foreground hover:bg-destructive/10'
			)}
		>
			{m['attendeesAdmin.statsNo']()}
		</button>
	</div>
</div>
