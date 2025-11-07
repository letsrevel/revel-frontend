<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/ui/button';
	import { authStore } from '$lib/stores/auth.svelte';
	import { organizationClaimInvitation } from '$lib/api/generated/sdk.gen';
	import { Loader2, Check, LogIn } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import type { OrganizationTokenSchema } from '$lib/api/generated/types.gen';

	interface Props {
		tokenId: string;
		tokenDetails?: OrganizationTokenSchema | null;
		organizationName?: string;
		class?: string;
		onSuccess?: () => void;
	}

	let {
		tokenId,
		tokenDetails,
		organizationName = m['claimMembershipButton.thisOrganization'](),
		class: className,
		onSuccess
	}: Props = $props();

	const isAuthenticated = $derived(!!authStore.accessToken);
	const accessToken = $derived(authStore.accessToken);

	let isLoading = $state(false);
	let showSuccess = $state(false);

	async function handleClaim() {
		if (!isAuthenticated) {
			const currentUrl = window.location.pathname + window.location.search;
			goto(`/login?redirect=${encodeURIComponent(currentUrl)}`);
			return;
		}

		isLoading = true;

		try {
			const response = await organizationClaimInvitation({
				path: { token: tokenId },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				const errorDetail = (response.error as any)?.detail;
				throw new Error(
					typeof errorDetail === 'string'
						? errorDetail
						: m['claimMembershipButton.error_failedToClaim']()
				);
			}

			showSuccess = true;
			toast.success(m['claimMembershipButton.successClaimed']());

			onSuccess?.();

			setTimeout(() => {
				window.location.reload();
			}, 1000);
		} catch (err: any) {
			console.error('Failed to claim membership:', err);
			toast.error(err.message || m['claimMembershipButton.error_failedToClaim']());
		} finally {
			isLoading = false;
		}
	}

	let buttonText = $derived.by(() => {
		if (showSuccess) return m['claimMembershipButton.claimed']();
		if (!isAuthenticated) return m['claimMembershipButton.loginToClaim']();
		return m['claimMembershipButton.claimMembership']();
	});

	let grantsMembership = $derived(tokenDetails?.grants_membership ?? true);
</script>

{#if grantsMembership}
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
