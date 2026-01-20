<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { TierSchemaWithId } from '$lib/types/tickets';
	import type { MembershipTierSchema, TicketPurchaseItem } from '$lib/api/generated/types.gen';
	import { hasTierId } from '$lib/types/tickets';
	import { Button } from '$lib/components/ui/button';
	import { Card } from '$lib/components/ui/card';
	import { Ticket, Clock, Users, AlertCircle } from 'lucide-svelte';
	import TicketConfirmationDialog from './TicketConfirmationDialog.svelte';
	import MarkdownContent from '$lib/components/common/MarkdownContent.svelte';

	interface Props {
		tier: TierSchemaWithId;
		/** Event ID for seat availability API */
		eventId: string;
		isAuthenticated: boolean;
		hasTicket?: boolean;
		isEligible?: boolean;
		membershipTier?: MembershipTierSchema | null;
		canAttendWithoutLogin?: boolean;
		onClaimTicket: (tierId: string, tickets?: TicketPurchaseItem[]) => void | Promise<void>;
		onCheckout?: (
			tierId: string,
			isPwyc: boolean,
			amount?: number,
			tickets?: TicketPurchaseItem[]
		) => void | Promise<void>;
		onGuestTierClick?: (tier: TierSchemaWithId) => void;
	}

	let {
		tier,
		eventId,
		isAuthenticated,
		hasTicket = false,
		isEligible = true,
		membershipTier = null,
		canAttendWithoutLogin = false,
		onClaimTicket,
		onCheckout,
		onGuestTierClick
	}: Props = $props();

	// Check if tier has ID (required for checkout)
	let hasId = $derived(hasTierId(tier));

	let isClaiming = $state(false);
	let showConfirmation = $state(false);

	// Format price display
	let priceDisplay = $derived(() => {
		if (tier.payment_method === 'free') return 'Free';

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

			const maxDisplay = max ? `${tier.currency} ${max.toFixed(2)}` : 'any';
			return `Pay What You Can (${tier.currency} ${min.toFixed(2)} - ${maxDisplay})`;
		}

		const price = typeof tier.price === 'string' ? parseFloat(tier.price) : tier.price;
		return `${tier.currency} ${price.toFixed(2)}`;
	});

	// Check if sales are active
	let salesStatus = $derived.by(() => {
		const now = new Date();

		if (tier.sales_start_at) {
			const salesStart = new Date(tier.sales_start_at);
			if (now < salesStart) {
				return { active: false, message: `Sales start ${salesStart.toLocaleDateString()}` };
			}
		}

		if (tier.sales_end_at) {
			const salesEnd = new Date(tier.sales_end_at);
			if (now > salesEnd) {
				return { active: false, message: 'Sales ended' };
			}
		}

		return { active: true, message: null };
	});

	// Check availability
	let availabilityStatus = $derived.by(() => {
		if (tier.total_available === null) {
			return { available: true, message: 'Unlimited' };
		}

		if (tier.total_available === 0) {
			return { available: false, message: 'Sold out' };
		}

		return { available: true, message: `${tier.total_available} remaining` };
	});

	// Can claim free ticket
	let canClaim = $derived(
		hasId &&
			isAuthenticated &&
			!hasTicket &&
			isEligible &&
			salesStatus.active &&
			availabilityStatus.available &&
			tier.payment_method === 'free'
	);

	// Can checkout for online payment
	let canCheckout = $derived(
		hasId &&
			isAuthenticated &&
			!hasTicket &&
			isEligible &&
			salesStatus.active &&
			availabilityStatus.available &&
			tier.payment_method === 'online' &&
			onCheckout !== undefined
	);

	// Can reserve offline/at-the-door ticket
	let canReserve = $derived(
		hasId &&
			isAuthenticated &&
			!hasTicket &&
			isEligible &&
			salesStatus.active &&
			availabilityStatus.available &&
			(tier.payment_method === 'offline' || tier.payment_method === 'at_the_door')
	);

	// Open confirmation dialog instead of immediate action
	function handleButtonClick() {
		if (!hasId || hasTicket || !salesStatus.active || !availabilityStatus.available) return;
		showConfirmation = true;
	}

	// Confirmation dialog callback - now triggers the actual backend action
	async function handleConfirm(payload: { amount?: number; tickets: TicketPurchaseItem[] }) {
		if (!hasId || isClaiming) return;

		isClaiming = true;
		try {
			const { amount, tickets } = payload;

			// Free tickets or offline/at-the-door (reservation)
			if (
				tier.payment_method === 'free' ||
				tier.payment_method === 'offline' ||
				tier.payment_method === 'at_the_door'
			) {
				await onClaimTicket(tier.id, tickets);
			}
			// Online payment (with or without PWYC)
			else if (tier.payment_method === 'online' && onCheckout) {
				await onCheckout(tier.id, tier.price_type === 'pwyc', amount, tickets);
			}

			// Close dialog on success
			showConfirmation = false;
		} finally {
			isClaiming = false;
		}
	}

	function closeConfirmation() {
		showConfirmation = false;
	}

	// Check if user has required membership tier for restricted tickets
	function checkMembershipTierRestriction(): { allowed: boolean; reason?: string } {
		// Cast to access restricted_to_membership_tiers (from TicketTierDetailSchema)
		const restrictedTiers = (tier as any).restricted_to_membership_tiers;

		// If no restrictions, everyone can access
		if (!restrictedTiers || restrictedTiers.length === 0) {
			return { allowed: true };
		}

		// If tier is restricted but user is not authenticated
		if (!isAuthenticated) {
			return { allowed: false, reason: 'Sign in to check eligibility' };
		}

		// If user doesn't have a membership tier
		if (!membershipTier || !membershipTier.id) {
			const tierNames = restrictedTiers.map((t: MembershipTierSchema) => t.name).join(', ');
			return { allowed: false, reason: `Requires membership: ${tierNames}` };
		}

		// Check if user's membership tier is in the allowed list
		const isAllowed = restrictedTiers.some((t: MembershipTierSchema) => t.id === membershipTier.id);

		if (!isAllowed) {
			const tierNames = restrictedTiers.map((t: MembershipTierSchema) => t.name).join(', ');
			return { allowed: false, reason: `Requires membership: ${tierNames}` };
		}

		return { allowed: true };
	}

	let membershipRestriction = $derived(checkMembershipTierRestriction());
</script>

<Card class="p-4">
	<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
		<!-- Tier Info -->
		<div class="flex-1">
			<div class="flex items-center gap-2">
				<Ticket class="h-5 w-5 text-primary" aria-hidden="true" />
				<h3 class="text-lg font-semibold">{tier.name}</h3>
			</div>

			<div class="mt-2 text-2xl font-bold text-primary">{priceDisplay()}</div>

			{#if tier.description}
				<MarkdownContent content={tier.description} class="mt-2 text-sm text-muted-foreground" />
			{/if}

			<!-- Status Indicators -->
			<dl class="mt-3 flex flex-wrap gap-4 text-sm">
				{#if !salesStatus.active}
					<div class="flex items-center gap-1.5 text-muted-foreground">
						<Clock class="h-4 w-4" aria-hidden="true" />
						<dd>{salesStatus.message}</dd>
					</div>
				{/if}

				{#if tier.total_available !== null}
					<div
						class="flex items-center gap-1.5"
						class:text-destructive={!availabilityStatus.available}
					>
						<Users class="h-4 w-4" aria-hidden="true" />
						<dd>{availabilityStatus.message}</dd>
					</div>
				{/if}
			</dl>
		</div>

		<!-- Action Button -->
		<div class="flex shrink-0 flex-col items-end gap-2">
			{#if !hasId}
				<div class="rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">
					Configuration Error
				</div>
			{:else if hasTicket}
				<div
					class="rounded-md bg-green-100 px-4 py-2 text-sm font-medium text-green-800 dark:bg-green-950 dark:text-green-100"
				>
					✓ You have a ticket
				</div>
			{:else if !salesStatus.active}
				<Button disabled class="w-full sm:w-auto">{m['tierCardAdmin.notAvailable']()}</Button>
			{:else if !availabilityStatus.available}
				<Button disabled class="w-full sm:w-auto">{m['tierCardAdmin.soldOut']()}</Button>
			{:else if !membershipRestriction.allowed}
				<!-- User doesn't have required membership tier -->
				<Button disabled class="w-full sm:w-auto">
					<AlertCircle class="mr-2 h-4 w-4" />
					Not Eligible
				</Button>
				{#if membershipRestriction.reason}
					<p class="max-w-[250px] text-right text-xs text-muted-foreground">
						{membershipRestriction.reason}
					</p>
				{/if}
			{:else if !isAuthenticated && !canAttendWithoutLogin}
				<Button href="/login" variant="outline" class="w-full sm:w-auto"
					>{m['tierCardAdmin.signInToGetTicket']()}</Button
				>
			{:else if !isAuthenticated && canAttendWithoutLogin}
				<Button onclick={() => onGuestTierClick?.(tier)} class="w-full sm:w-auto">
					Get Ticket
				</Button>
			{:else if !isEligible}
				<!-- User is authenticated but not eligible - show disabled button -->
				<Button disabled class="w-full sm:w-auto">{m['tierCardAdmin.notEligible']()}</Button>
			{:else if canClaim}
				<Button onclick={handleButtonClick} disabled={isClaiming} class="w-full sm:w-auto">
					{isClaiming ? 'Claiming...' : 'Claim Free Ticket'}
				</Button>
			{:else if canCheckout}
				<Button onclick={handleButtonClick} disabled={isClaiming} class="w-full sm:w-auto">
					{isClaiming ? 'Processing...' : 'Get Ticket'}
				</Button>
			{:else if canReserve}
				<Button
					onclick={handleButtonClick}
					disabled={isClaiming}
					variant="outline"
					class="w-full sm:w-auto"
				>
					{isClaiming ? 'Reserving...' : 'Reserve Ticket'}
				</Button>
			{:else}
				<div class="rounded-md bg-muted px-4 py-2 text-sm text-muted-foreground">
					{m['tierCardAdmin.comingSoon']()}
				</div>
			{/if}
		</div>
	</div>
</Card>

<!-- Confirmation Dialog -->
<TicketConfirmationDialog
	bind:open={showConfirmation}
	{tier}
	{eventId}
	onClose={closeConfirmation}
	onConfirm={handleConfirm}
	isProcessing={isClaiming}
/>
