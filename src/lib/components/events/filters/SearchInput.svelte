<script lang="ts">
	import { Search, X } from 'lucide-svelte';
	import { cn } from '$lib/utils/cn';

	interface Props {
		value: string;
		onSearch: (value: string) => void;
		placeholder?: string;
		debounceMs?: number;
		class?: string;
	}

	let {
		value = '',
		onSearch,
		placeholder = 'Search events...',
		debounceMs = 300,
		class: className
	}: Props = $props();

	// Local input state for immediate UI feedback
	let inputValue = $state(value);
	let debounceTimeout: ReturnType<typeof setTimeout> | null = null;

	// Sync external value changes
	$effect(() => {
		inputValue = value;
	});

	function handleInput(event: Event): void {
		const target = event.target as HTMLInputElement;
		inputValue = target.value;

		// Clear existing timeout
		if (debounceTimeout) {
			clearTimeout(debounceTimeout);
		}

		// Debounce the search callback
		debounceTimeout = setTimeout(() => {
			onSearch(inputValue.trim());
		}, debounceMs);
	}

	function handleClear(): void {
		inputValue = '';
		onSearch('');
		if (debounceTimeout) {
			clearTimeout(debounceTimeout);
		}
	}
</script>

<div class={cn('relative', className)}>
	<div class="relative">
		<Search
			class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
			aria-hidden="true"
		/>
		<input
			type="search"
			value={inputValue}
			oninput={handleInput}
			{placeholder}
			class="h-10 w-full rounded-md border border-input bg-background pl-9 pr-9 text-sm ring-offset-background transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
			aria-label="Search events"
		/>
		{#if inputValue}
			<button
				type="button"
				onclick={handleClear}
				class="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				aria-label="Clear search"
			>
				<X class="h-4 w-4" aria-hidden="true" />
			</button>
		{/if}
	</div>
</div>
