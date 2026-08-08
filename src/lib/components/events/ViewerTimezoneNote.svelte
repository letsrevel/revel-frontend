<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { browser } from '$app/environment';
	import { Globe } from '@lucide/svelte';
	import { formatViewerTimezoneLabel } from '$lib/utils/date';

	interface Props {
		/** Optional extra classes for layout tuning by the host. */
		class?: string;
	}

	const { class: className = '' }: Props = $props();

	// Twin of EventTimezoneNote, for lists that can only render viewer-local
	// times (the dashboard payloads carry no event timezone). Naming the
	// viewer's zone is what makes the event page's event-local clock times
	// comparable with these.
	//
	// Unlike its twin it takes NO reference instant, and so shows no offset. Its
	// twin labels a single event and can resolve that event's offset exactly;
	// this note heads a LIST whose rows each render with the offset in effect at
	// their own instant, so across a DST transition no single offset describes
	// them all — a "CET" heading over rows rendered in CEST would contradict the
	// page. formatViewerTimezoneLabel therefore returns a DST-invariant zone
	// name, which is true for every row.
	//
	// Browser-only by construction: on the server `resolvedOptions()` reports the
	// SERVER's zone, so an SSR render would state a timezone that isn't the
	// viewer's. Rendering nothing there is the honest fallback.
	const label = $derived(browser ? formatViewerTimezoneLabel() : '');
</script>

{#if label}
	<p class="inline-flex items-center gap-1.5 text-xs text-muted-foreground {className}">
		<Globe class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
		<span>{m['eventTime.shownInYours']({ label })}</span>
	</p>
{/if}
