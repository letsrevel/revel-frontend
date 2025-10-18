<script lang="ts">
	import type { EventFilters } from '$lib/utils/filters';
	import { ArrowUpDown, Info } from 'lucide-svelte';
	import { cn } from '$lib/utils/cn';

	interface Props {
		orderBy?: EventFilters['orderBy'];
		onChangeOrderBy: (orderBy: EventFilters['orderBy']) => void;
		class?: string;
	}

	let { orderBy = 'start', onChangeOrderBy, class: className }: Props = $props();

	const options: Array<{ value: EventFilters['orderBy']; label: string; description: string }> = [
		{ value: 'start', label: 'Soonest First', description: 'Events starting soonest' },
		{ value: '-start', label: 'Latest First', description: 'Events starting latest' },
		{ value: 'distance', label: 'Nearest First', description: 'Closest to your location' }
	];

	let showTooltip = $state(false);

	function handleChange(event: Event): void {
		const target = event.target as HTMLSelectElement;
		onChangeOrderBy(target.value as EventFilters['orderBy']);
	}
</script>

<div class={cn('space-y-3', className)}>
	<div class="flex items-center gap-2">
		<ArrowUpDown class="h-4 w-4 text-muted-foreground" aria-hidden="true" />
		<h3 class="text-sm font-medium">Sort Order</h3>
		<!-- Info Tooltip -->
		<div class="relative">
			<button
				type="button"
				onmouseenter={() => showTooltip = true}
				onmouseleave={() => showTooltip = false}
				onfocus={() => showTooltip = true}
				onblur={() => showTooltip = false}
				class="rounded-sm p-0.5 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				aria-label="Sort order information"
			>
				<Info class="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
			</button>

			{#if showTooltip}
				<div class="absolute bottom-full left-0 z-50 mb-2 w-64 rounded-md border bg-popover p-3 text-xs text-popover-foreground shadow-md">
					<p class="font-medium">Distance Sorting</p>
					<p class="mt-1 text-muted-foreground">
						"Nearest First" uses your approximate location from IP address or your selected city in account settings.
					</p>
					<!-- Tooltip arrow -->
					<div class="absolute left-2 top-full h-2 w-2 -translate-y-1 rotate-45 border-b border-r bg-popover"></div>
				</div>
			{/if}
		</div>
	</div>

	<select
		value={orderBy}
		onchange={handleChange}
		class="h-10 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
		aria-label="Sort order"
	>
		{#each options as option (option.value)}
			<option value={option.value}>
				{option.label}
			</option>
		{/each}
	</select>

	<p class="text-xs text-muted-foreground">
		{options.find(o => o.value === orderBy)?.description || ''}
	</p>
</div>
