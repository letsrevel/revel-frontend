<script lang="ts">
	import { AlertTriangle, Clock, User } from 'lucide-svelte';
	import { authStore } from '$lib/stores/auth.svelte';
	import { getImpersonationInfo, getTokenExpiration } from '$lib/utils/impersonation';
	import * as m from '$lib/paraglide/messages.js';

	// Get impersonation info from the current access token
	let impersonationInfo = $derived(getImpersonationInfo(authStore.accessToken));

	// Calculate time remaining until session expires
	let timeRemaining = $state<string | null>(null);
	let isExpiringSoon = $state(false);

	// Update time remaining every second
	$effect(() => {
		if (!impersonationInfo.isImpersonated || !authStore.accessToken) {
			timeRemaining = null;
			return;
		}

		const expiration = getTokenExpiration(authStore.accessToken);
		if (!expiration) {
			timeRemaining = null;
			return;
		}

		// Update immediately
		updateTimeRemaining(expiration);

		// Then update every second
		const interval = setInterval(() => {
			updateTimeRemaining(expiration);
		}, 1000);

		return () => clearInterval(interval);
	});

	function updateTimeRemaining(expiration: number) {
		const now = Date.now();
		const remaining = expiration - now;

		if (remaining <= 0) {
			timeRemaining = m['impersonationBanner.expired']();
			isExpiringSoon = true;
			return;
		}

		const minutes = Math.floor(remaining / 60000);
		const seconds = Math.floor((remaining % 60000) / 1000);

		// Format as MM:SS
		timeRemaining = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

		// Warn when less than 2 minutes remaining
		isExpiringSoon = minutes < 2;
	}
</script>

{#if impersonationInfo.isImpersonated}
	<div
		class="sticky top-0 z-[100] border-b border-amber-300 bg-amber-100 px-4 py-2 text-amber-900 dark:border-amber-700 dark:bg-amber-900/90 dark:text-amber-100"
		role="alert"
		aria-live="assertive"
	>
		<div class="container mx-auto flex flex-wrap items-center justify-between gap-2">
			<div class="flex items-center gap-3">
				<AlertTriangle
					class="h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400"
					aria-hidden="true"
				/>
				<div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
					<span class="font-semibold">{m['impersonationBanner.title']()}</span>
					<span class="flex items-center gap-1">
						<User class="h-4 w-4" aria-hidden="true" />
						<span class="font-medium">{authStore.user?.display_name ?? authStore.user?.email}</span>
						{#if authStore.user?.email}
							<span class="text-amber-700 dark:text-amber-300">({authStore.user.email})</span>
						{/if}
					</span>
					{#if impersonationInfo.impersonatedByName || impersonationInfo.impersonatedByEmail}
						<span class="text-amber-700 dark:text-amber-300">
							| {m['impersonationBanner.by']()}
							<span class="font-medium">
								{impersonationInfo.impersonatedByName ?? impersonationInfo.impersonatedByEmail}
							</span>
						</span>
					{/if}
				</div>
			</div>

			{#if timeRemaining}
				<div
					class="flex items-center gap-2 rounded-md px-2 py-1 text-sm font-medium {isExpiringSoon
						? 'animate-pulse bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-100'
						: 'bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-100'}"
					title={m['impersonationBanner.timeRemainingTitle']()}
				>
					<Clock class="h-4 w-4" aria-hidden="true" />
					<span aria-label={m['impersonationBanner.timeRemainingLabel']({ time: timeRemaining })}>
						{timeRemaining}
					</span>
				</div>
			{/if}
		</div>

		<p class="container mx-auto mt-1 text-xs text-amber-700 dark:text-amber-300">
			{m['impersonationBanner.notice']()}
		</p>
	</div>
{/if}
