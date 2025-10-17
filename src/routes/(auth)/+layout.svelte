<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { authStore } from '$lib/stores/auth.svelte';
	import AuthLayout from '$lib/components/common/AuthLayout.svelte';

	// Protect authenticated routes
	onMount(() => {
		if (!authStore.isAuthenticated) {
			goto('/login');
		}
	});
</script>

<AuthLayout>
	<slot />
</AuthLayout>
