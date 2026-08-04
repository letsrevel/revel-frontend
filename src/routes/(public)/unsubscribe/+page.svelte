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
		<!-- Success message: hand-composed centerpiece (not the EmptyState
		     primitive, which caps at h2/h3) so the page's only heading can be
		     an h1 — mirrors the auth pages' interstitial pattern (see
		     verify/+page.svelte). Chip recipe mirrors EmptyState's internal
		     poster-tinted chip; success tone is right for "preferences saved". -->
		<div class="text-center">
			<span
				aria-hidden="true"
				class="mx-auto flex h-14 w-14 -rotate-2 items-center justify-center rounded-2xl bg-success text-success-foreground shadow-sm"
			>
				<Bell class="h-7 w-7" />
			</span>
			<h1 class="mt-4 text-3xl font-black leading-[1.12] sm:text-4xl">
				{m['unsubscribePage.successTitle']()}
			</h1>
			<p class="mt-1.5 text-muted-foreground">
				{m['unsubscribePage.successDescription']()}
			</p>
		</div>
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
