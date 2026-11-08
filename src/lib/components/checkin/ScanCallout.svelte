<script lang="ts">
	import { Info, TriangleAlert } from '@lucide/svelte';
	import MarkdownContent from '$lib/components/common/MarkdownContent.svelte';
	import { cn } from '$lib/utils/cn';

	/**
	 * A callout shown next to a scan result (ticket, series pass, membership
	 * card). Door staff read it in seconds, so it sits near the name and photo.
	 *
	 * Generic on purpose: the private organizer note (#1165) and the day-membership
	 * block share it. Renders nothing when there is no body, so callers can pass
	 * a nullable straight through.
	 *
	 * Not a live region of its own: it is rendered inside the scan result's
	 * existing live region / dialog, which is what announces it with the result.
	 * Meaning never relies on colour alone: a title and an icon always accompany it.
	 */
	interface Props {
		/** Short label, e.g. "Staff note". */
		title: string;
		/** Markdown (sanitized by the backend and again on render). Null/empty renders nothing. */
		body: string | null | undefined;
		/** `warning` stands out (amber); `info` is the quieter neutral variant. */
		tone?: 'info' | 'warning';
		class?: string;
	}

	const { title, body, tone = 'warning', class: className }: Props = $props();

	const hasBody = $derived(!!body && body.trim().length > 0);
</script>

{#if hasBody}
	<aside
		data-testid="scan-callout"
		aria-label={title}
		class={cn(
			'rounded-lg border p-3 text-sm',
			tone === 'warning'
				? 'border-highlight/40 bg-highlight/20 text-highlight-foreground dark:text-highlight'
				: 'border-border bg-muted text-foreground',
			className
		)}
	>
		<p class="flex items-center gap-2 font-extrabold">
			{#if tone === 'warning'}
				<TriangleAlert class="h-4 w-4 shrink-0" aria-hidden="true" />
			{:else}
				<Info class="h-4 w-4 shrink-0" aria-hidden="true" />
			{/if}
			{title}
		</p>
		<MarkdownContent content={body} class="mt-1 text-inherit prose-p:my-1" />
	</aside>
{/if}
