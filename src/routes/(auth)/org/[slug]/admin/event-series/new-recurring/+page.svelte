<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { ArrowLeft } from 'lucide-svelte';
	import type { PageData } from './$types';
	import RecurringEventWizard from '$lib/components/event-series/admin/RecurringEventWizard.svelte';

	const { data }: { data: PageData } = $props();

	const organization = $derived($page.data.organization);

	function goBack(): void {
		goto(`/org/${organization.slug}/admin/event-series`);
	}
</script>

<svelte:head>
	<title>{m['recurringEvents.wizard.title']()} - {organization.name} Admin | Revel</title>
	<meta
		name="description"
		content={m['recurringEvents.wizard.pageDescription']({ organizationName: organization.name })}
	/>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center gap-4">
		<button
			type="button"
			onclick={goBack}
			class="rounded-md p-2 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			aria-label={m['eventSeriesNewPage.backAriaLabel']()}
		>
			<ArrowLeft class="h-5 w-5" aria-hidden="true" />
		</button>
		<div class="flex-1">
			<h1 class="text-2xl font-bold tracking-tight md:text-3xl">
				{m['recurringEvents.wizard.title']()}
			</h1>
			<p class="mt-1 text-sm text-muted-foreground">
				{m['recurringEvents.wizard.pageDescription']({ organizationName: organization.name })}
			</p>
		</div>
	</div>

	<RecurringEventWizard
		{organization}
		userCity={data.userCity}
		orgCity={data.orgCity}
		questionnaires={data.questionnaires}
	/>
</div>

<style>
	:global(button:focus-visible) {
		outline: 2px solid hsl(var(--ring));
		outline-offset: 2px;
	}
</style>
