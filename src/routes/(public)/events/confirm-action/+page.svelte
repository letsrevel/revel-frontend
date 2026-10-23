<script lang="ts">
	import { page as appPage } from '$app/state';
	import { withSiteName } from '$lib/seo/tenant';
	import ConfirmationResult from '$lib/components/events/ConfirmationResult.svelte';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{withSiteName('Confirm Action', appPage.data.tenant, ' - ')}</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="container px-4 py-8">
	<ConfirmationResult token={data.token} />
</div>
