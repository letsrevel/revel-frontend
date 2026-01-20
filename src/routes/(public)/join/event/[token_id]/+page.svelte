<script lang="ts">
	// @ts-nocheck - TODO: Fix types after API schema refactor
	import * as m from '$lib/paraglide/messages.js';
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import { Calendar, MapPin, CheckCircle, Clock, Loader2, Ticket } from 'lucide-svelte';
	import { createMutation } from '@tanstack/svelte-query';
	import { eventpublicdiscoveryClaimInvitation } from '$lib/api/generated/sdk.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { toast } from 'svelte-sonner';
	import { getExpirationDisplay, formatTokenUsage } from '$lib/utils/tokens';
	import { formatEventDate } from '$lib/utils/date';

	let { data }: { data: PageData } = $props();

	const token = $derived(data.token);
	const event = $derived(token.event);
	const isAuthenticated = $derived(authStore.isAuthenticated);
	const accessToken = $derived(authStore.accessToken);

	// Claim mutation
	const claimMutation = createMutation(() => ({
		mutationFn: async () => {
			const response = await eventpublicdiscoveryClaimInvitation({
				path: { token: token.id },
				headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
			});

			if (response.error) {
				throw new Error(m['joinEventPage.error_claimFailed']());
			}

			return response.data;
		},
		onSuccess: (evt) => {
			toast.success(`You've been invited to ${evt.name}!`);
			// Redirect to event page - adjust path based on your routing
			goto(`/events/${evt.organization.slug}/${evt.slug}`);
		},
		onError: () => {
			toast.error('Failed to claim invitation. The token may be expired or invalid.');
		}
	}));

	function handleClaim() {
		if (!isAuthenticated) {
			goto(`/login?redirect=/join/event/${token.id}`);
			return;
		}

		claimMutation.mutate();
	}

	const expirationDisplay = $derived(getExpirationDisplay(token.expires_at));
	const usageDisplay = $derived(formatTokenUsage(token.uses, token.max_uses));
	const formattedDate = $derived(formatEventDate(event.start));
</script>

<svelte:head>
	<title>{m['joinEventPage.pageTitle']({ eventName: event.name })} - Revel</title>
	<meta
		name="description"
		content={m['joinEventPage.pageDescription']({ eventName: event.name })}
	/>
</svelte:head>

<div class="container mx-auto flex min-h-[80vh] items-center justify-center px-4 py-12">
	<Card class="w-full max-w-md">
		<CardHeader class="text-center">
			{#if event.cover_art || event.logo}
				<img
					src={event.cover_art || event.logo || ''}
					alt={event.name}
					class="mx-auto mb-4 h-32 w-full rounded-lg object-cover"
				/>
			{/if}
			<CardTitle class="text-2xl">{m['joinEventPage.invitedTitle']()}</CardTitle>
			<CardDescription class="text-lg">
				<strong>{event.name}</strong>
			</CardDescription>
		</CardHeader>

		<CardContent class="space-y-6">
			<!-- Event Info -->
			<div class="space-y-3 rounded-lg bg-muted p-4">
				<div class="flex items-start gap-2 text-sm">
					<Calendar class="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
					<div>
						<div class="font-medium">{m['joinEventPage.whenLabel']()}</div>
						<div class="text-muted-foreground">{formattedDate}</div>
					</div>
				</div>

				{#if event.city}
					<div class="flex items-start gap-2 text-sm">
						<MapPin class="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
						<div>
							<div class="font-medium">{m['joinEventPage.whereLabel']()}</div>
							<div class="text-muted-foreground">
								{event.city.name}{#if event.city.country}, {event.city.country}{/if}
							</div>
						</div>
					</div>
				{/if}

				{#if token.ticket_tier}
					<div class="flex items-start gap-2 text-sm">
						<Ticket class="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
						<div>
							<div class="font-medium">{m['joinEventPage.ticketTierLabel']()}</div>
							<div class="text-muted-foreground">{token.ticket_tier}</div>
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
					{#if token.ticket_tier}
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
</div>
