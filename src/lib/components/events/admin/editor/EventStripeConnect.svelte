<script lang="ts">
	import StripeConnectModal from '$lib/components/organization/StripeConnectModal.svelte';
	import { requestStripeOnboardingLink } from '$lib/components/organization/stripe-connect';
	import { authStore } from '$lib/stores/auth.svelte';

	interface Props {
		show: boolean;
		orgSlug: string;
		eventId: string;
		defaultEmail?: string;
	}

	let { show = $bindable(), orgSlug, eventId, defaultEmail = '' }: Props = $props();

	let isLoading = $state(false);
	let error = $state<string | null>(null);

	// Reset the last failure whenever the dialog is reopened.
	$effect(() => {
		if (show) error = null;
	});

	async function confirm(email: string): Promise<void> {
		isLoading = true;
		error = null;
		try {
			// Stripe sends the owner back to this event's ticketing tab.
			window.location.href = await requestStripeOnboardingLink(
				orgSlug,
				email,
				authStore.accessToken ?? '',
				'event',
				eventId
			);
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			isLoading = false;
		}
	}
</script>

<StripeConnectModal
	bind:show
	initialEmail={defaultEmail}
	{isLoading}
	{error}
	onConfirm={confirm}
	onCancel={() => {
		show = false;
		error = null;
	}}
/>
