<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { TierSchemaWithId } from '$lib/types/tickets';
	import type {
		MembershipTierSchema,
		TicketPurchaseItem,
		TierRemainingTicketsSchema
	} from '$lib/api/generated/types.gen';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import DemoCardInfo from '$lib/components/common/DemoCardInfo.svelte';
	import TicketConfirmationDialog from './TicketConfirmationDialog.svelte';
	import TierCard from './TierCard.svelte';
	import { Ticket } from 'lucide-svelte';

	interface Props {
		open: boolean;
		tiers: TierSchemaWithId[];
		/** Event ID for fetching seat availability */
		eventId: string;
		isAuthenticated: boolean;
		hasTicket: boolean;
		membershipTier?: MembershipTierSchema | null;
		canAttendWithoutLogin?: boolean;
		/** Per-tier remaining tickets info (from my-status endpoint) */
		tierRemainingTickets?: TierRemainingTicketsSchema[];
		/** Event-level max tickets per user (fallback when tier-specific limit is null) */
		eventMaxTicketsPerUser?: number | null;
		/** User's display name for auto-fill */
		userName?: string;
		/** Pre-selected tier from inline TierCard click */
		preSelectedTier?: TierSchemaWithId | null;
		/** Pre-filled discount code (e.g. from URL param) */
		initialDiscountCode?: string;
		onClose: () => void;
		onClaimTicket: (tierId: string, tickets?: TicketPurchaseItem[], discountCode?: string) => void;
		onCheckout?: (
			tierId: string,
			isPwyc: boolean,
			amount?: number,
			tickets?: TicketPurchaseItem[],
			discountCode?: string
		) => void;
		onGuestTierClick?: (tier: TierSchemaWithId) => void;
	}

	let {
		open = $bindable(),
		tiers,
		eventId,
		isAuthenticated,
		hasTicket,
		membershipTier = null,
		canAttendWithoutLogin = false,
		tierRemainingTickets,
		eventMaxTicketsPerUser = null,
		userName = '',
		preSelectedTier = null,
		initialDiscountCode = '',
		onClose,
		onClaimTicket,
		onCheckout,
		onGuestTierClick
	}: Props = $props();

	/**
	 * Get remaining tickets info for a specific tier
	 */
	function getTierRemainingInfo(tierId: string): TierRemainingTicketsSchema | undefined {
		return tierRemainingTickets?.find((t) => t.tier_id === tierId);
	}

	/**
	 * Check tier purchase status (used by pre-selection validation)
	 */
	function getTierPurchaseStatus(tier: TierSchemaWithId): {
		canPurchase: boolean;
		reason?: string;
	} {
		const tierInfo = getTierRemainingInfo(tier.id);

		if (!tierInfo) {
			const available = tier.total_available === null || tier.total_available > 0;
			return {
				canPurchase: available,
				reason: available ? undefined : 'Sold out'
			};
		}

		if (tierInfo.sold_out) {
			return { canPurchase: false, reason: 'Sold out' };
		}

		if (tierInfo.remaining === 0) {
			return { canPurchase: false, reason: 'Limit reached' };
		}

		return { canPurchase: true };
	}

	/**
	 * Get max quantity user can purchase for a specific tier
	 */
	function getMaxQuantityForTier(tierId: string): number | null {
		const tierInfo = getTierRemainingInfo(tierId);
		if (tierInfo?.remaining !== undefined) {
			return tierInfo.remaining;
		}
		return eventMaxTicketsPerUser;
	}

	// Confirmation dialog state
	let showConfirmation = $state(false);
	let selectedTier = $state<TierSchemaWithId | null>(null);
	let isProcessing = $state(false);
	let wasPreSelected = $state(false);

	// Pre-selection: when modal opens with a preSelectedTier, jump straight to confirmation
	$effect(() => {
		if (open && preSelectedTier) {
			const status = getTierPurchaseStatus(preSelectedTier);
			if (status.canPurchase) {
				selectedTier = preSelectedTier;
				showConfirmation = true;
				wasPreSelected = true;
			}
			// If tier is no longer available, fall back to normal tier browsing
		}
	});

	// Reset pre-selection state when modal closes
	$effect(() => {
		if (!open) {
			wasPreSelected = false;
		}
	});

	// Filter hidden tiers (same as TicketTierList)
	const visibleTiers = $derived(tiers.filter((tier) => tier.payment_method !== 'hidden'));

	// Check if any tier uses online payment
	const hasOnlinePayment = $derived(visibleTiers.some((tier) => tier.payment_method === 'online'));

	// Open confirmation dialog for selected tier
	function handleTierClick(tier: TierSchemaWithId): void {
		selectedTier = tier;
		showConfirmation = true;
	}

	// Close confirmation dialog
	function closeConfirmation(): void {
		showConfirmation = false;
		selectedTier = null;
		// If user came from inline TierCard, close the entire modal
		// (they already see the tier list on the page — showing the modal's tier list is redundant)
		if (wasPreSelected) {
			wasPreSelected = false;
			onClose();
		}
	}

	// Handle confirmed action from dialog
	async function handleConfirm(payload: {
		amount?: number;
		tickets: TicketPurchaseItem[];
		discountCode?: string;
	}): Promise<void> {
		if (!selectedTier || isProcessing) return;

		isProcessing = true;
		const { amount, tickets, discountCode } = payload;
		const isOnline = selectedTier.payment_method === 'online';
		const isPwyc = selectedTier.price_type === 'pwyc';

		try {
			// PWYC tiers require the PWYC endpoint regardless of payment method
			if (isPwyc && onCheckout) {
				await onCheckout(selectedTier.id, true, amount, tickets, discountCode);
			}
			// Free tickets or offline/at-the-door (reservation) - non-PWYC
			else if (
				selectedTier.payment_method === 'free' ||
				selectedTier.payment_method === 'offline' ||
				selectedTier.payment_method === 'at_the_door'
			) {
				await onClaimTicket(selectedTier.id, tickets, discountCode);
			}
			// Online payment (fixed price)
			else if (isOnline && onCheckout) {
				await onCheckout(selectedTier.id, false, undefined, tickets, discountCode);
			}

			// For online payments (Stripe redirect), keep loading state visible.
			// The page will redirect, so we set a timeout as a safety fallback.
			if (isOnline) {
				setTimeout(() => {
					if (isProcessing) {
						isProcessing = false;
					}
				}, 10000);
			} else {
				// For non-online payments (free, offline, at_the_door):
				// reset processing state and close the confirmation dialog.
				// The parent's onSuccess handler already closed the tier modal
				// and showed a toast, but the confirmation dialog is a separate
				// Dialog instance that must be closed explicitly.
				isProcessing = false;
				closeConfirmation();
			}
		} catch (error) {
			// On error, reset state so user can try again
			isProcessing = false;
			throw error; // Re-throw so TicketConfirmationDialog can handle it
		}
	}
</script>

<Dialog bind:open>
	<DialogContent class="max-h-[90vh] max-w-2xl overflow-y-auto">
		<DialogHeader>
			<DialogTitle class="flex items-center gap-2 text-2xl">
				<Ticket class="h-6 w-6" aria-hidden="true" />
				Select Your Ticket
			</DialogTitle>
		</DialogHeader>

		<div class="mt-4 space-y-4">
			{#if visibleTiers.length === 0}
				<div class="py-8 text-center text-muted-foreground">
					<p>{m['ticketTierModal.noTickets']()}</p>
				</div>
			{:else}
				{#each visibleTiers as tier (tier.id || tier.event_id + tier.name)}
					<TierCard
						{tier}
						{isAuthenticated}
						{membershipTier}
						{canAttendWithoutLogin}
						tierRemainingInfo={getTierRemainingInfo(tier.id)}
						onSelectTier={handleTierClick}
						{onGuestTierClick}
					/>
				{/each}
			{/if}
		</div>

		<!-- Demo Mode: Show test card info if any tier uses online payment -->
		{#if hasOnlinePayment}
			<DemoCardInfo />
		{/if}

		<div class="mt-6 border-t pt-4 text-center text-xs text-muted-foreground">
			<p>{m['ticketTierModal.agreeToTerms']()}</p>
		</div>
	</DialogContent>
</Dialog>

<!-- Confirmation Dialog for Selected Tier -->
{#if selectedTier}
	<TicketConfirmationDialog
		bind:open={showConfirmation}
		tier={selectedTier}
		{eventId}
		onClose={closeConfirmation}
		onConfirm={handleConfirm}
		{isProcessing}
		maxQuantity={getMaxQuantityForTier(selectedTier.id)}
		{eventMaxTicketsPerUser}
		{userName}
		{initialDiscountCode}
	/>
{/if}
