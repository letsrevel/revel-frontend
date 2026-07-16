<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		note: string;
	}
	const { note }: Props = $props();

	const TRUNCATE_AT = 80;
	let expanded = $state(false);
	const isLong = $derived(note.length > TRUNCATE_AT);
	const shown = $derived(expanded || !isLong ? note : note.slice(0, TRUNCATE_AT) + '…');
</script>

<span class="whitespace-pre-wrap break-words text-sm text-muted-foreground">{shown}</span>
{#if isLong}
	<button
		type="button"
		class="ml-1 text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
		aria-expanded={expanded}
		onclick={() => (expanded = !expanded)}
	>
		{expanded ? m['attendeesAdmin.noteCollapse']() : m['attendeesAdmin.noteExpand']()}
	</button>
{/if}
