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
	const dismissKey = $derived(suppression ? `${suppression.reason}:${suppression.since}` : null);

	const DISMISS_STORAGE_KEY = 'email-suppression-dismissed';

	let dismissedKey = $state<string | null>(readDismissed());

	function readDismissed(): string | null {
		try {
			return sessionStorage.getItem(DISMISS_STORAGE_KEY);
		} catch {
			return null;
		}
	}

	function dismiss() {
		if (!dismissKey) return;
		dismissedKey = dismissKey;
		try {
			sessionStorage.setItem(DISMISS_STORAGE_KEY, dismissKey);
		} catch {
			// Storage unavailable (private mode, blocked): dismissal lasts for this page.
		}
	}

	const onSettingsPage = $derived(/\/account\/settings\/?$/.test(page.url.pathname));
	const visible = $derived(!!suppression && !onSettingsPage && dismissedKey !== dismissKey);
</script>

{#if visible && suppression}
	<div class="container mx-auto px-4 pt-4">
		<EmailSuppressionBanner {suppression} onDismiss={dismiss} />
	</div>
{/if}
