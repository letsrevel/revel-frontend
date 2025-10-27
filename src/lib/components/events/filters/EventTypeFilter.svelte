<script lang="ts">
	import type { EventFilters } from '$lib/utils/filters';
	import { Eye, X } from 'lucide-svelte';
	import { cn } from '$lib/utils/cn';

	interface Props {
		eventType?: EventFilters['eventType'];
		onChangeEventType: (type: EventFilters['eventType']) => void;
		class?: string;
	}

	let { eventType, onChangeEventType, class: className }: Props = $props();

	const options: Array<{ value: EventFilters['eventType']; label: string }> = [
		{ value: 'public', label: 'Public' },
		{ value: 'private', label: 'Private' },
		{ value: 'members-only', label: 'Members Only' }
	];

	function handleToggle(value: EventFilters['eventType']): void {
		// If clicking the currently selected type, clear it (show all)
		if (eventType === value) {
			onChangeEventType(undefined);
		} else {
			onChangeEventType(value);
		}
	}
</script>

<div class={cn('space-y-3', className)}>
	<div class="flex items-center gap-2">
		<Eye class="h-4 w-4 text-muted-foreground" aria-hidden="true" />
		<h3 class="text-sm font-medium">Event Type</h3>
	</div>

	<div class="flex flex-wrap gap-2">
		{#each options as option (option.value)}
			{@const isSelected = eventType === option.value}
			<button
				type="button"
				onclick={() => handleToggle(option.value)}
				class={cn(
					'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
					isSelected
						? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90'
						: 'border-input bg-background hover:bg-accent hover:text-accent-foreground'
				)}
				aria-pressed={isSelected}
			>
				{option.label}
				{#if isSelected}
					<X class="h-3 w-3" aria-hidden="true" />
				{/if}
			</button>
		{/each}
	</div>

	{#if eventType}
		<p class="text-xs text-muted-foreground">
			Showing {eventType === 'members-only' ? 'members only' : eventType} events
		</p>
	{/if}
</div>
