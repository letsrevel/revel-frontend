<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { AlertCircle } from '@lucide/svelte';
	import EmbedBuilder from '$lib/components/embed/EmbedBuilder.svelte';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	const { data }: Props = $props();
</script>

<svelte:head>
	<title>{m['orgAdminEmbedPage.pageTitle']({ organizationName: data.organization.name })}</title>
</svelte:head>

<div class="space-y-6">
	<div class="space-y-1">
		<h1 class="text-3xl font-bold">{m['orgAdminEmbedPage.title']()}</h1>
		<p class="text-muted-foreground">{m['orgAdminEmbedPage.subtitle']()}</p>
	</div>

	{#if data.pickersFailed}
		<Alert variant="destructive">
			<AlertCircle class="h-4 w-4" aria-hidden="true" />
			<AlertDescription>{m['orgAdminEmbedPage.pickersFailed']()}</AlertDescription>
		</Alert>
	{/if}

	{#if data.requestedEventSlug && !data.requestedEventEmbeddable}
		<Alert>
			<AlertCircle class="h-4 w-4" aria-hidden="true" />
			<AlertDescription>{m['orgAdminEmbedPage.eventNotEmbeddable']()}</AlertDescription>
		</Alert>
	{/if}

	<EmbedBuilder
		origin={data.origin}
		orgSlug={data.organization.slug}
		orgName={data.organization.name}
		events={data.events}
		series={data.series}
		initialEventSlug={data.requestedEventSlug}
	/>
</div>
