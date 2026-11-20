<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import StatusBadge from '$lib/components/common/StatusBadge.svelte';

	/**
	 * Studio-volume hint for an account whose profile staff cannot see because the
	 * person has no active connection to the organization (backend ADR-0020).
	 * Screen readers get the full sentence as the badge's `srLabel`; with
	 * `showExplanation` the visible explanation says it instead, so the badge
	 * reads its plain label and nothing is announced twice.
	 */
	interface Props {
		showExplanation?: boolean;
		class?: string;
	}

	const { showExplanation = false, class: className = '' }: Props = $props();
</script>

<span class="inline-flex flex-wrap items-center gap-x-2 gap-y-1 {className}">
	<StatusBadge
		tone="neutral"
		size="sm"
		label={m['unknownHolder.badge']()}
		srLabel={showExplanation ? undefined : m['unknownHolder.srLabel']()}
		data-testid="unknown-holder-badge"
	/>
	{#if showExplanation}
		<span class="text-xs text-muted-foreground" data-testid="unknown-holder-explanation">
			{m['unknownHolder.explanation']()}
		</span>
	{/if}
</span>
