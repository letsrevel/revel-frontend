<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { page } from '$app/stores';
	import type { PageData } from './$types';
	import EventWizard from '$lib/components/events/admin/EventWizard.svelte';

	let { data }: { data: PageData } = $props();

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
	<div>
		<h1 class="text-2xl font-bold tracking-tight md:text-3xl">{m['eventNewPage.title']()}</h1>
		<p class="mt-1 text-sm text-muted-foreground">
			{m['eventNewPage.subtitle']({ organizationName: organization.name })}
		</p>
	</div>

	<!-- Event Wizard Component -->
	<div class="rounded-lg border bg-card p-6 text-card-foreground shadow-sm md:p-8">
		<EventWizard
			{organization}
			userCity={data.userCity}
			orgCity={data.orgCity}
			eventSeries={data.eventSeries}
			questionnaires={data.questionnaires}
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
