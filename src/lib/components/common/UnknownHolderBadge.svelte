<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import StatusBadge from '$lib/components/common/StatusBadge.svelte';

	/**
	 * Studio-volume hint for an account whose profile staff cannot see because the
	 * person has not interacted with the organization yet (backend ADR-0020).
	 * The explanation is the screen-reader content; sighted staff get the same
	 * sentence from `showExplanation` where there is room for it.
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
		srLabel={m['unknownHolder.srLabel']()}
		data-testid="unknown-holder-badge"
	/>
	{#if showExplanation}
		<span class="text-xs text-muted-foreground" data-testid="unknown-holder-explanation">
			{m['unknownHolder.explanation']()}
		</span>
	{/if}
</span>
