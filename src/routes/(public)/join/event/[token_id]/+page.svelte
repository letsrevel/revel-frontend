<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent } from '$lib/components/ui/card';
	import { Calendar, CheckCircle, Loader2, Ticket } from '@lucide/svelte';
	import { createMutation } from '@tanstack/svelte-query';
	import { eventpublicdiscoveryClaimInvitation } from '$lib/api/generated/sdk.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { toast } from 'svelte-sonner';
	import { getExpirationDisplay, formatTokenUsage } from '$lib/utils/tokens';
	import { formatEventDate } from '$lib/utils/date';
	import { backendMessage } from '$lib/utils/api-error-detail';
	import Sticker from '$lib/components/brand/Sticker.svelte';
	import PageHeader from '$lib/components/common/PageHeader.svelte';
	import { getImageUrl } from '$lib/utils/url';

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
			const response = await eventpublicdiscoveryClaimInvitation({
				path: { token: tokenId },
				headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
			});

			if (response.error) {
				// 400 here is genuinely `ResponseMessage` ({message}) and 404 is
				// {detail} — one of only two endpoints where `.message` is real
				// (backend #824). Surface the backend's own sentence: "already
				// claimed" and "expired" need different remedies from the reader.
				throw new Error(backendMessage(response.error) ?? m['joinEventPage.error_claimFailed']());
			}

			return response.data;
		},
		onSuccess: (evt) => {
			toast.success(m['joinEventPage.toast_invited']({ eventName: evt.name }));
			// The claim response carries no organization — the token does.
			goto(
				resolve('/(public)/events/[org_slug]/[event_slug]', {
					org_slug: token?.organization_slug ?? '',
					event_slug: evt.slug ?? token?.event_slug ?? ''
				})
			);
		},
		onError: (error: Error) => {
			toast.error(error.message || m['joinEventPage.toast_claimError']());
		}
	}));

	function handleClaim() {
		if (!isAuthenticated) {
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve() validates the route id; the appended query string cannot be expressed through resolve()
			goto(`${resolve('/(public)/login', {})}?redirect=/join/event/${tokenId}`);
			return;
		}

		claimMutation.mutate();
	}

	const expirationDisplay = $derived(getExpirationDisplay(token?.expires_at));
	const usageDisplay = $derived(formatTokenUsage(token?.uses, token?.max_uses));
	const formattedDate = $derived(token?.event_start ? formatEventDate(token.event_start) : null);
	const pageTitle = $derived(
		rejection
			? m['joinEventPage.rejectedTitle']()
			: m['joinEventPage.pageTitle']({ eventName: token?.event_name ?? '' })
	);
	const rejectionBody = $derived(
		rejection
			? rejection.reason === 'expired'
				? m['joinEventPage.rejectedExpired']({ eventName: rejection.event_name })
				: m['joinEventPage.rejectedUsedUp']({ eventName: rejection.event_name })
			: null
	);
</script>

<svelte:head>
	<title>{pageTitle} - Revel</title>
	{#if token}
		<meta
			name="description"
			content={m['joinEventPage.pageDescription']({ eventName: token.event_name })}
		/>
	{/if}
</svelte:head>

<!-- Poster ribbon + floating card (uplift, spec §9) — the org-token twin of
     this page carries the same treatment. A live invitation is an IMAGERY
     moment, so it opens on the solid Hearty Purple ribbon, mode-inert in both
     modes by the imagery rule. Hand-verified against the fixed poster values
     (both pairs are in scripts/audit-brand-themes.py's poster table):
       poster-white on poster-purple → 5.52:1 (title, kicker, subtitle)
       poster-purple on poster-white → 5.52:1 (the Sticker's own text)
     No sticker chip here, by the sticker-chip rule: an EVENT token preview
     carries the event's cover but no organization logo, and the Revel mark is
     never filler on someone else's invitation. The cover art becomes the
     ribbon's own image instead — the one identity mark this token can offer.

     The rejection state stays on the theme-aware `bg-secondary` band: a link
     that no longer works is not an invitation to celebrate. Copy and claim
     logic are untouched throughout. -->
<div class="min-h-[calc(100vh-4rem)] bg-background">
	{#if rejection}
		<section class="bg-secondary text-secondary-foreground">
			<div class="container mx-auto max-w-md px-4 pb-20 pt-10 text-center sm:pt-14">
				<PageHeader
					volume="poster"
					onBand
					title={m['joinEventPage.rejectedTitle']()}
					subtitle={rejectionBody ?? undefined}
					class="text-center sm:flex-col sm:items-center"
				/>
			</div>
		</section>

		<div class="container mx-auto -mt-12 max-w-md px-4 pb-16">
			<Card>
				<CardContent class="space-y-6 p-6 text-center sm:p-8">
					<p class="text-sm text-muted-foreground">{m['joinEventPage.rejectedHint']()}</p>
					<Button size="lg" class="w-full" href={resolve('/(public)/events', {})}>
						{m['joinEventPage.rejectedCta']()}
					</Button>
				</CardContent>
			</Card>
		</div>
	{:else if token}
		<section class="bg-poster-purple text-poster-white">
			<div class="container mx-auto max-w-md px-4 pb-20 pt-10 text-center sm:pt-14">
				{#if token.event_cover_url}
					<!-- Decorative: the event's name is the h1's own subtitle right
					     below, so an alt would only repeat it. -->
					<img
						src={getImageUrl(token.event_cover_url)}
						alt=""
						class="mx-auto mb-6 h-32 w-full rounded-lg border-2 border-poster-white object-cover shadow-poster-lg"
					/>
				{/if}
				{#snippet celebrate()}
					<Sticker tint="ink" rotate={-3}>🎉</Sticker>
				{/snippet}
				<PageHeader
					volume="poster"
					onBand
					kicker={m['joinEventPage.kicker']()}
					title={m['joinEventPage.invitedTitle']()}
					decoration={celebrate}
					class="text-center sm:flex-col sm:items-center"
				/>
				<p class="mt-2 text-lg font-bold">{token.event_name}</p>
			</div>
		</section>

		<div class="container mx-auto -mt-12 max-w-md px-4 pb-16">
			<Card>
				<CardContent class="space-y-6 p-6 sm:p-8">
					<!-- Event Info (the token preview exposes name/start/cover only) -->
					<div class="space-y-3 rounded-lg border-2 border-border bg-muted p-4">
						{#if formattedDate}
							<div class="flex items-start gap-2 text-sm">
								<Calendar class="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
								<div>
									<div class="font-bold">{m['joinEventPage.whenLabel']()}</div>
									<div class="text-muted-foreground">{formattedDate}</div>
								</div>
							</div>
						{/if}

						{#if token.ticket_tiers?.length}
							<div class="flex items-start gap-2 text-sm">
								<Ticket class="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
								<div>
									<div class="font-bold">{m['joinEventPage.ticketTierLabel']()}</div>
									<div class="text-muted-foreground">
										{token.ticket_tiers.map((t) => t.name).join(', ')}
									</div>
								</div>
							</div>
						{/if}
					</div>

					<!-- Token Info -->
					<div class="space-y-2 rounded-lg border-2 p-3 text-sm">
						<div class="flex items-center justify-between">
							<span class="text-muted-foreground">{m['joinEventPage.expiresLabel']()}</span>
							<span class="font-bold">{expirationDisplay}</span>
						</div>
						<div class="flex items-center justify-between">
							<span class="text-muted-foreground">{m['joinEventPage.usedLabel']()}</span>
							<span class="font-bold">{usageDisplay}</span>
						</div>
					</div>

					<!-- Custom Message -->
					{#if token.invitation_payload?.custom_message}
						<div class="rounded-lg border-2 border-border bg-muted p-4 text-sm">
							<p class="italic">{token.invitation_payload.custom_message}</p>
						</div>
					{/if}

					<!-- What you'll get -->
					<div class="space-y-2">
						<h2 class="font-extrabold">{m['joinEventPage.benefitsTitle']()}</h2>
						<ul class="space-y-1 text-sm text-muted-foreground">
							<li class="flex items-center gap-2">
								<CheckCircle class="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
								<span>{m['joinEventPage.benefit_invitation']()}</span>
							</li>
							{#if token.ticket_tiers?.length}
								<li class="flex items-center gap-2">
									<CheckCircle class="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
									<span>{m['joinEventPage.benefit_autoTicket']()}</span>
								</li>
							{/if}
							<li class="flex items-center gap-2">
								<CheckCircle class="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
								<span>{m['joinEventPage.benefit_rsvpConfirmation']()}</span>
							</li>
						</ul>
					</div>

					<!-- Action Button -->
					<Button size="lg" class="w-full" onclick={handleClaim} disabled={claimMutation.isPending}>
						{#if claimMutation.isPending}
							<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
							{m['joinEventPage.claimingButton']()}
						{:else if !isAuthenticated}
							{m['joinEventPage.signInButton']()}
						{:else}
							{m['joinEventPage.claimButton']()}
						{/if}
					</Button>

					<p class="text-center text-xs text-muted-foreground">
						{m['joinEventPage.agreementText']()}
					</p>
				</CardContent>
			</Card>
		</div>
	{/if}
</div>
