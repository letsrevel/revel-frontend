<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { EventVisibilitySettings } from '$lib/api/generated/types.gen';
	import type { ResolvedVisibilitySettings } from '$lib/utils/event-visibility';
	import { ChevronDown, ChevronRight, Eye } from '@lucide/svelte';
	import EventVisibilityFields from './EventVisibilityFields.svelte';

	interface Props {
		settings?: EventVisibilitySettings | null;
		isOpen: boolean;
		onToggle: () => void;
		onChange: (next: ResolvedVisibilitySettings) => void;
	}

	const { settings = null, isOpen, onToggle, onChange }: Props = $props();
</script>

<div class="overflow-hidden rounded-lg border border-border">
	<button
		type="button"
		onclick={onToggle}
		class="flex w-full items-center justify-between bg-muted/50 p-4 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
		aria-expanded={isOpen}
		data-testid="visibility-section-toggle"
	>
		<div class="flex items-center gap-2 font-semibold">
			<Eye class="h-5 w-5" aria-hidden="true" />
			{m['eventVisibility.title']()}
		</div>
		{#if isOpen}
			<ChevronDown class="h-5 w-5" aria-hidden="true" />
		{:else}
			<ChevronRight class="h-5 w-5" aria-hidden="true" />
		{/if}
	</button>

	{#if isOpen}
		<div class="p-4">
			<EventVisibilityFields {settings} {onChange} />
		</div>
	{/if}
</div>
