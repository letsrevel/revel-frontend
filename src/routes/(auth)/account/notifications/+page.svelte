<script lang="ts">
	import { authStore } from '$lib/stores/auth.svelte';
	import { NotificationList } from '$lib/components/notifications';
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/ui/button';
	import PageHeader from '$lib/components/common/PageHeader.svelte';
	import { Settings } from '@lucide/svelte';
</script>

<svelte:head>
	<title>{m['notificationsPage.pageTitle']()} - Revel</title>
	<meta name="description" content={m['notificationsPage.pageDescription']()} />
</svelte:head>

<div class="container mx-auto max-w-4xl px-4 py-8">
	<PageHeader
		kicker={m['myInvoices.account']()}
		title={m['notificationsPage.title']()}
		subtitle={m['notificationsPage.description']()}
		class="mb-8"
	>
		{#snippet actions()}
			<Button href="/account/settings" variant="outline" size="sm" class="shrink-0">
				<Settings class="mr-2 h-4 w-4" aria-hidden="true" />
				{m['notificationsPage.settingsButton']()}
			</Button>
		{/snippet}
	</PageHeader>

	<!-- Notification List Component. Gated on the in-memory token (populated by
		the refresh-on-hydration flow); the route already redirects unauthenticated
		users server-side. -->
	{#if authStore.accessToken}
		<NotificationList authToken={authStore.accessToken} />
	{/if}
</div>
