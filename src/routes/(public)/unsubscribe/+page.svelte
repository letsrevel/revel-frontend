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
		<!-- Success message: the EmptyState DISPLAY variant (level 1). This block
		     used to be hand-composed precisely because the primitive capped at
		     h2/h3 and the page's only heading has to be an h1; level 1 lifts that
		     cap, so the chip recipe, display scale and spacing now come from the
		     primitive instead of being re-typed here. Success tone is still the
		     right one for "preferences saved". -->
		<EmptyState
			level={1}
			tone="success"
			icon={Bell}
			title={m['unsubscribePage.successTitle']()}
			body={m['unsubscribePage.successDescription']()}
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
