<script lang="ts">
	import { cn } from '$lib/utils/cn';

	/**
	 * Props interface for HTMLDescription component
	 */
	interface Props {
		/**
		 * HTML content to display safely
		 */
		html: string | null | undefined;
		/**
		 * Optional CSS classes to customize styling
		 */
		class?: string;
		/**
		 * ARIA label for the content region (for screen readers)
		 */
		ariaLabel?: string;
	}

	let { html, class: className, ariaLabel }: Props = $props();

	/**
	 * Determine if we have valid HTML content to display
	 */
	let hasContent = $derived(!!html && html.trim().length > 0);
</script>

{#if hasContent}
	<div
		class={cn('prose prose-sm dark:prose-invert max-w-none', className)}
		role="region"
		aria-label={ariaLabel}
	>
		{@html html}
	</div>
{/if}
