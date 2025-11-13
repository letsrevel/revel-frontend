<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { PageData } from './$types';
	import { NotificationPreferencesForm } from '$lib/components/notifications';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();
</script>

<svelte:head>
	<title>{m['accountSettingsPage.pageTitle']()} - Revel</title>
	<meta name="description" content={m['accountSettingsPage.pageDescription']()} />
</svelte:head>

<div class="container mx-auto max-w-2xl px-4 py-8">
	<div class="mb-8">
		<h1 class="text-3xl font-bold tracking-tight">{m['accountSettingsPage.title']()}</h1>
		<p class="mt-2 text-muted-foreground">{m['accountSettingsPage.subtitle']()}</p>
	</div>

	{#if data.accessToken}
		<NotificationPreferencesForm
			preferences={data.preferences ?? null}
			authToken={data.accessToken}
		/>
	{:else}
		<div role="alert" class="rounded-md border border-destructive bg-destructive/10 p-4">
			<p class="text-sm font-medium text-destructive">
				{m['accountSettingsPage.errorNotLoggedIn']()}
			</p>
		</div>
	{/if}
</div>
