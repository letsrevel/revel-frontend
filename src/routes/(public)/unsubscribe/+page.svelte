<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { PageData } from './$types';
	import { NotificationPreferencesForm } from '$lib/components/notifications';
	import type { NotificationPreferenceSchema } from '$lib/api/generated/types.gen';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Bell } from '@lucide/svelte';
	import { SeoHead } from '$lib/seo';
	import PageHeader from '$lib/components/common/PageHeader.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';

	const { data }: { data: PageData } = $props();

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
			goto(resolve('/(public)', {}));
		}, 3000);
	}
</script>

<SeoHead config={data.seo} />

<div class="container mx-auto max-w-2xl px-4 py-8">
	{#if !data.token}
		<!-- Invalid or missing token -->
		<div class="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
			<h1 class="text-2xl font-extrabold text-destructive">
				{m['unsubscribePage.invalidTokenTitle']()}
			</h1>
			<p class="mt-2 text-muted-foreground">
				{m['unsubscribePage.invalidTokenDescription']()}
			</p>
			<a
				href={resolve('/(public)', {})}
				class="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
			>
				{m['unsubscribePage.goHome']()}
			</a>
		</div>
	{:else if success}
		<!-- Success message: EmptyState's playful tilted chip is the personality
		     vehicle here too, replacing the raw green-*/50/900/950 hues with the
		     audited success token pair. EmptyState's own heading stays at its
		     default level (3) — the page's real h1 is the sr-only one below, so
		     the visible title isn't duplicated and the document still has
		     exactly one h1. -->
		<h1 class="sr-only">{m['unsubscribePage.successTitle']()}</h1>
		<EmptyState
			icon={Bell}
			title={m['unsubscribePage.successTitle']()}
			body={m['unsubscribePage.successDescription']()}
			tone="success"
		/>
		<p class="mt-4 text-center text-sm text-muted-foreground">
			{m['unsubscribePage.redirecting']()}
		</p>
	{:else}
		<!-- Unsubscribe form -->
		<PageHeader
			title={m['unsubscribePage.title']()}
			subtitle={m['unsubscribePage.subtitle']()}
			volume="celebration"
			class="mb-8"
		/>

		<div class="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
			<NotificationPreferencesForm
				preferences={defaultPreferences}
				unsubscribeToken={data.token}
				onSave={handleSuccess}
			/>
		</div>
	{/if}
</div>
