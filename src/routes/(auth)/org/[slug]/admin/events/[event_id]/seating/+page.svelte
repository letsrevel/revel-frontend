<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { page } from '$app/stores';
	import type { PageData } from './$types';
	import { authStore } from '$lib/stores/auth.svelte';
	import SeatOverridesPanel from '$lib/components/events/admin/seating/SeatOverridesPanel.svelte';

	const { data }: { data: PageData } = $props();

	const organization = $derived($page.data.organization);
	const accessToken = $derived(authStore.accessToken);

	const pageTitle = $derived(m['orgAdmin.seating.pageTitle']());
</script>

<svelte:head>
	<title>{pageTitle} - {organization.name} Admin | Revel</title>
	<meta name="description" content={m['orgAdmin.seating.metaDescription']()} />
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-bold tracking-tight md:text-3xl">{pageTitle}</h1>
		<p class="mt-1 text-sm text-muted-foreground">
			{m['orgAdmin.seating.pageDescription']({ eventName: data.event.name })}
		</p>
	</div>

	<SeatOverridesPanel eventId={data.eventId} {accessToken} />
</div>
