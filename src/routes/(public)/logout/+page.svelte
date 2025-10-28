<script lang="ts">
	import { onMount } from 'svelte';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Loader2 } from 'lucide-svelte';

	/**
	 * Client-side logout page
	 * Clears the auth store immediately before server clears cookies
	 * This ensures the UI updates instantly without waiting for server redirect
	 */
	onMount(() => {
		console.log('[LOGOUT PAGE] Clearing client-side auth state');
		// Clear client-side auth state immediately
		authStore.logout();
	});
</script>

<div class="flex min-h-screen items-center justify-center">
	<div class="text-center">
		<Loader2 class="mx-auto h-8 w-8 animate-spin text-primary" aria-hidden="true" />
		<p class="mt-4 text-muted-foreground">Logging out...</p>
	</div>
</div>
