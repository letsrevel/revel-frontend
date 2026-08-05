<script lang="ts">
	import { AlertTriangle, Clock, User } from '@lucide/svelte';
	import { authStore } from '$lib/stores/auth.svelte';
	import { getImpersonationInfo, getTokenExpiration } from '$lib/utils/impersonation';
	import * as m from '$lib/paraglide/messages.js';

	// Get impersonation info from the current access token
	const impersonationInfo = $derived(getImpersonationInfo(authStore.accessToken));

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
	<!-- Impersonation → danger tone (this is a privileged, high-stakes state).
	     The outer sticky element is opaque (bg-background): this banner is
	     `sticky top-0`, so a translucent tint directly on it would composite
	     over whatever page content has scrolled underneath, not over
	     --background as every ratio below assumes. The tint lives on the inner
	     wrapper, which now genuinely sits on --background.

	     Soft fill reuses ToneTile's audited danger pair: text-destructive on
	     bg-destructive/10 measures 7.20:1 on the page background (light); dark
	     keeps the stronger bg-destructive/25 tint (a /10 red wash is nearly
	     invisible on aubergine) and measures 5.84:1 — both rows are
	     COMPOSITED_PAIRS entries in scripts/audit-brand-themes.py. Since #781
	     split the destructive token, `text-destructive` is the AA-safe text
	     half in both modes; it used to resolve to the FILL value, which
	     measured 2.95:1 in dark and forced a white-out here.

	     Two recipes here stay HAND-checked, because the audit script models a
	     single alpha layer and both of these stack two:
	       · the "less prominent" spans dim the pair with `opacity-90` — 6.10:1
	         light / 5.03:1 dark. They were opacity-80 while the dark copy was
	         white; at the semantic rose that same 80% measured 4.28:1, under
	         the floor, so the dimming was eased rather than the color dropped.
	       · the time-remaining chip lays a second tint over the tinted banner.
	         It is `bg-destructive/20` in BOTH modes now (it used to bump to /30
	         under the white text): 5.04:1 light / 4.97:1 dark. At /30 the dark
	         figure fell to 4.54:1 — passing, but with no room for a token nudge.
	     The pulsing "expiring soon" chip is a fully opaque bg-destructive /
	     text-destructive-foreground pair (9.75:1 light / 5.88:1 dark), same as
	     StatusBadge, and IS audited. -->
	<div class="sticky top-0 z-[100] bg-background" role="alert" aria-live="assertive">
		<div
			class="border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-destructive dark:bg-destructive/25"
		>
			<div class="container mx-auto flex flex-wrap items-center justify-between gap-2">
				<div class="flex items-center gap-3">
					<AlertTriangle class="h-5 w-5 flex-shrink-0" aria-hidden="true" />
					<div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
						<span role="heading" aria-level="2" class="font-bold"
							>{m['impersonationBanner.title']()}</span
						>
						<span class="flex items-center gap-1">
							<User class="h-4 w-4" aria-hidden="true" />
							<span class="font-medium"
								>{authStore.user?.display_name ?? authStore.user?.email}</span
							>
							{#if authStore.user?.email}
								<span class="opacity-90">({authStore.user.email})</span>
							{/if}
						</span>
						{#if impersonationInfo.impersonatedByName || impersonationInfo.impersonatedByEmail}
							<span class="opacity-90">
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
						class="flex items-center gap-2 rounded-md px-2 py-1 text-sm font-bold {isExpiringSoon
							? 'animate-pulse bg-destructive text-destructive-foreground'
							: 'bg-destructive/20 text-destructive'}"
						title={m['impersonationBanner.timeRemainingTitle']()}
					>
						<Clock class="h-4 w-4" aria-hidden="true" />
						<span aria-label={m['impersonationBanner.timeRemainingLabel']({ time: timeRemaining })}>
							{timeRemaining}
						</span>
					</div>
				{/if}
			</div>

			<p class="container mx-auto mt-1 text-xs opacity-90">
				{m['impersonationBanner.notice']()}
			</p>
		</div>
	</div>
{/if}
