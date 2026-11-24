<script lang="ts" module>
	export type FilterChip = {
		/** Visible chip text. */
		label: string;
		/** Whether this chip is currently selected (drives `aria-pressed`). */
		active: boolean;
		/** Called when the chip is pressed. */
		onSelect: () => void;
	};

	export type FilterChipGroup = {
		/** Stable key for the group. */
		id: string;
		/** Visible group label, also the accessible name of the group. */
		label: string;
		chips: FilterChip[];
	};
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		/** Current search text. Omit `onSearch` to hide the search field. */
		searchValue?: string;
		onSearch?: (value: string) => void;
		searchLabel?: string;
		searchPlaceholder?: string;
		/** Labelled chip groups, rendered in order. */
		chipGroups?: FilterChipGroup[];
		/** Checkboxes. Rendered inside a labelled "options" group when given. */
		options?: Snippet;
		optionsLabel?: string;
		/** Result-count line, placed below the controls and announced politely. Pass '' while loading; leave undefined for no count line. */
		resultCount?: string;
		/** Shows the "clear" button when true and `onClear` is set. */
		hasActiveFilters?: boolean;
		onClear?: () => void;
		clearLabel?: string;
		/** Optional strip above the controls (for example tabs), divided by a rule. */
		header?: Snippet;
	};

	let {
		searchValue = '',
		onSearch,
		searchLabel = '',
		searchPlaceholder = '',
		chipGroups = [],
		options,
		optionsLabel = '',
		resultCount,
		hasActiveFilters = false,
		onClear,
		clearLabel = '',
		header
	}: Props = $props();

	const uid = $props.id();
</script>

<div
	class="mb-8 rounded-lg border-2 border-border bg-card shadow-poster"
	data-testid="dashboard-filter-bar"
>
	{#if header}
		<div class="border-b border-border px-4 sm:px-6">
			{@render header()}
		</div>
	{/if}

	<div class="space-y-4 p-4 sm:p-6">
		{#if onSearch}
			<div>
				<label for="{uid}-search" class="sr-only">{searchLabel || searchPlaceholder}</label>
				<input
					id="{uid}-search"
					type="search"
					value={searchValue}
					oninput={(e) => onSearch(e.currentTarget.value)}
					placeholder={searchPlaceholder}
					class="w-full rounded-lg border border-input bg-background px-4 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
				/>
			</div>
		{/if}

		{#each chipGroups as group (group.id)}
			<div role="group" aria-labelledby="{uid}-{group.id}">
				<span id="{uid}-{group.id}" class="mb-2 block text-sm font-medium">{group.label}</span>
				<div class="flex flex-wrap gap-2">
					{#each group.chips as chip (chip.label)}
						<button
							type="button"
							aria-pressed={chip.active}
							onclick={chip.onSelect}
							class="min-h-11 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring sm:min-h-9 {chip.active
								? 'bg-primary text-primary-foreground hover:bg-primary/90'
								: 'bg-background hover:bg-accent hover:text-accent-foreground'}"
						>
							{chip.label}
						</button>
					{/each}
				</div>
			</div>
		{/each}

		{#if options}
			<div role="group" aria-labelledby="{uid}-options">
				<span id="{uid}-options" class="mb-2 block text-sm font-medium">{optionsLabel}</span>
				<div class="flex flex-wrap items-center gap-x-6 gap-y-1">
					{@render options()}
				</div>
			</div>
		{/if}

		{#if resultCount !== undefined || (hasActiveFilters && onClear)}
			<div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
				<p
					class="text-sm text-muted-foreground"
					aria-live="polite"
					data-testid="filter-result-count"
				>
					{resultCount ?? ''}
				</p>
				{#if hasActiveFilters && onClear}
					<button
						type="button"
						onclick={onClear}
						class="min-h-11 rounded-md border bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring sm:min-h-9"
					>
						{clearLabel}
					</button>
				{/if}
			</div>
		{/if}
	</div>
</div>
