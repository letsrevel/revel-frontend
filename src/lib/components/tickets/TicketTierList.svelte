<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { TierSchemaWithId } from '$lib/types/tickets';
	import type { UserEventStatus } from '$lib/utils/eligibility';
	import type { EventTokenSchema, MembershipTierSchema, TicketPurchaseItem } from '$lib/api/generated/types.gen';
	import { isEligibility } from '$lib/utils/eligibility';
	import TierCard from './TierCard.svelte';
	import DemoCardInfo from '$lib/components/common/DemoCardInfo.svelte';
	import EligibilityStatusDisplay from '$lib/components/events/EligibilityStatusDisplay.svelte';
	import { Ticket } from 'lucide-svelte';

	interface Props {
		tiers: TierSchemaWithId[];
		isAuthenticated: boolean;
		hasTicket?: boolean;
		userStatus?: UserEventStatus | null;
		membershipTier?: MembershipTierSchema | null;
		eventId?: string;
		eventSlug?: string;
		organizationSlug?: string;
		eventName?: string;
		eventTokenDetails?: EventTokenSchema | null;
		canAttendWithoutLogin?: boolean;
		onClaimTicket: (tierId: string, tickets?: TicketPurchaseItem[]) => void | Promise<void>;
		onCheckout?: (tierId: string, isPwyc: boolean, amount?: number, tickets?: TicketPurchaseItem[]) => void | Promise<void>;
		onGuestTierClick?: (tier: TierSchemaWithId) => void;
	}

	let {
		tiers,
		isAuthenticated,
		hasTicket = false,
		userStatus,
		membershipTier = null,
		eventId,
		eventSlug,
		organizationSlug,
		eventName,
		eventTokenDetails,
		canAttendWithoutLogin = false,
		onClaimTicket,
		onCheckout,
		onGuestTierClick
	}: Props = $props();

	// Filter out hidden tiers and sort by price
	let visibleTiers = $derived(
		tiers
			.filter((tier) => tier.payment_method !== 'hidden')
			.sort((a, b) => {
				const priceA = typeof a.price === 'string' ? parseFloat(a.price) : a.price;
				const priceB = typeof b.price === 'string' ? parseFloat(b.price) : b.price;
				return priceA - priceB;
			})
	);

	let hasTiers = $derived(visibleTiers.length > 0);

	// Check if any tier uses online payment
	let hasOnlinePayment = $derived(visibleTiers.some((tier) => tier.payment_method === 'online'));

	// Check if user is not eligible
	let shouldShowEligibility = $derived.by(() => {
		if (!userStatus) return false;
		if (!isEligibility(userStatus)) return false;
		return !userStatus.allowed;
	});

	// Check if user is eligible to purchase tickets
	let isEligible = $derived.by(() => {
		if (!userStatus) return true; // If no status, assume eligible (default behavior)
		if (!isEligibility(userStatus)) return true; // If not eligibility check, assume eligible
		return userStatus.allowed;
	});
</script>

{#if hasTiers}
	<section class="rounded-lg border border-border bg-card p-6" aria-labelledby="ticket-tiers">
		<div class="mb-4 flex items-center gap-2">
			<Ticket class="h-5 w-5 text-primary" aria-hidden="true" />
			<h2 id="ticket-tiers" class="text-xl font-bold">{m['ticketTierList.ticketOptions']()}</h2>
		</div>

		<!-- Eligibility Status Display (if user is not eligible) -->
		{#if shouldShowEligibility && userStatus && isEligibility(userStatus) && eventId && eventSlug && organizationSlug}
			<div class="mb-4">
				<EligibilityStatusDisplay
					eligibility={userStatus}
					{eventId}
					{eventSlug}
					{organizationSlug}
					{eventName}
					{eventTokenDetails}
				/>
			</div>
		{/if}

		<div class="space-y-4">
			{#each visibleTiers as tier (tier.id || tier.event_id + tier.name)}
				<TierCard
					{tier}
					{isAuthenticated}
					{hasTicket}
					{isEligible}
					{membershipTier}
					{canAttendWithoutLogin}
					{onClaimTicket}
					{onCheckout}
					{onGuestTierClick}
				/>
			{/each}
		</div>

		{#if !isAuthenticated && !canAttendWithoutLogin}
			<p class="mt-4 text-sm text-muted-foreground">
				<a href="/login" class="font-medium text-primary hover:underline"
					>{m['ticketTierList.signIn']()}</a
				>
				to claim your ticket
			</p>
		{/if}

		<!-- Demo Mode: Show test card info if any tier uses online payment -->
		{#if hasOnlinePayment}
			<DemoCardInfo />
		{/if}
	</section>
{/if}
