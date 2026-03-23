<script lang="ts">
	import { Clock } from 'lucide-svelte';
	import { cn } from '$lib/utils/cn';
	import * as m from '$lib/paraglide/messages.js';
	import { formatRetryDate } from '$lib/utils/eligibility';

	interface Props {
		retryOn: string; // ISO datetime string
		class?: string;
	}

	const { retryOn, class: className }: Props = $props();

	const formatted = $derived(formatRetryDate(retryOn));
</script>

<div class={cn('flex items-center gap-2 text-sm font-medium', className)}>
	<Clock class="h-4 w-4" aria-hidden="true" />
	<span
		>{formatted
			? m['retryCountdown.availableOn']({ date: formatted })
			: m['retryCountdown.availableSoon']()}</span
	>
</div>
