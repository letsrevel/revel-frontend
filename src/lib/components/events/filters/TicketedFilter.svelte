<script lang="ts">
	import type { EventFilters } from '$lib/utils/filters';
	import { Ticket, X } from 'lucide-svelte';
	import { cn } from '$lib/utils/cn';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		ticketType?: EventFilters['ticketType'];
		onChangeTicketType: (type: EventFilters['ticketType']) => void;
		class?: string;
	}

	const { ticketType, onChangeTicketType, class: className }: Props = $props();

	const options = $derived.by(() => [
		{ value: 'ticketed' as const, label: m['filters.ticketType.ticketed']() },
		{ value: 'free' as const, label: m['filters.ticketType.free']() }
	]);

	function handleToggle(value: EventFilters['ticketType']): void {
		if (ticketType === value) {
			onChangeTicketType(undefined);
		} else {
			onChangeTicketType(value);
		}
	}
</script>

<div class={cn('space-y-3', className)}>
	<div class="flex items-center gap-2">
		<Ticket class="h-4 w-4 text-muted-foreground" aria-hidden="true" />
		<h3 class="text-sm font-medium">{m['filters.ticketType.heading']()}</h3>
	</div>

	<div class="flex flex-wrap gap-2">
		{#each options as option (option.value)}
			{@const isSelected = ticketType === option.value}
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

	{#if ticketType}
		<p class="text-xs text-muted-foreground">
			{ticketType === 'ticketed'
				? m['filters.ticketType.showingTicketed']()
				: m['filters.ticketType.showingFree']()}
		</p>
	{/if}
</div>
