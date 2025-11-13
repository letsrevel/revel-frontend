<script lang="ts">
	import type { PageData } from './$types';
	import { NotificationList } from '$lib/components/notifications';
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/ui/button';
	import { Settings } from 'lucide-svelte';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();
</script>

<svelte:head>
	<title>{m['notificationsPage.pageTitle']?.() || 'Notifications'} - Revel</title>
	<meta
		name="description"
		content={m['notificationsPage.pageDescription']?.() ||
			'View and manage your event notifications and updates'}
	/>
</svelte:head>

<div class="container mx-auto max-w-4xl px-4 py-8">
	<!-- Page Header -->
	<div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">
				{m['notificationsPage.title']?.() || 'Notifications'}
			</h1>
			<p class="mt-2 text-muted-foreground">
				{m['notificationsPage.description']?.() ||
					'View and manage your event notifications and updates'}
			</p>
		</div>

		<!-- Settings Button -->
		<Button href="/account/settings" variant="outline" size="sm" class="shrink-0">
			<Settings class="mr-2 h-4 w-4" aria-hidden="true" />
			{m['notificationsPage.settingsButton']?.() || 'Settings'}
		</Button>
	</div>

	<!-- Notification List Component -->
	<NotificationList authToken={data.accessToken} />
</div>
