<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { page } from '$app/state';
	import { CalendarOff } from '@lucide/svelte';

	/**
	 * Embeds render inside someone else's page, often in a box a few hundred
	 * pixels tall. The app-wide error page — full-bleed artwork, navigation back
	 * into Revel — is the wrong shape there, so `/embed/*` failures (a mistyped
	 * organization slug, a since-deleted event) get this compact panel instead.
	 * The HTTP status is still the real one; only the presentation is scoped.
	 */
</script>

<svelte:head>
	<title>{m['embed.unavailableTitle']()}</title>
</svelte:head>

<div
	class="flex flex-col items-center gap-2 px-4 py-10 text-center"
	role="status"
	aria-live="polite"
>
	<CalendarOff class="h-8 w-8 text-muted-foreground" aria-hidden="true" />
	<p class="text-sm font-medium">{m['embed.unavailableTitle']()}</p>
	<p class="text-xs text-muted-foreground">
		{page.status === 404 ? m['embed.unavailableNotFound']() : m['embed.unavailableBody']()}
	</p>
</div>
