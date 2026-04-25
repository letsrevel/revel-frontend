<script lang="ts">
	import { formatRecurrence } from '$lib/utils/recurrence';
	import type { RecurrenceDescriptor } from '$lib/types/recurrence';

	interface Props {
		rule: RecurrenceDescriptor | null | undefined;
		locale?: string;
		includeBoundary?: boolean;
		class?: string;
	}

	const { rule, locale = 'en', includeBoundary = true, class: className = '' }: Props = $props();

	const summary = $derived(rule ? formatRecurrence(rule, { locale, includeBoundary }) : null);
</script>

{#if summary}
	<p class={`text-sm text-foreground ${className}`} aria-live="polite">
		{summary}
	</p>
{/if}
