<script lang="ts">
	import AuthLayout from '$lib/components/common/AuthLayout.svelte';

	interface Props {
		children: import('svelte').Snippet;
	}

	const { children }: Props = $props();
</script>

<AuthLayout>
	{@render children()}
</AuthLayout>
