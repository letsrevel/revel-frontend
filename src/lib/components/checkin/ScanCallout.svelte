<script lang="ts">
	import ComplianceCallout from '$lib/components/compliance/ComplianceCallout.svelte';
	import MarkdownContent from '$lib/components/common/MarkdownContent.svelte';

	/**
	 * A callout shown next to a scan result (ticket, series pass, membership
	 * card). Door staff read it in seconds, so it sits near the name and photo.
	 *
	 * Generic on purpose: the private organizer note (#1165) and the day-membership
	 * block share it. Renders nothing when there is no body, so callers can pass
	 * a nullable straight through. The tone box itself is `ComplianceCallout`.
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
		/** `warning` stands out (amber); `info` is the quieter variant. */
		tone?: 'info' | 'warning';
		class?: string;
	}

	const { title, body, tone = 'warning', class: className }: Props = $props();

	const hasBody = $derived(!!body && body.trim().length > 0);
</script>

{#if hasBody}
	<ComplianceCallout {tone} role="note" label={title} testId="scan-callout" class={className}>
		<p class="font-extrabold">{title}</p>
		<MarkdownContent content={body} class="text-inherit prose-p:my-1" />
	</ComplianceCallout>
{/if}
