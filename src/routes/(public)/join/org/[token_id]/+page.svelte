<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Users, Shield, CheckCircle, Clock, Loader2 } from 'lucide-svelte';
	import { createMutation } from '@tanstack/svelte-query';
	import { organizationClaimInvitation } from '$lib/api/generated/sdk.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { toast } from 'svelte-sonner';
	import { getExpirationDisplay, formatTokenUsage } from '$lib/utils/tokens';

	let { data }: { data: PageData } = $props();

	const token = $derived(data.token);
	const isAuthenticated = $derived(authStore.isAuthenticated);
	const accessToken = $derived(authStore.accessToken);

	// Claim mutation
	const claimMutation = createMutation(() => ({
		mutationFn: async () => {
			const response = await organizationClaimInvitation({
				path: { token: token.id },
				headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
			});

			if (response.error) {
				throw new Error('Failed to claim invitation');
			}

			return response.data;
		},
		onSuccess: (org) => {
			toast.success(`You're now a ${token.grants_staff_status ? 'staff member' : 'member'} of ${org.name}!`);
			goto(`/org/${org.slug}`);
		},
		onError: () => {
			toast.error('Failed to claim invitation. The token may be expired or invalid.');
		}
	}));

	function handleClaim() {
		if (!isAuthenticated) {
			// Redirect to login with return URL
			goto(`/login?redirect=/join/org/${token.id}`);
			return;
		}

		claimMutation.mutate();
	}

	const expirationDisplay = $derived(getExpirationDisplay(token.expires_at));
	const usageDisplay = $derived(formatTokenUsage(token.uses, token.max_uses));
	const accessType = $derived(
		token.grants_staff_status ? 'Staff Access' : token.grants_membership ? 'Member Access' : 'View Access'
	);
	const Icon = $derived(token.grants_staff_status ? Shield : Users);
</script>

<svelte:head>
	<title>Join {token.organization.name} - Revel</title>
	<meta name="description" content="You've been invited to join {token.organization.name}" />
</svelte:head>

<div class="container mx-auto flex min-h-[80vh] items-center justify-center px-4 py-12">
	<Card class="w-full max-w-md">
		<CardHeader class="text-center">
			{#if token.organization.logo}
				<img
					src={token.organization.logo}
					alt={token.organization.name}
					class="mx-auto mb-4 h-20 w-20 rounded-full object-cover"
				/>
			{/if}
			<CardTitle class="text-2xl">You've been invited!</CardTitle>
			<CardDescription class="text-lg">
				Join <strong>{token.organization.name}</strong>
			</CardDescription>
		</CardHeader>

		<CardContent class="space-y-6">
			<!-- Token Info -->
			<div class="space-y-3 rounded-lg bg-muted p-4">
				<div class="flex items-center gap-2 text-sm">
					<svelte:component this={Icon} class="h-4 w-4" aria-hidden="true" />
					<span class="font-medium">Access Type:</span>
					<span>{accessType}</span>
				</div>

				<div class="flex items-center gap-2 text-sm">
					<Clock class="h-4 w-4" aria-hidden="true" />
					<span class="font-medium">Expires:</span>
					<span>{expirationDisplay}</span>
				</div>

				<div class="flex items-center gap-2 text-sm">
					<Users class="h-4 w-4" aria-hidden="true" />
					<span class="font-medium">Used:</span>
					<span>{usageDisplay}</span>
				</div>
			</div>

			<!-- What you'll get -->
			<div class="space-y-2">
				<h3 class="font-semibold">What you'll get:</h3>
				<ul class="space-y-1 text-sm text-muted-foreground">
					{#if token.grants_staff_status}
						<li class="flex items-center gap-2">
							<CheckCircle class="h-4 w-4 text-green-600" aria-hidden="true" />
							<span>Staff access with permissions</span>
						</li>
						<li class="flex items-center gap-2">
							<CheckCircle class="h-4 w-4 text-green-600" aria-hidden="true" />
							<span>Manage events and members</span>
						</li>
					{:else if token.grants_membership}
						<li class="flex items-center gap-2">
							<CheckCircle class="h-4 w-4 text-green-600" aria-hidden="true" />
							<span>Member access to organization</span>
						</li>
						<li class="flex items-center gap-2">
							<CheckCircle class="h-4 w-4 text-green-600" aria-hidden="true" />
							<span>Access to members-only events</span>
						</li>
					{:else}
						<li class="flex items-center gap-2">
							<CheckCircle class="h-4 w-4 text-green-600" aria-hidden="true" />
							<span>View organization details</span>
						</li>
					{/if}
				</ul>
			</div>

			<!-- Action Button -->
			<Button
				size="lg"
				class="w-full"
				onclick={handleClaim}
				disabled={claimMutation.isPending}
			>
				{#if claimMutation.isPending}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
					Claiming...
				{:else if !isAuthenticated}
					Sign In to Claim
				{:else}
					Claim {accessType}
				{/if}
			</Button>

			<p class="text-center text-xs text-muted-foreground">
				By claiming, you agree to join {token.organization.name}
			</p>
		</CardContent>
	</Card>
</div>
