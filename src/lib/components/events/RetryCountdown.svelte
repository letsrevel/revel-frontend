<script lang="ts">
	import { Clock } from 'lucide-svelte';
	import { cn } from '$lib/utils/cn';

	interface Props {
		retryOn: string; // ISO datetime string
		class?: string;
	}

	const { retryOn, class: className }: Props = $props();

	const formatted = $derived(
		new Date(retryOn).toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		})
	);
</script>

<div class={cn('flex items-center gap-2 text-sm font-medium', className)}>
	<Clock class="h-4 w-4" aria-hidden="true" />
	<span>Available {formatted}</span>
</div>
