<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { TierSchemaWithId } from '$lib/types/tickets';
	import type {
		EventTokenSchema,
		MembershipTierSchema,
		TierRemainingTicketsSchema
	} from '$lib/api/generated/types.gen';
	import { hasTierId } from '$lib/types/tickets';
	import { tierPriceDisplay } from './tier-price-display';
	import { Button } from '$lib/components/ui/button';
	import PricingCard from '$lib/components/common/PricingCard.svelte';
	import StatusBadge from '$lib/components/common/StatusBadge.svelte';
	import { Ticket, Clock, Users, AlertCircle, Check } from '@lucide/svelte';
	import MarkdownContent from '$lib/components/common/MarkdownContent.svelte';
	import { formatDate } from '$lib/utils/date';
	import type { JoinBlock } from './cart.svelte';
	import TierQuantityStepper from './TierQuantityStepper.svelte';

	interface Props {
		tier: TierSchemaWithId;
		isAuthenticated: boolean;
		hasTicket?: boolean;
		isEligible?: boolean;
		membershipTier?: MembershipTierSchema | null;
		canAttendWithoutLogin?: boolean;
		/** Per-tier remaining tickets info (from my-status endpoint) */
		tierRemainingInfo?: TierRemainingTicketsSchema;
		/** Invitation-link token details when the page was loaded with `?et=`
		 * (backend #923): a granting token lets an anonymous guest into
		 * invited/invited_and_members tiers that the listing marks
		 * `can_purchase: false` — the backend cannot know the guest yet, so the
		 * claim happens at checkout via `X-Event-Token`. */
		eventTokenDetails?: EventTokenSchema | null;
		/** The event's IANA timezone, so sales windows render event-local (#474). */
		timezone?: string | null;
		/**
		 * The event's `visibility_settings.show_capacity` (#825). Disambiguates a
		 * `null` `total_available`: unlimited when capacity is disclosed, withheld
		 * when it is not. Defaults to `true` so a caller that cannot know behaves
		 * like the pre-#825 world.
		 */
		capacityDisclosed?: boolean;
		/** Quick-buy inline stepper (#853): present only when the tier is
		 * quantity-pickable without extra input. */
		quickBuy?: {
			quantity: number;
			max: number;
			joinBlock: JoinBlock;
			onSetQuantity: (quantity: number) => void;
			/** Disables both stepper buttons — set while a cart checkout is in flight. */
			disabled: boolean;
		};
		/** Seat-picker entry point (#853 PR 3): present only for `user_choice`
		 * tiers when a cart is available — replaces the stepper/CTA with a
		 * "Pick seats…" button, plus a held-count summary once the group exists. */
		pickSeats?: {
			/** Seats already held for this tier's cart group (`cart.quantityFor`). */
			heldCount: number;
			/** `cart.maxQuantity(tier)` — 0 means the layered caps (event per-person
			 * limit, event remaining minus other cart groups) leave no room, so the
			 * picker would open but allow zero picks. */
			max: number;
			joinBlock: JoinBlock;
			/** Set while a cart checkout/hold round-trip is in flight — same
			 * signal as `quickBuy.disabled` (#853 final-review bundled minor). */
			disabled: boolean;
			onPick: () => void;
		};
		onSelectTier: (tier: TierSchemaWithId) => void;
	}

	const {
		tier,
		isAuthenticated,
		hasTicket = false,
		isEligible = true,
		membershipTier = null,
		canAttendWithoutLogin = false,
		tierRemainingInfo,
		eventTokenDetails = null,
		timezone,
		capacityDisclosed = true,
		quickBuy,
		pickSeats,
		onSelectTier
	}: Props = $props();

	// A buyer who can transact — authenticated, or a guest the event allows to
	// attend without an account (#853 Task 5). With the widened cart mount
	// gate a cart always exists in the latter case too, so `canClaim`/
	// `canCheckout`/`canReserve` below gate on this instead of `isAuthenticated`
	// alone — otherwise a guest would fall through every quick-buy/pick-seats
	// branch straight to "Coming soon".
	const canTransact = $derived(isAuthenticated || canAttendWithoutLogin);

	/**
	 * A granting invitation-link token unlocks invited tiers for anonymous
	 * guests (backend #923). Guest-only: a signed-in user's `can_purchase`
	 * already reflects their real invitations. Members-only tiers stay
	 * blocked, and a token that names specific tiers only unlocks those.
	 */
	const tokenGrantsTierAccess = $derived.by(() => {
		if (isAuthenticated || !canAttendWithoutLogin) return false;
		if (!eventTokenDetails?.grants_invitation) return false;
		if (tier.purchasable_by !== 'invited' && tier.purchasable_by !== 'invited_and_members') {
			return false;
		}
		const tokenTiers = eventTokenDetails.ticket_tiers;
		if (tokenTiers && tokenTiers.length > 0) {
			return tokenTiers.some((tokenTier) => tokenTier.id === tier.id);
		}
		return true;
	});

	/**
	 * Check tier purchase status based on per-tier info from my-status endpoint
	 * This takes precedence over the general isEligible flag
	 */
	const tierPurchaseStatus = $derived.by(() => {
		// Tier-level purchasability (from tier listing endpoint, accounts for invitation-linked restrictions)
		if (tier.can_purchase === false && !tokenGrantsTierAccess) {
			return { canPurchase: false, reason: 'Not available' };
		}

		// If no per-user remaining info, fall back to general isEligible
		if (!tierRemainingInfo) {
			return { canPurchase: isEligible, reason: isEligible ? undefined : 'Not eligible' };
		}

		// Tier is sold out (no inventory)
		if (tierRemainingInfo.sold_out) {
			return { canPurchase: false, reason: 'Sold out' };
		}

		// User has hit their personal limit for this tier
		if (tierRemainingInfo.remaining === 0) {
			return { canPurchase: false, reason: 'Limit reached' };
		}

		// Can purchase
		return { canPurchase: true, reason: undefined };
	});

	/**
	 * Effective eligibility. `tierPurchaseStatus` already folds in every input:
	 * `tier.can_purchase === false` always wins (the tier listing sets it for
	 * anonymous visitors on any non-public tier — gating it behind
	 * `tierRemainingInfo`, which only authenticated users have, let logged-out
	 * guests buy into invited-only tiers), then per-user remaining info when
	 * present, then the general `isEligible` fallback.
	 */
	const effectiveEligible = $derived(tierPurchaseStatus.canPurchase);

	// Check if tier has ID (required for checkout)
	const hasId = $derived(hasTierId(tier));

	// Format price display
	const priceDisplay = $derived(() => {
		if (tier.payment_method === 'free') return m['tierCardAdmin.free']();

		if (tier.price_type === 'pwyc') {
			const price = typeof tier.price === 'string' ? parseFloat(tier.price) : tier.price;
			const min = tier.pwyc_min
				? typeof tier.pwyc_min === 'string'
					? parseFloat(tier.pwyc_min)
					: tier.pwyc_min
				: price;
			const max = tier.pwyc_max
				? typeof tier.pwyc_max === 'string'
					? parseFloat(tier.pwyc_max)
					: tier.pwyc_max
				: null;

			const maxDisplay = max ? `${tier.currency} ${max.toFixed(2)}` : m['tierCardAdmin.pwycAny']();
			return m['tierCardAdmin.pwyc']({
				range: `${tier.currency} ${min.toFixed(2)} - ${maxDisplay}`
			});
		}

		// Category-priced tiers (either seated mode) show the honest server-resolved
		// range; flat tiers keep their single price — see tier-price-display.ts.
		return tierPriceDisplay(tier, { isFree: false, isPwyc: false, minAmount: 0, maxAmount: null });
	});

	// Check if sales are active
	const salesStatus = $derived.by(() => {
		const now = new Date();

		if (tier.sales_start_at) {
			const salesStart = new Date(tier.sales_start_at);
			if (now < salesStart) {
				return {
					active: false,
					message: m['tierCard.salesStartOn']({
						date: formatDate(tier.sales_start_at, timezone ?? undefined)
					})
				};
			}
		}

		if (tier.sales_end_at) {
			const salesEnd = new Date(tier.sales_end_at);
			if (now > salesEnd) {
				return { active: false, message: m['tierCard.salesEnded']() };
			}
		}

		return { active: true, message: null };
	});

	/**
	 * Check availability.
	 *
	 * `total_available === null` is ambiguous from the tier alone since backend
	 * #825: it means "unlimited" when the event discloses capacity, and "withheld"
	 * when it does not. `capacityDisclosed` is the event-level fact that resolves
	 * it — with capacity disclosed a null genuinely means an uncapped tier and we
	 * say so; with capacity hidden the card states nothing about inventory, since
	 * calling withheld inventory "unlimited" would be a lie. Either way the
	 * sold-out signal still arrives via `tierRemainingInfo.sold_out`, which is not
	 * gated.
	 *
	 * `message === null` is what suppresses the inventory row in the template.
	 */
	const availabilityStatus = $derived.by(() => {
		if (tier.total_available === null) {
			return {
				available: true,
				message: capacityDisclosed ? m['tierCard.unlimited']() : null
			};
		}

		if (tier.total_available === 0) {
			return { available: false, message: m['tierCard.soldOut']() };
		}

		return {
			available: true,
			message: m['tierCard.remaining']({ count: tier.total_available })
		};
	});

	// Can claim free ticket. `hasTicket` is NOT a guard here (#853 regression
	// fix): a buyer who already holds a ticket for this event can still be
	// eligible for another of this tier — that's the buy-more case, and
	// per-tier/per-user limits already gate it via `effectiveEligible`
	// (`tierRemainingInfo`). `hasTicket` alone only drives the fallback badge
	// below, for contexts with no quick-buy/seat-pick mechanism (see `actions`).
	const canClaim = $derived(
		hasId &&
			canTransact &&
			effectiveEligible &&
			salesStatus.active &&
			availabilityStatus.available &&
			tier.payment_method === 'free'
	);

	// Can checkout for online payment
	const canCheckout = $derived(
		hasId &&
			canTransact &&
			effectiveEligible &&
			salesStatus.active &&
			availabilityStatus.available &&
			tier.payment_method === 'online'
	);

	// Can reserve offline/at-the-door ticket
	const canReserve = $derived(
		hasId &&
			canTransact &&
			effectiveEligible &&
			salesStatus.active &&
			availabilityStatus.available &&
			(tier.payment_method === 'offline' || tier.payment_method === 'at_the_door')
	);

	// Check if user has required membership tier for restricted tickets
	function checkMembershipTierRestriction(): { allowed: boolean; reason?: string } {
		const restrictedTiers = tier.restricted_to_membership_tiers;

		// If no restrictions, everyone can access
		if (!restrictedTiers || restrictedTiers.length === 0) {
			return { allowed: true };
		}

		// If tier is restricted but user is not authenticated
		if (!isAuthenticated) {
			return { allowed: false, reason: m['tierCardAdmin.signInToCheck']() };
		}

		// If user doesn't have a membership tier
		if (!membershipTier || !membershipTier.id) {
			const tierNames = restrictedTiers.map((t: MembershipTierSchema) => t.name).join(', ');
			return {
				allowed: false,
				reason: m['tierCardAdmin.requiresMembership']({ tiers: tierNames })
			};
		}

		// Check if user's membership tier is in the allowed list
		const isAllowed = restrictedTiers.some((t: MembershipTierSchema) => t.id === membershipTier.id);

		if (!isAllowed) {
			const tierNames = restrictedTiers.map((t: MembershipTierSchema) => t.name).join(', ');
			return {
				allowed: false,
				reason: m['tierCardAdmin.requiresMembership']({ tiers: tierNames })
			};
		}

		return { allowed: true };
	}

	const membershipRestriction = $derived(checkMembershipTierRestriction());
</script>

{#snippet badges()}
	<!-- Inventory as a solid chip rather than a coloured line of text: sold out is
	     the fact a buyer scans for, and StatusBadge's pairs are audited in both
	     modes. Meaning is never carried by the fill alone — the label says it. -->
	{#if availabilityStatus.message !== null && effectiveEligible}
		<StatusBadge
			tone={availabilityStatus.available ? 'neutral' : 'danger'}
			icon={Users}
			label={availabilityStatus.message}
		/>
	{/if}
{/snippet}

{#snippet meta()}
	{#if !salesStatus.active}
		<p class="flex items-center gap-1.5 text-sm text-muted-foreground">
			<Clock class="h-4 w-4 shrink-0" aria-hidden="true" />
			{salesStatus.message}
		</p>
	{/if}
{/snippet}

{#snippet actions()}
	{#if !hasId}
		<p class="rounded-md bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive">
			{m['tierCardAdmin.configError']()}
		</p>
	{:else if !salesStatus.active}
		<Button disabled class="w-full sm:w-auto">{m['tierCardAdmin.notAvailable']()}</Button>
	{:else if !availabilityStatus.available}
		<Button disabled class="w-full sm:w-auto">{m['tierCardAdmin.soldOut']()}</Button>
	{:else if !membershipRestriction.allowed}
		<!-- User doesn't have required membership tier -->
		<Button disabled class="w-full sm:w-auto">
			<AlertCircle class="mr-2 h-4 w-4" />
			{m['tierCardAdmin.notEligible']()}
		</Button>
		{#if membershipRestriction.reason}
			<p class="max-w-[250px] text-xs text-muted-foreground sm:text-right">
				{membershipRestriction.reason}
			</p>
		{/if}
	{:else if !isAuthenticated && !canAttendWithoutLogin}
		<Button href="/login" variant="outline" class="w-full sm:w-auto"
			>{m['tierCardAdmin.signInToGetTicket']()}</Button
		>
	{:else if !effectiveEligible}
		<!-- User is authenticated but not eligible for this tier - show reason -->
		<Button disabled class="w-full sm:w-auto">
			{#if tierPurchaseStatus.reason === 'Sold out'}
				{m['tierCardAdmin.soldOut']()}
			{:else if tierPurchaseStatus.reason === 'Limit reached'}
				{m['tierCardAdmin.limitReached']()}
			{:else}
				{m['tierCardAdmin.notEligible']()}
			{/if}
		</Button>
		{#if tierPurchaseStatus.reason && tierPurchaseStatus.reason !== 'Not eligible'}
			<p class="max-w-[250px] text-xs text-muted-foreground sm:text-right">
				{tierPurchaseStatus.reason === 'Limit reached'
					? m['tierCardAdmin.limitReachedDetail']()
					: tierPurchaseStatus.reason === 'Sold out'
						? m['tierCardAdmin.soldOutDetail']()
						: m['tierCardAdmin.notAvailable']()}
			</p>
		{/if}
	{:else if pickSeats && (canClaim || canCheckout || canReserve)}
		<!-- Seat picker entry point (#853 PR 3): the button stays visible (and
		     re-openable to edit an existing pick) even when a currency/payment
		     mix would block it — it's just DISABLED, with the same hint copy
		     the quick-buy stepper shows for the same reason (binding ruling). -->
		{#if pickSeats.heldCount > 0}
			<StatusBadge
				tone="brand"
				size="sm"
				label={m['cart.seatsPicked']({ count: pickSeats.heldCount })}
			/>
		{/if}
		<Button
			onclick={pickSeats.onPick}
			disabled={!!pickSeats.joinBlock ||
				pickSeats.disabled ||
				(pickSeats.max === 0 && pickSeats.heldCount === 0)}
			class="w-full sm:w-auto"
		>
			{m['cart.pickSeats']()}
		</Button>
		{#if pickSeats.joinBlock}
			<p class="max-w-[250px] text-xs text-muted-foreground sm:text-right">
				{pickSeats.joinBlock === 'currency'
					? m['cart.cannotMixCurrency']()
					: m['cart.cannotMixPayment']()}
			</p>
		{:else if pickSeats.max === 0 && pickSeats.heldCount === 0}
			<p class="max-w-[250px] text-xs text-muted-foreground sm:text-right">
				{m['cart.eventLimitReached']()}
			</p>
		{/if}
	{:else if quickBuy && (canClaim || canCheckout || canReserve)}
		{#if quickBuy.joinBlock}
			<p class="max-w-[250px] text-xs text-muted-foreground sm:text-right">
				{quickBuy.joinBlock === 'currency'
					? m['cart.cannotMixCurrency']()
					: m['cart.cannotMixPayment']()}
			</p>
		{:else if quickBuy.max === 0 && quickBuy.quantity === 0}
			<!-- The layered caps (event per-person limit, event remaining minus
			     other cart groups) leave no room for this tier — say so instead of
			     rendering a dead stepper with no explanation. A tier's OWN
			     exhaustion (sold out / per-tier limit) never reaches this branch:
			     those fail `effectiveEligible`/`availabilityStatus` above. -->
			<p class="max-w-[250px] text-xs text-muted-foreground sm:text-right">
				{m['cart.eventLimitReached']()}
			</p>
		{:else}
			<TierQuantityStepper
				tierName={tier.name}
				quantity={quickBuy.quantity}
				max={quickBuy.max}
				onSetQuantity={quickBuy.onSetQuantity}
				disabled={quickBuy.disabled}
			/>
		{/if}
	{:else if hasTicket}
		<!-- Fallback for contexts with no quick-buy/seat-pick mechanism (guest
		     ticket holders, no cart) — buy-more there still routes through the
		     single-select dialog, which doesn't support re-purchase, so this is
		     purely informational (#853 regression fix; see `canClaim` comment). -->
		<StatusBadge tone="success" size="lg" icon={Check} label={m['tierCardAdmin.youHaveTicket']()} />
	{:else if canClaim}
		<Button onclick={() => onSelectTier(tier)} class="w-full sm:w-auto">
			{m['tierCardAdmin.claimFreeTicket']()}
		</Button>
	{:else if canCheckout}
		<Button onclick={() => onSelectTier(tier)} class="w-full sm:w-auto"
			>{m['tierCardAdmin.buyTicket']()}</Button
		>
	{:else if canReserve}
		<Button onclick={() => onSelectTier(tier)} variant="outline" class="w-full sm:w-auto">
			{m['tierCardAdmin.reserveTicket']()}
		</Button>
	{:else}
		<p class="rounded-md bg-muted px-4 py-2 text-sm font-medium text-muted-foreground">
			{m['tierCardAdmin.comingSoon']()}
		</p>
	{/if}
{/snippet}

<PricingCard
	name={tier.name}
	icon={Ticket}
	price={priceDisplay()}
	muted={tier.can_purchase === false && !tokenGrantsTierAccess}
	{badges}
	{meta}
	{actions}
>
	{#if tier.description}
		<MarkdownContent content={tier.description} class="text-sm text-muted-foreground" />
	{/if}
</PricingCard>
