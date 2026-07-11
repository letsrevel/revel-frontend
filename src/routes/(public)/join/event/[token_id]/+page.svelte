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
	import { Calendar, CheckCircle, Loader2, Ticket } from '@lucide/svelte';
	import { createMutation } from '@tanstack/svelte-query';
	import { eventpublicdiscoveryClaimInvitation } from '$lib/api/generated/sdk.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { toast } from 'svelte-sonner';
	import { getExpirationDisplay, formatTokenUsage } from '$lib/utils/tokens';
	import { formatEventDate } from '$lib/utils/date';

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
				throw new Error(m['joinEventPage.error_claimFailed']());
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
		onError: () => {
			toast.error(m['joinEventPage.toast_claimError']());
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

<div class="container mx-auto flex min-h-[80vh] items-center justify-center px-4 py-12">
	{#if rejection}
		<Card class="w-full max-w-md">
			<CardHeader class="text-center">
				<CardTitle class="text-2xl">{m['joinEventPage.rejectedTitle']()}</CardTitle>
				<CardDescription class="text-lg">{rejectionBody}</CardDescription>
			</CardHeader>
			<CardContent class="space-y-6 text-center">
				<p class="text-sm text-muted-foreground">{m['joinEventPage.rejectedHint']()}</p>
				<Button size="lg" class="w-full" href={resolve('/(public)/events', {})}>
					{m['joinEventPage.rejectedCta']()}
				</Button>
			</CardContent>
		</Card>
	{:else if token}
		<Card class="w-full max-w-md">
			<CardHeader class="text-center">
				{#if token.event_cover_url}
					<img
						src={token.event_cover_url}
						alt={token.event_name}
						class="mx-auto mb-4 h-32 w-full rounded-lg object-cover"
					/>
				{/if}
				<CardTitle class="text-2xl">{m['joinEventPage.invitedTitle']()}</CardTitle>
				<CardDescription class="text-lg">
					<strong>{token.event_name}</strong>
				</CardDescription>
			</CardHeader>

			<CardContent class="space-y-6">
				<!-- Event Info (the token preview exposes name/start/cover only) -->
				<div class="space-y-3 rounded-lg bg-muted p-4">
					{#if formattedDate}
						<div class="flex items-start gap-2 text-sm">
							<Calendar class="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
							<div>
								<div class="font-medium">{m['joinEventPage.whenLabel']()}</div>
								<div class="text-muted-foreground">{formattedDate}</div>
							</div>
						</div>
					{/if}

					{#if token.ticket_tiers?.length}
						<div class="flex items-start gap-2 text-sm">
							<Ticket class="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
							<div>
								<div class="font-medium">{m['joinEventPage.ticketTierLabel']()}</div>
								<div class="text-muted-foreground">
									{token.ticket_tiers.map((t) => t.name).join(', ')}
								</div>
							</div>
						</div>
					{/if}
				</div>

				<!-- Token Info -->
				<div class="space-y-2 rounded-lg border p-3 text-sm">
					<div class="flex items-center justify-between">
						<span class="text-muted-foreground">{m['joinEventPage.expiresLabel']()}</span>
						<span class="font-medium">{expirationDisplay}</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-muted-foreground">{m['joinEventPage.usedLabel']()}</span>
						<span class="font-medium">{usageDisplay}</span>
					</div>
				</div>

				<!-- Custom Message -->
				{#if token.invitation_payload?.custom_message}
					<div class="rounded-lg bg-muted p-4 text-sm">
						<p class="italic">{token.invitation_payload.custom_message}</p>
					</div>
				{/if}

				<!-- What you'll get -->
				<div class="space-y-2">
					<h3 class="font-semibold">{m['joinEventPage.benefitsTitle']()}</h3>
					<ul class="space-y-1 text-sm text-muted-foreground">
						<li class="flex items-center gap-2">
							<CheckCircle class="h-4 w-4 text-green-600" aria-hidden="true" />
							<span>{m['joinEventPage.benefit_invitation']()}</span>
						</li>
						{#if token.ticket_tiers?.length}
							<li class="flex items-center gap-2">
								<CheckCircle class="h-4 w-4 text-green-600" aria-hidden="true" />
								<span>{m['joinEventPage.benefit_autoTicket']()}</span>
							</li>
						{/if}
						<li class="flex items-center gap-2">
							<CheckCircle class="h-4 w-4 text-green-600" aria-hidden="true" />
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
	{/if}
</div>
