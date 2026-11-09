<script lang="ts">
	import { AlertCircle } from '@lucide/svelte';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import type { DescribedError } from '$lib/member-register/errors';

	interface Props {
		error: DescribedError;
	}

	const { error }: Props = $props();
</script>

<Alert variant="destructive" role="alert" data-testid="register-error">
	<AlertCircle class="h-4 w-4" aria-hidden="true" />
	<AlertDescription>
		<p>{error.message}</p>
		{#if error.detail && error.detail !== error.message}
			<p class="mt-1 text-sm">{error.detail}</p>
		{/if}
	</AlertDescription>
</Alert>
