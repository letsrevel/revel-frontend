<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { appStore } from '$lib/stores/app.svelte';
	import { AlertCircle } from '@lucide/svelte';

	// Get demo mode from store
	const isDemoMode = $derived(appStore.isDemoMode);

	// Calculate user's timezone
	const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

	// Get midnight CET in user's timezone
	function getMidnightCETInUserTimezone(): string {
		const now = new Date();
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- not reactive state: local var mutated synchronously within this pure function, then discarded
		const tomorrow = new Date(now);
		tomorrow.setDate(tomorrow.getDate() + 1);

		// Create midnight CET time (00:00 in Europe/Paris)
		// eslint-disable-next-line no-restricted-syntax, svelte/prefer-svelte-reactivity -- timezone conversion, not display formatting; not reactive state, mutated synchronously and discarded
		const midnightCET = new Date(tomorrow.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
		midnightCET.setHours(0, 0, 0, 0);

		// Convert to user's timezone
		// eslint-disable-next-line no-restricted-syntax -- timezone conversion, not display formatting
		const userTime = new Date(midnightCET.toLocaleString('en-US', { timeZone: userTimezone }));

		// eslint-disable-next-line no-restricted-syntax -- fixed-locale demo countdown
		return userTime.toLocaleTimeString('en-US', {
			hour: '2-digit',
			minute: '2-digit',
			timeZone: userTimezone
		});
	}

	const midnightUserTime = $derived(getMidnightCETInUserTimezone());
</script>

{#if isDemoMode}
	<div
		class="border-b border-orange-200 bg-orange-50 px-4 py-3 text-orange-900 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-100"
		role="alert"
		aria-live="polite"
	>
		<div class="container mx-auto flex items-start gap-3 md:items-center">
			<AlertCircle class="mt-0.5 h-5 w-5 flex-shrink-0 md:mt-0" aria-hidden="true" />
			<div class="flex-1 text-sm">
				<p class="font-semibold">{m['demoBanner.demoMode']()}</p>
				<p class="mt-1">
					{@html m['demoBanner.description']({
						time: midnightUserTime,
						timezone: userTimezone
					}).replace(
						/<link>(.*?)<\/link>/,
						'<a href="https://mailpit.letsrevel.io" target="_blank" rel="noopener noreferrer" class="underline hover:no-underline font-medium">$1</a>'
					)}
				</p>
				<p class="mt-1 text-xs opacity-90">
					{m['demoBanner.slowHardwareWarning']()}
				</p>
			</div>
		</div>
	</div>
{/if}
