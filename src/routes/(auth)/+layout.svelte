<script lang="ts">
	import { onMount } from 'svelte';
	import { authStore } from '$lib/stores/auth.svelte';
	import AuthLayout from '$lib/components/common/AuthLayout.svelte';

	interface Props {
		children: import('svelte').Snippet;
	}

	let { children }: Props = $props();

	// Debug: log when this layout mounts
	onMount(() => {
		console.log('[AUTH LAYOUT] Mounted on authenticated route', {
			isAuthenticated: authStore.isAuthenticated,
			hasUser: !!authStore.user,
			hasAccessToken: !!authStore.accessToken
		});
	});
</script>

<AuthLayout>
	{@render children()}
</AuthLayout>
