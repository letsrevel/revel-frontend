<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { AlertCircle } from '@lucide/svelte';

	interface Props {
		errorMessage: string;
		requiresAccount: boolean;
	}

	const { errorMessage, requiresAccount }: Props = $props();
</script>

<Alert variant="destructive">
	<AlertCircle class="h-4 w-4" />
	<AlertDescription>
		{errorMessage}
		{#if requiresAccount}
			<p class="mt-2">
				<!-- eslint-disable svelte/no-navigation-without-resolve -- resolve() validates the path; the appended query/fragment cannot be expressed through resolve() -->
				<a
					href={`${resolve('/(public)/login', {})}?redirect=${encodeURIComponent(window.location.pathname)}`}
					class="font-medium underline hover:no-underline"
				>
					{m['guestTicketDialog.logIn']()}
				</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
				{m['guestTicketDialog.or']()}
				<!-- eslint-disable svelte/no-navigation-without-resolve -- resolve() validates the path; the appended query/fragment cannot be expressed through resolve() -->
				<a
					href={`${resolve('/(public)/register', {})}?redirect=${encodeURIComponent(window.location.pathname)}`}
					class="font-medium underline hover:no-underline"
				>
					{m['guestTicketDialog.createAnAccount']()}
				</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
				{m['guestTicketDialog.toContinue']()}
			</p>
		{/if}
	</AlertDescription>
</Alert>
