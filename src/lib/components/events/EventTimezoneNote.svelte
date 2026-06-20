<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Globe } from 'lucide-svelte';
	import { formatEventTimezoneLabel } from '$lib/utils/date';

	interface Props {
		/** ISO instant used to resolve the (DST-aware) offset. */
		start: string;
		/** The event's IANA timezone; when absent, nothing renders. */
		timeZone?: string | null;
		/** Human place name (e.g. the event's city). */
		place?: string | null;
		/** Optional extra classes for layout tuning by the host. */
		class?: string;
	}

	const { start, timeZone, place, class: className = '' }: Props = $props();

	const label = $derived(timeZone ? formatEventTimezoneLabel(start, timeZone, place) : '');
</script>

{#if label}
	<p class="inline-flex items-center gap-1.5 text-xs text-muted-foreground {className}">
		<Globe class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
		<span>{m['eventTime.shownIn']({ label })}</span>
	</p>
{/if}
