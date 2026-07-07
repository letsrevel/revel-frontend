<script lang="ts">
	import ConfirmationResult from '$lib/components/events/ConfirmationResult.svelte';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Confirm Action - Revel</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="container px-4 py-8">
	<ConfirmationResult token={data.token} />
</div>
