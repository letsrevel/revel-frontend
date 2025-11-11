<script lang="ts">
	import { goto } from '$app/navigation';
	import ConfirmationResult from '$lib/components/events/ConfirmationResult.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function handleEventNavigate(eventId: string) {
		// Navigate to event detail page
		// Note: We'd need the org_slug and event_slug to navigate properly
		// For now, just go to home - this can be enhanced later
		goto('/');
	}
</script>

<svelte:head>
	<title>Confirm Action - Revel</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="container px-4 py-8">
	<ConfirmationResult token={data.token} onEventNavigate={handleEventNavigate} />
</div>
