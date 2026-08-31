<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import type { TierSchemaWithId } from '$lib/types/tickets';
	import type { UserEventStatus } from '$lib/utils/eligibility';
	import type {
		EventTokenSchema,
		MembershipTierSchema,
		TierRemainingTicketsSchema
	} from '$lib/api/generated/types.gen';
	import { isEligibility } from '$lib/utils/eligibility';
	import type { EventCart } from './cart.svelte';
	import { quickBuyEligible } from './cart.svelte';
	import TierCard from './TierCard.svelte';
	import DemoCardInfo from '$lib/components/common/DemoCardInfo.svelte';
	import EligibilityStatusDisplay from '$lib/components/events/EligibilityStatusDisplay.svelte';
	import { Button } from '$lib/components/ui/button';
	import SectionHeader from '$lib/components/common/SectionHeader.svelte';
	import Sticker from '$lib/components/brand/Sticker.svelte';
	import { Map as MapIcon, Ticket } from '@lucide/svelte';

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
		/** Per-tier remaining tickets info (from my-status endpoint) */
		tierRemainingTickets?: TierRemainingTicketsSchema[];
		/** The event's IANA timezone, so tier sales windows & deadlines render event-local (#474). */
		timezone?: string | null;
		/** The event's `visibility_settings.show_capacity` (#825) — see TierCard. */
		capacityDisclosed?: boolean;
		/** Quick-buy cart (#853). When present, quantity-pickable tiers get an
		 * inline stepper instead of the buy dialog. */
		cart?: EventCart;
		/** Disables every quick-buy stepper (both buttons) — set while a cart
		 * checkout is in flight so quantities can't change mid-submit. */
		quickBuyDisabled?: boolean;
		/** Event-level shared remaining budget (BE #901); null = no cap / unknown. */
		eventRemaining?: number | null;
		onSelectTier: (tier: TierSchemaWithId) => void;
		/** Map-first entry point (#679): opens the whole-venue seating overview. */
		onViewSeatingMap?: () => void;
		/** Seat-picker entry point (#853 PR 3): opens `SeatPickerDialog` for a
		 * `user_choice` tier. Only wired when `cart` is also present. */
		onPickSeats?: (tier: TierSchemaWithId) => void;
	}

	const {
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
		tierRemainingTickets,
		timezone,
		capacityDisclosed = true,
		cart,
		quickBuyDisabled = false,
		eventRemaining = null,
		onSelectTier,
		onViewSeatingMap,
		onPickSeats
	}: Props = $props();

	/**
	 * Get remaining tickets info for a specific tier
	 */
	function getTierRemainingInfo(tierId: string): TierRemainingTicketsSchema | undefined {
		return tierRemainingTickets?.find((t) => t.tier_id === tierId);
	}

	// Filter out hidden tiers (preserve backend ordering)
	const visibleTiers = $derived(tiers.filter((tier) => tier.payment_method !== 'hidden'));

	const hasTiers = $derived(visibleTiers.length > 0);

	// Check if any tier uses online payment
	const hasOnlinePayment = $derived(visibleTiers.some((tier) => tier.payment_method === 'online'));

	// Check if user is not eligible
	const shouldShowEligibility = $derived.by(() => {
		if (!userStatus) return false;
		if (!isEligibility(userStatus)) return false;
		return !userStatus.allowed;
	});

	/**
	 * Every visible tier is out of inventory — the one "moment" on this section
	 * worth a Sticker (celebration volume allows at most one per viewport-height,
	 * and this is the only one on the event page).
	 *
	 * Only `total_available === 0` counts: `null` is ambiguous since #825 (it can
	 * mean "unlimited" OR "withheld"), so a page that hides capacity never claims
	 * to be sold out. The sticker is a REPEAT of what each tier card already says
	 * in words and in its own audited badge, so nothing is conveyed by it alone.
	 */
	const allSoldOut = $derived(
		visibleTiers.length > 0 && visibleTiers.every((tier) => tier.total_available === 0)
	);

	// Check if user is eligible to purchase tickets
	const isEligible = $derived.by(() => {
		if (!userStatus) return true; // If no status, assume eligible (default behavior)
		if (!isEligibility(userStatus)) return true; // If not eligibility check, assume eligible
		return userStatus.allowed;
	});
</script>

{#if hasTiers}
	<section class="rounded-lg border border-border bg-card p-6" aria-labelledby="ticket-tiers">
		<div class="mb-4 flex items-center gap-2">
			<Ticket class="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
			<SectionHeader
				volume="celebration"
				id="ticket-tiers"
				title={m['ticketTierList.ticketOptions']()}
			/>
			{#if allSoldOut}
				<Sticker tint="crimson" rotate={-3} class="text-sm">{m['tierCard.soldOut']()}</Sticker>
			{/if}
		</div>

		{#if eventRemaining !== null}
			<p class="mb-4 text-sm text-muted-foreground">
				{m['cart.eventTicketsLeft']({ count: eventRemaining })}
			</p>
		{/if}

		<!-- Map-first entry point (#679): start from the seating map instead of
		     the tier list. Only rendered when the event has a mapped venue. -->
		{#if onViewSeatingMap}
			<Button variant="outline" class="mb-4 w-full sm:w-auto" onclick={onViewSeatingMap}>
				<MapIcon class="mr-2 h-4 w-4" aria-hidden="true" />
				{m['venueOverview.viewMap']()}
			</Button>
		{/if}

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
					{timezone}
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
					tierRemainingInfo={getTierRemainingInfo(tier.id)}
					{timezone}
					{capacityDisclosed}
					quickBuy={cart && quickBuyEligible(tier)
						? {
								quantity: cart.quantityFor(tier.id),
								max: cart.maxQuantity(tier),
								joinBlock: cart.joinBlock(tier),
								onSetQuantity: (quantity: number) => cart.setQuantity(tier, quantity),
								disabled: quickBuyDisabled
							}
						: undefined}
					pickSeats={cart &&
					onPickSeats &&
					tier.seat_assignment_mode === 'user_choice' &&
					tier.payment_method !== 'hidden'
						? {
								heldCount: cart.quantityFor(tier.id),
								max: cart.maxQuantity(tier),
								joinBlock: cart.joinBlock(tier),
								disabled: quickBuyDisabled,
								onPick: () => onPickSeats(tier)
							}
						: undefined}
					{onSelectTier}
				/>
			{/each}
		</div>

		{#if !isAuthenticated && !canAttendWithoutLogin}
			<p class="mt-4 text-sm text-muted-foreground">
				<a href={resolve('/(public)/login', {})} class="font-bold text-primary hover:underline"
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
