<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Loader2 } from 'lucide-svelte';

	/**
	 * Client-side logout page
	 * Clears the auth store immediately before server clears cookies
	 * This ensures the UI updates instantly without waiting for server redirect
	 */
	onMount(async () => {
		console.log('[LOGOUT PAGE] Clearing client-side auth state');
		// Clear client-side auth state immediately
		authStore.logout();
		// Invalidate all data to ensure layout reloads
		await invalidateAll();
	});
</script>

<div class="flex min-h-screen items-center justify-center">
	<div class="text-center">
		<Loader2 class="mx-auto h-8 w-8 animate-spin text-primary" aria-hidden="true" />
		<p class="mt-4 text-muted-foreground">{m['logoutPage.loggingOut']()}</p>
	</div>
</div>
