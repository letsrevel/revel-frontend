<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { page } from '$app/stores';
	import type { PageData } from './$types';
	import { authStore } from '$lib/stores/auth.svelte';
	import SeatOverridesPanel from '$lib/components/events/admin/seating/SeatOverridesPanel.svelte';
	import BoxOfficeSellPanel from '$lib/components/events/admin/seating/BoxOfficeSellPanel.svelte';
	import { Tabs, TabsList, TabsTrigger, TabsContent } from '$lib/components/ui/tabs';

	const { data }: { data: PageData } = $props();

	const organization = $derived($page.data.organization);
	const accessToken = $derived(authStore.accessToken);

	const pageTitle = $derived(m['orgAdmin.seating.pageTitle']());

	let activeTab = $state('overrides');
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

	<Tabs bind:value={activeTab} class="w-full">
		<TabsList class="grid w-full grid-cols-2 sm:inline-grid sm:w-auto">
			<TabsTrigger value="overrides">
				{m['orgAdmin.seating.tabOverrides']?.() ?? 'Overrides'}
			</TabsTrigger>
			<TabsTrigger value="box-office">
				{m['orgAdmin.seating.tabBoxOffice']?.() ?? 'Sell at the door'}
			</TabsTrigger>
		</TabsList>
		<TabsContent value="overrides" class="mt-6">
			<SeatOverridesPanel eventId={data.eventId} {accessToken} />
		</TabsContent>
		<TabsContent value="box-office" class="mt-6">
			<BoxOfficeSellPanel eventId={data.eventId} {accessToken} />
		</TabsContent>
	</Tabs>
</div>
