<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import { Users, Shield, CheckCircle, Clock, Loader2 } from '@lucide/svelte';
	import { createMutation } from '@tanstack/svelte-query';
	import { organizationClaimInvitation } from '$lib/api/generated/sdk.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { toast } from 'svelte-sonner';
	import { getExpirationDisplay, formatTokenUsage } from '$lib/utils/tokens';
	import { escapeHtml } from '$lib/utils/sanitize';

	const { data }: { data: PageData } = $props();

	const token = $derived(data.token);
	const rejection = $derived(data.rejection);
	// The schema marks id as nullable, but the preview endpoint always returns
	// it; the URL param is the authoritative fallback.
	const tokenId = $derived(token?.id ?? data.tokenId);
	const isAuthenticated = $derived(authStore.isAuthenticated);
	const accessToken = $derived(authStore.accessToken);

	// Claim mutation
	const claimMutation = createMutation(() => ({
		mutationFn: async () => {
			const response = await organizationClaimInvitation({
				path: { token: tokenId },
				headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
			});

			if (response.error) {
				throw new Error(m['joinOrgPage.error_claimFailed']());
			}

			return response.data;
		},
		onSuccess: (org) => {
			toast.success(
				token?.grants_staff_status
					? m['joinOrgPage.toast_joinedAsStaff']({ organizationName: org.name })
					: m['joinOrgPage.toast_joinedAsMember']({ organizationName: org.name })
			);
			goto(resolve('/(public)/org/[slug]', { slug: org.slug }));
		},
		onError: () => {
			toast.error(m['joinOrgPage.toast_claimError']());
		}
	}));

	function handleClaim() {
		if (!isAuthenticated) {
			// Redirect to login with return URL
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve() validates the route id; the appended query string cannot be expressed through resolve()
			goto(`${resolve('/(public)/login', {})}?redirect=/join/org/${tokenId}`);
			return;
		}

		claimMutation.mutate();
	}

	const expirationDisplay = $derived(getExpirationDisplay(token?.expires_at));
	const usageDisplay = $derived(formatTokenUsage(token?.uses, token?.max_uses));
	const accessType = $derived(
		token?.grants_staff_status
			? m['joinOrgPage.accessType_staff']()
			: token?.grants_membership
				? m['joinOrgPage.accessType_member']()
				: m['joinOrgPage.accessType_view']()
	);
	const Icon = $derived(token?.grants_staff_status ? Shield : Users);
	const pageTitle = $derived(
		rejection
			? m['joinOrgPage.rejectedTitle']()
			: m['joinOrgPage.pageTitle']({ organizationName: token?.organization_name ?? '' })
	);
	const rejectionBody = $derived(
		rejection
			? rejection.reason === 'expired'
				? m['joinOrgPage.rejectedExpired']({ organizationName: rejection.organization_name })
				: m['joinOrgPage.rejectedUsedUp']({ organizationName: rejection.organization_name })
			: null
	);
</script>

<svelte:head>
	<title>{pageTitle} - Revel</title>
	{#if token}
		<meta
			name="description"
			content={m['joinOrgPage.pageDescription']({ organizationName: token.organization_name })}
		/>
	{/if}
</svelte:head>

<div class="container mx-auto flex min-h-[80vh] items-center justify-center px-4 py-12">
	{#if rejection}
		<Card class="w-full max-w-md">
			<CardHeader class="text-center">
				<CardTitle class="text-2xl">{m['joinOrgPage.rejectedTitle']()}</CardTitle>
				<CardDescription class="text-lg">{rejectionBody}</CardDescription>
			</CardHeader>
			<CardContent class="space-y-6 text-center">
				<p class="text-sm text-muted-foreground">{m['joinOrgPage.rejectedHint']()}</p>
				<Button size="lg" class="w-full" href={resolve('/(public)/events', {})}>
					{m['joinOrgPage.rejectedCta']()}
				</Button>
			</CardContent>
		</Card>
	{:else if token}
		<Card class="w-full max-w-md">
			<CardHeader class="text-center">
				{#if token.organization_logo_url}
					<img
						src={token.organization_logo_url}
						alt={token.organization_name}
						class="mx-auto mb-4 h-20 w-20 rounded-full object-cover"
					/>
				{/if}
				<CardTitle class="text-2xl">{m['joinOrgPage.invitedTitle']()}</CardTitle>
				<CardDescription class="text-lg">
					<!-- eslint-disable-next-line svelte/no-at-html-tags -- API-derived organization name neutralized via escapeHtml before interpolation into a developer-authored i18n template -->
					{@html m['joinOrgPage.joinSubtitle']({
						organizationName: escapeHtml(token.organization_name)
					})}
				</CardDescription>
			</CardHeader>

			<CardContent class="space-y-6">
				<!-- Token Info -->
				<div class="space-y-3 rounded-lg bg-muted p-4">
					<div class="flex items-center gap-2 text-sm">
						<Icon class="h-4 w-4" aria-hidden="true" />
						<span class="font-medium">{m['joinOrgPage.accessTypeLabel']()}</span>
						<span>{accessType}</span>
					</div>

					<div class="flex items-center gap-2 text-sm">
						<Clock class="h-4 w-4" aria-hidden="true" />
						<span class="font-medium">{m['joinOrgPage.expiresLabel']()}</span>
						<span>{expirationDisplay}</span>
					</div>

					<div class="flex items-center gap-2 text-sm">
						<Users class="h-4 w-4" aria-hidden="true" />
						<span class="font-medium">{m['joinOrgPage.usedLabel']()}</span>
						<span>{usageDisplay}</span>
					</div>
				</div>

				<!-- What you'll get -->
				<div class="space-y-2">
					<h3 class="font-semibold">{m['joinOrgPage.benefitsTitle']()}</h3>
					<ul class="space-y-1 text-sm text-muted-foreground">
						{#if token.grants_staff_status}
							<li class="flex items-center gap-2">
								<CheckCircle class="h-4 w-4 text-green-600" aria-hidden="true" />
								<span>{m['joinOrgPage.benefit_staffAccess']()}</span>
							</li>
							<li class="flex items-center gap-2">
								<CheckCircle class="h-4 w-4 text-green-600" aria-hidden="true" />
								<span>{m['joinOrgPage.benefit_manageEventsMembers']()}</span>
							</li>
						{:else if token.grants_membership}
							<li class="flex items-center gap-2">
								<CheckCircle class="h-4 w-4 text-green-600" aria-hidden="true" />
								<span>{m['joinOrgPage.benefit_memberAccess']()}</span>
							</li>
							{#if token.membership_tier_name}
								<li class="flex items-center gap-2">
									<CheckCircle class="h-4 w-4 text-green-600" aria-hidden="true" />
									<span>
										{m['joinOrgPage.benefit_memberTier']({ tierName: token.membership_tier_name })}
									</span>
								</li>
							{/if}
							<li class="flex items-center gap-2">
								<CheckCircle class="h-4 w-4 text-green-600" aria-hidden="true" />
								<span>{m['joinOrgPage.benefit_membersOnlyEvents']()}</span>
							</li>
						{:else}
							<li class="flex items-center gap-2">
								<CheckCircle class="h-4 w-4 text-green-600" aria-hidden="true" />
								<span>{m['joinOrgPage.benefit_viewDetails']()}</span>
							</li>
						{/if}
					</ul>
				</div>

				<!-- Action Button -->
				<Button size="lg" class="w-full" onclick={handleClaim} disabled={claimMutation.isPending}>
					{#if claimMutation.isPending}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
						{m['joinOrgPage.claimingButton']()}
					{:else if !isAuthenticated}
						{m['joinOrgPage.signInButton']()}
					{:else}
						{m['joinOrgPage.claimButton']({ accessType })}
					{/if}
				</Button>

				<p class="text-center text-xs text-muted-foreground">
					{m['joinOrgPage.agreementText']({ organizationName: token.organization_name })}
				</p>
			</CardContent>
		</Card>
	{/if}
</div>
