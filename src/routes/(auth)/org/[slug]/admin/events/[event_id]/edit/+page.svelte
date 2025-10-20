<script lang="ts">
	import { page } from '$app/stores';
	import type { PageData } from './$types';
	import EventWizard from '$lib/components/events/admin/EventWizard.svelte';

	let { data }: { data: PageData } = $props();

	const organization = $derived($page.data.organization);
	const event = $derived(data.event);
</script>

<svelte:head>
	<title>Edit Event: {event.name} - {organization.name} Admin | Revel</title>
	<meta name="description" content="Edit event: {event.name}" />
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="space-y-6">
	<!-- Header Section -->
	<div>
		<h1 class="text-2xl font-bold tracking-tight md:text-3xl">Edit Event</h1>
		<p class="mt-1 text-sm text-muted-foreground">
			Update details for: <span class="font-semibold">{event.name}</span>
		</p>
	</div>

	<!-- Event Wizard Component -->
	<div class="rounded-lg border bg-card p-6 text-card-foreground shadow-sm md:p-8">
		<EventWizard
			{organization}
			existingEvent={event}
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
