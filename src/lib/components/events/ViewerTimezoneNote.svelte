<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { browser } from '$app/environment';
	import { Globe } from '@lucide/svelte';
	import { formatViewerTimezoneLabel } from '$lib/utils/date';

	interface Props {
		/** ISO instant used to resolve the (DST-aware) offset; defaults to now. */
		reference?: string;
		/** Optional extra classes for layout tuning by the host. */
		class?: string;
	}

	const { reference, class: className = '' }: Props = $props();

	// Twin of EventTimezoneNote, for lists that can only render viewer-local
	// times (the dashboard payloads carry no event timezone). Naming the
	// viewer's zone is what makes the event page's event-local clock times
	// comparable with these.
	//
	// Browser-only by construction: on the server `resolvedOptions()` reports the
	// SERVER's zone, so an SSR render would state a timezone that isn't the
	// viewer's. Rendering nothing there is the honest fallback.
	const label = $derived(browser ? formatViewerTimezoneLabel(reference) : '');
</script>

{#if label}
	<p class="inline-flex items-center gap-1.5 text-xs text-muted-foreground {className}">
		<Globe class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
		<span>{m['eventTime.shownInYours']({ label })}</span>
	</p>
{/if}
