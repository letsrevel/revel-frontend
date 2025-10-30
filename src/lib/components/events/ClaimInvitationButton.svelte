<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { authStore } from '$lib/stores/auth.svelte';
	import { eventClaimInvitation } from '$lib/api/generated/sdk.gen';
	import { Loader2, Check, LogIn } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import type { EventTokenSchema } from '$lib/api/generated/types.gen';

	interface Props {
		tokenId: string;
		tokenDetails?: EventTokenSchema | null;
		eventName?: string;
		class?: string;
		onSuccess?: () => void;
	}

	let { tokenId, tokenDetails, class: className, onSuccess }: Props = $props();

	const isAuthenticated = $derived(!!authStore.accessToken);
	const accessToken = $derived(authStore.accessToken);

	let isLoading = $state(false);
	let showSuccess = $state(false);

	async function handleClaim() {
		if (!isAuthenticated) {
			// Redirect to login with return URL
			const currentUrl = window.location.pathname + window.location.search;
			goto(`/login?redirect=${encodeURIComponent(currentUrl)}`);
			return;
		}

		isLoading = true;

		try {
			const response = await eventClaimInvitation({
				path: { token: tokenId },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				const errorDetail = (response.error as any)?.detail;
				throw new Error(
					typeof errorDetail === 'string' ? errorDetail : 'Failed to claim invitation'
				);
			}

			showSuccess = true;
			toast.success('Invitation claimed successfully!');

			onSuccess?.();

			// Reload page after a short delay to show updated status
			setTimeout(() => {
				window.location.reload();
			}, 1000);
		} catch (err: any) {
			console.error('Failed to claim invitation:', err);
			toast.error(err.message || 'Failed to claim invitation');
		} finally {
			isLoading = false;
		}
	}

	// Determine button text based on login state and token details
	let buttonText = $derived.by(() => {
		if (showSuccess) return 'Claimed!';
		if (!isAuthenticated) return 'Log in to claim invitation';
		return 'Claim Invitation';
	});

	// Check if token grants invitation
	let grantsInvitation = $derived(tokenDetails?.grants_invitation ?? true);
</script>

<!--
  Claim Invitation Button Component

  Shows a button to claim an event invitation via token.
  - If user is logged in: Shows "Claim Invitation" button
  - If user is logged out: Shows "Log in to claim invitation" button and redirects to login
  - On success: Reloads the page to show updated eligibility status

  @component
  @example
  <ClaimInvitationButton
    tokenId={tokenId}
    tokenDetails={eventTokenDetails}
    eventName={event.name}
  />
-->
{#if grantsInvitation}
	<Button
		variant="default"
		disabled={isLoading || showSuccess}
		onclick={handleClaim}
		class={className}
	>
		{#if isLoading}
			<Loader2 class="h-5 w-5 animate-spin" aria-hidden="true" />
		{:else if showSuccess}
			<Check class="h-5 w-5" aria-hidden="true" />
		{:else if !isAuthenticated}
			<LogIn class="h-5 w-5" aria-hidden="true" />
		{/if}
		<span>{buttonText}</span>
	</Button>
{/if}
