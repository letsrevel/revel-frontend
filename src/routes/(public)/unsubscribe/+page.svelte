<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { PageData } from './$types';
	import { NotificationPreferencesForm } from '$lib/components/notifications';
	import type { NotificationPreferenceSchema } from '$lib/api/generated/types.gen';
	import { goto } from '$app/navigation';
	import { Bell } from 'lucide-svelte';

	let { data }: { data: PageData } = $props();

	// Default preferences for unsubscribe page:
	// - Silence all notifications: checked
	// - Event reminders: unchecked
	// - Channels: only in-app
	const defaultPreferences: NotificationPreferenceSchema = {
		silence_all_notifications: true,
		event_reminders_enabled: false,
		enabled_channels: ['in_app'],
		digest_frequency: 'immediate',
		digest_send_time: '09:00',
		notification_type_settings: {}
	};

	let success = $state(false);

	function handleSuccess() {
		success = true;
		// Redirect to homepage after 3 seconds
		setTimeout(() => {
			goto('/');
		}, 3000);
	}
</script>

<svelte:head>
	<title>{m['unsubscribePage.pageTitle']()} - Revel</title>
	<meta name="description" content={m['unsubscribePage.pageDescription']()} />
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="container mx-auto max-w-2xl px-4 py-8">
	{#if !data.token}
		<!-- Invalid or missing token -->
		<div class="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
			<h1 class="text-2xl font-bold text-destructive">
				{m['unsubscribePage.invalidTokenTitle']()}
			</h1>
			<p class="mt-2 text-muted-foreground">
				{m['unsubscribePage.invalidTokenDescription']()}
			</p>
			<a
				href="/"
				class="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
			>
				{m['unsubscribePage.goHome']()}
			</a>
		</div>
	{:else if success}
		<!-- Success message -->
		<div
			class="rounded-lg border border-green-500/50 bg-green-50 p-6 text-center dark:bg-green-950/50"
		>
			<div class="mb-4 flex justify-center">
				<Bell class="h-16 w-16 text-green-600 dark:text-green-400" aria-hidden="true" />
			</div>
			<h1 class="text-2xl font-bold text-green-900 dark:text-green-100">
				{m['unsubscribePage.successTitle']()}
			</h1>
			<p class="mt-2 text-green-800 dark:text-green-200">
				{m['unsubscribePage.successDescription']()}
			</p>
			<p class="mt-4 text-sm text-muted-foreground">
				{m['unsubscribePage.redirecting']()}
			</p>
		</div>
	{:else}
		<!-- Unsubscribe form -->
		<div class="mb-8">
			<h1 class="text-3xl font-bold tracking-tight">{m['unsubscribePage.title']()}</h1>
			<p class="mt-2 text-muted-foreground">
				{m['unsubscribePage.subtitle']()}
			</p>
		</div>

		<div class="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
			<NotificationPreferencesForm
				preferences={defaultPreferences}
				unsubscribeToken={data.token}
				onSave={handleSuccess}
			/>
		</div>
	{/if}
</div>
