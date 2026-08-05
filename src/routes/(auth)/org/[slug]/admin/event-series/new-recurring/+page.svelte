<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { ArrowLeft } from '@lucide/svelte';
	import type { PageData } from './$types';
	import RecurringEventWizard from '$lib/components/event-series/admin/RecurringEventWizard.svelte';
	import PageHeader from '$lib/components/common/PageHeader.svelte';

	const { data }: { data: PageData } = $props();

	const organization = $derived($page.data.organization);

	function goBack(): void {
		goto(resolve('/(auth)/org/[slug]/admin/event-series', { slug: organization.slug }));
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
			<PageHeader
				title={m['recurringEvents.wizard.title']()}
				subtitle={m['recurringEvents.wizard.pageDescription']({
					organizationName: organization.name
				})}
			/>
		</div>
	</div>

	<RecurringEventWizard
		{organization}
		userCity={data.userCity}
		orgCity={data.orgCity}
		questionnaires={data.questionnaires}
	/>
</div>
