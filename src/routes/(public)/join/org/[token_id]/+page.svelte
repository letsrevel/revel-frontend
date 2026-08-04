<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent } from '$lib/components/ui/card';
	import { Users, Shield, CheckCircle, Clock, Loader2 } from '@lucide/svelte';
	import { createMutation } from '@tanstack/svelte-query';
	import { organizationClaimInvitation } from '$lib/api/generated/sdk.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { toast } from 'svelte-sonner';
	import { getExpirationDisplay, formatTokenUsage } from '$lib/utils/tokens';
	import { escapeHtml } from '$lib/utils/sanitize';
	import { backendMessage } from '$lib/utils/api-error-detail';
	import Sticker from '$lib/components/brand/Sticker.svelte';
	import LogoChip from '$lib/components/brand/LogoChip.svelte';
	import PageHeader from '$lib/components/common/PageHeader.svelte';

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
				// 400 here is genuinely `ResponseMessage` ({message}) and 404 is
				// {detail} — one of only two endpoints where `.message` is real
				// (backend #824). Surface the backend's own sentence: "already
				// claimed" and "expired" need different remedies from the reader.
				throw new Error(backendMessage(response.error) ?? m['joinOrgPage.error_claimFailed']());
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
		onError: (error: Error) => {
			toast.error(error.message || m['joinOrgPage.toast_claimError']());
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

<!-- Poster ribbon + floating card (uplift, spec §9). A live invitation is an
     IMAGERY moment — an organization is inviting you — so it opens on the
     solid Hearty Purple ribbon the event page uses, mode-inert in both modes
     by the imagery rule, carrying the org's own logo as a tilted white
     sticker. Pairs are hand-verified against the fixed poster values (a
     poster-palette pair is invisible to scripts/audit-brand-themes.py, though
     these two ARE in its table):
       poster-white on poster-purple → 5.52:1 (title, kicker, subtitle)
       poster-purple on poster-white → 5.52:1 (the Sticker's own text)
     Sticker-chip rule: the chip shows the ORG'S logo or renders nothing —
     LogoChip enforces that itself, so a logo-less org simply gets a clean
     ribbon rather than the Revel mark as filler.

     The rejection state deliberately stays on the theme-aware `bg-secondary`
     band instead: "this link is no longer valid" is not an invitation, and a
     full-strength brand ribbon would be celebrating something that isn't
     happening. Copy and claim logic are untouched throughout. -->
<div class="min-h-[calc(100vh-4rem)] bg-background">
	{#if rejection}
		<section class="bg-secondary text-secondary-foreground">
			<div class="container mx-auto max-w-md px-4 pb-20 pt-10 text-center sm:pt-14">
				<PageHeader
					volume="poster"
					onBand
					title={m['joinOrgPage.rejectedTitle']()}
					subtitle={rejectionBody ?? undefined}
					class="text-center sm:flex-col sm:items-center"
				/>
			</div>
		</section>

		<div class="container mx-auto -mt-12 max-w-md px-4 pb-16">
			<Card>
				<CardContent class="space-y-6 p-6 text-center sm:p-8">
					<p class="text-sm text-muted-foreground">{m['joinOrgPage.rejectedHint']()}</p>
					<Button size="lg" class="w-full" href={resolve('/(public)/events', {})}>
						{m['joinOrgPage.rejectedCta']()}
					</Button>
				</CardContent>
			</Card>
		</div>
	{:else if token}
		<section class="bg-poster-purple text-poster-white">
			<div class="container relative mx-auto max-w-md px-4 pb-20 pt-10 text-center sm:pt-14">
				<!-- Pinned top-right; LogoChip owns its own transform, so the
				     positioning lives on this wrapper. Hidden on mobile, where the
				     column is too narrow for the type to clear it. -->
				<div class="absolute right-2 top-6 hidden sm:block">
					<LogoChip rotate={-8} logo={token.organization_logo_url} />
				</div>
				{#snippet celebrate()}
					<Sticker tint="ink" rotate={-3}>🎉</Sticker>
				{/snippet}
				<PageHeader
					volume="poster"
					onBand
					kicker={m['joinOrgPage.kicker']()}
					title={m['joinOrgPage.invitedTitle']()}
					decoration={celebrate}
					class="text-center sm:flex-col sm:items-center sm:pr-24"
				/>
				<!-- eslint-disable svelte/no-at-html-tags -- API-derived organization name neutralized via escapeHtml before interpolation into a developer-authored i18n template. Block form, not disable-next-line: prettier reflows the interpolation onto its own line and the single-line pragma stops lining up. -->
				<p class="mt-2 text-lg font-bold">
					{@html m['joinOrgPage.joinSubtitle']({
						organizationName: escapeHtml(token.organization_name)
					})}
				</p>
				<!-- eslint-enable svelte/no-at-html-tags -->
			</div>
		</section>

		<div class="container mx-auto -mt-12 max-w-md px-4 pb-16">
			<Card>
				<CardContent class="space-y-6 p-6 sm:p-8">
					<!-- Token Info -->
					<div class="space-y-3 rounded-lg border-2 border-border bg-muted p-4">
						<div class="flex items-center gap-2 text-sm">
							<Icon class="h-4 w-4" aria-hidden="true" />
							<span class="font-bold">{m['joinOrgPage.accessTypeLabel']()}</span>
							<span>{accessType}</span>
						</div>

						<div class="flex items-center gap-2 text-sm">
							<Clock class="h-4 w-4" aria-hidden="true" />
							<span class="font-bold">{m['joinOrgPage.expiresLabel']()}</span>
							<span>{expirationDisplay}</span>
						</div>

						<div class="flex items-center gap-2 text-sm">
							<Users class="h-4 w-4" aria-hidden="true" />
							<span class="font-bold">{m['joinOrgPage.usedLabel']()}</span>
							<span>{usageDisplay}</span>
						</div>
					</div>

					<!-- What you'll get -->
					<div class="space-y-2">
						<h2 class="font-extrabold">{m['joinOrgPage.benefitsTitle']()}</h2>
						<ul class="space-y-1 text-sm text-muted-foreground">
							{#if token.grants_staff_status}
								<li class="flex items-center gap-2">
									<CheckCircle class="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
									<span>{m['joinOrgPage.benefit_staffAccess']()}</span>
								</li>
								<li class="flex items-center gap-2">
									<CheckCircle class="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
									<span>{m['joinOrgPage.benefit_manageEventsMembers']()}</span>
								</li>
							{:else if token.grants_membership}
								<li class="flex items-center gap-2">
									<CheckCircle class="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
									<span>{m['joinOrgPage.benefit_memberAccess']()}</span>
								</li>
								{#if token.membership_tier_name}
									<li class="flex items-center gap-2">
										<CheckCircle class="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
										<span>
											{m['joinOrgPage.benefit_memberTier']({
												tierName: token.membership_tier_name
											})}
										</span>
									</li>
								{/if}
								<li class="flex items-center gap-2">
									<CheckCircle class="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
									<span>{m['joinOrgPage.benefit_membersOnlyEvents']()}</span>
								</li>
							{:else}
								<li class="flex items-center gap-2">
									<CheckCircle class="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
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
		</div>
	{/if}
</div>
