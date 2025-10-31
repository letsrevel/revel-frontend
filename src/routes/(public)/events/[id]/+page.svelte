<script lang="ts">
	// This route uses the same component as [org_slug]/[event_slug]
	// but fetches data by event ID instead
	import EventDetailPage from '../[org_slug]/[event_slug]/+page.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<EventDetailPage {data} />
