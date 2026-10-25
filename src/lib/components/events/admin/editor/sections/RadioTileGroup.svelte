<script lang="ts" module>
	export interface RadioTileOption {
		value: string;
		title: string;
		description: string;
	}
</script>

<script lang="ts">
	import { cn } from '$lib/utils/cn';

	interface Props {
		/** Native radio `name` (E2E and form semantics rely on it). */
		name: string;
		options: RadioTileOption[];
		value: string | null | undefined;
		ariaLabel: string;
		onSelect: (value: string) => void;
		/** Tailwind column classes for the tile grid. */
		columnsClass?: string;
	}

	const {
		name,
		options,
		value,
		ariaLabel,
		onSelect,
		columnsClass = 'sm:grid-cols-2'
	}: Props = $props();
</script>

<div class={cn('grid gap-2', columnsClass)} role="radiogroup" aria-label={ariaLabel}>
	{#each options as option (option.value)}
		<label
			class="flex cursor-pointer items-start gap-3 rounded-md border border-input p-3 transition-colors hover:bg-accent/60 has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:checked]:ring-1 has-[:focus-visible]:ring-2 has-[:checked]:ring-primary has-[:focus-visible]:ring-ring"
		>
			<input
				type="radio"
				{name}
				value={option.value}
				checked={value === option.value}
				onchange={() => onSelect(option.value)}
				class="mt-0.5 h-4 w-4 shrink-0 border-input text-primary focus:outline-none"
			/>
			<span class="min-w-0 flex-1">
				<span class="block text-sm font-semibold">{option.title}</span>
				<span class="block text-xs text-muted-foreground">{option.description}</span>
			</span>
		</label>
	{/each}
</div>
