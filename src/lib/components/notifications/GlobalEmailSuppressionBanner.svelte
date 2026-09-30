<script lang="ts">
	import { page } from '$app/state';
	import { createQuery } from '@tanstack/svelte-query';
	import { authStore } from '$lib/stores/auth.svelte';
	import { notificationPreferencesQueryOptions } from '$lib/queries/announcement-mute';
	import EmailSuppressionBanner from './EmailSuppressionBanner.svelte';

	/**
	 * App-wide copy of the suppressed-address banner (#987) for signed-in users.
	 * It reads the shared notification-preferences query, so it costs one cached
	 * request. Account settings renders its own inline copy (not dismissible),
	 * so this one steps aside there. Dismissal lasts for the browser session and
	 * is keyed by reason + since, so a new suppression shows again.
	 */
	const accessToken = $derived(authStore.accessToken);
	const preferencesQuery = createQuery(() => notificationPreferencesQueryOptions(accessToken));

	// `?? null`: a backend without the field (deploy order) just shows nothing.
	const suppression = $derived(
		accessToken ? (preferencesQuery.data?.email_suppression ?? null) : null
	);
	const dismissKey = $derived(
		suppression ? `email-suppression-dismissed:${suppression.reason}:${suppression.since}` : null
	);

	let dismissedKey = $state<string | null>(readDismissed());

	function readDismissed(): string | null {
		try {
			return sessionStorage.getItem('email-suppression-dismissed');
		} catch {
			return null;
		}
	}

	function dismiss() {
		if (!dismissKey) return;
		dismissedKey = dismissKey;
		try {
			sessionStorage.setItem('email-suppression-dismissed', dismissKey);
		} catch {
			// Storage unavailable (private mode, blocked): dismissal lasts for this page.
		}
	}

	const onSettingsPage = $derived(page.url.pathname.endsWith('/account/settings'));
	const visible = $derived(!!suppression && !onSettingsPage && dismissedKey !== dismissKey);
</script>

{#if visible && suppression}
	<div class="container mx-auto px-4 pt-4">
		<EmailSuppressionBanner {suppression} onDismiss={dismiss} />
	</div>
{/if}
