<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { page } from '$app/stores';
	import type { PageData } from './$types';
	import EventEditor from '$lib/components/events/admin/EventEditor.svelte';
	import PageHeader from '$lib/components/common/PageHeader.svelte';

	const { data }: { data: PageData } = $props();

	const organization = $derived($page.data.organization);
</script>

<svelte:head>
	<title>{m['eventNewPage.pageTitle']()} - {organization.name} Admin | Revel</title>
	<meta
		name="description"
		content={m['eventNewPage.pageDescription']({ organizationName: organization.name })}
	/>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="space-y-6">
	<!-- Header Section -->
	<PageHeader
		kicker={m['orgAdmin.nav.events']()}
		title={m['eventNewPage.title']()}
		subtitle={m['eventNewPage.subtitle']({ organizationName: organization.name })}
	/>

	<!-- Event Editor Component -->
	<div class="rounded-lg border bg-card text-card-foreground shadow-sm">
		<EventEditor
			{organization}
			userCity={data.userCity}
			orgCity={data.orgCity}
			eventSeries={data.eventSeries}
			initialStart={data.initialStart}
			initialEventSeriesId={data.initialEventSeriesId}
		/>
	</div>
</div>

<style>
	/* Ensure consistent focus states for accessibility */
	:global(button:focus-visible) {
		outline: 2px solid hsl(var(--ring));
		outline-offset: 2px;
	}
</style>
