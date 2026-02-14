<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { TierSchemaWithId } from '$lib/types/tickets';
	import type {
		MembershipTierSchema,
		TicketPurchaseItem,
		TierRemainingTicketsSchema
	} from '$lib/api/generated/types.gen';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Card } from '$lib/components/ui/card';
	import DemoCardInfo from '$lib/components/common/DemoCardInfo.svelte';
	import TicketConfirmationDialog from './TicketConfirmationDialog.svelte';
	import MarkdownContent from '$lib/components/common/MarkdownContent.svelte';
	import { Ticket, Check, AlertCircle } from 'lucide-svelte';

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
		onClose: () => void;
		onClaimTicket: (tierId: string, tickets?: TicketPurchaseItem[]) => void;
		onCheckout?: (
			tierId: string,
			isPwyc: boolean,
			amount?: number,
			tickets?: TicketPurchaseItem[]
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
	 * Check tier purchase status based on sold_out and remaining fields
	 */
	function getTierPurchaseStatus(tier: TierSchemaWithId): {
		canPurchase: boolean;
		reason?: string;
		remaining?: number | null;
	} {
		const tierInfo = getTierRemainingInfo(tier.id);

		// If no tier info, check inventory only (without calling isTierAvailable to avoid circular dependency)
		if (!tierInfo) {
			// If total_available is null, it means unlimited - always available
			const available = tier.total_available === null || tier.total_available > 0;
			return {
				canPurchase: available,
				reason: available ? undefined : 'Sold out'
			};
		}

		// Tier is sold out (no inventory)
		if (tierInfo.sold_out) {
			return { canPurchase: false, reason: 'Sold out' };
		}

		// User has hit their personal limit for this tier
		if (tierInfo.remaining === 0) {
			return { canPurchase: false, reason: 'Limit reached' };
		}

		// Can purchase
		return {
			canPurchase: true,
			remaining: tierInfo.remaining
		};
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

	// Check if any tier uses online payment
	let hasOnlinePayment = $derived(tiers.some((tier) => tier.payment_method === 'online'));

	const CURRENCY_SYMBOLS: Record<string, string> = {
		EUR: '€',
		USD: '$',
		GBP: '£',
		JPY: '¥',
		AUD: 'A$',
		CAD: 'C$',
		CHF: 'CHF',
		CNY: '¥',
		INR: '₹',
		KRW: '₩',
		RUB: '₽',
		TRY: '₺',
		BRL: 'R$',
		MXN: 'Mex$',
		ZAR: 'R'
	};

	function formatPrice(amount: string | number, currency: string): string {
		const symbol = CURRENCY_SYMBOLS[currency] || currency;
		return `${symbol}${Number(amount).toFixed(2)}`;
	}

	function getPriceDisplay(tier: TierSchemaWithId): string {
		const currency = tier.currency || 'EUR';
		if (tier.payment_method === 'free') return 'Free';
		if (tier.price_type === 'pwyc') {
			const min = formatPrice(tier.pwyc_min || 1, currency);
			const max = tier.pwyc_max ? formatPrice(tier.pwyc_max, currency) : 'any amount';
			return `${min} - ${max}`;
		}
		return formatPrice(tier.price || 0, currency);
	}

	function getQuantityDisplay(tier: TierSchemaWithId): string {
		const tierInfo = getTierRemainingInfo(tier.id);

		// If we have per-tier info, show user-specific limits
		if (tierInfo) {
			if (tierInfo.sold_out) {
				return 'Sold out';
			}
			if (tierInfo.remaining === 0) {
				return 'You reached your limit';
			}
			if (tierInfo.remaining !== null && tierInfo.remaining !== undefined) {
				return `You can get ${tierInfo.remaining} more`;
			}
		}

		// Fallback to inventory-based display
		// If total_available is null, it means infinite/unlimited
		if (tier.total_available === null) return 'Available';

		// If it's a number, check if sold out
		if (tier.total_available === 0) return 'Sold out';

		return `${tier.total_available} available`;
	}

	function isTierAvailable(tier: TierSchemaWithId): boolean {
		// Check per-tier info first
		const purchaseStatus = getTierPurchaseStatus(tier);
		if (!purchaseStatus.canPurchase) return false;

		// Fallback: check inventory
		// If total_available is null, it means infinite/unlimited - always available
		if (tier.total_available === null) return true;

		// If it's a number, check if any are available
		return tier.total_available > 0;
	}

	// Open confirmation dialog for selected tier
	function handleTierClick(tier: TierSchemaWithId): void {
		selectedTier = tier;
		showConfirmation = true;
	}

	// Close confirmation dialog
	function closeConfirmation(): void {
		showConfirmation = false;
		selectedTier = null;
	}

	// Handle confirmed action from dialog
	async function handleConfirm(payload: {
		amount?: number;
		tickets: TicketPurchaseItem[];
	}): Promise<void> {
		if (!selectedTier || isProcessing) return;

		isProcessing = true;
		const { amount, tickets } = payload;
		const isOnline = selectedTier.payment_method === 'online';
		const isPwyc = selectedTier.price_type === 'pwyc';

		try {
			// PWYC tiers require the PWYC endpoint regardless of payment method
			if (isPwyc && onCheckout) {
				await onCheckout(selectedTier.id, true, amount, tickets);
			}
			// Free tickets or offline/at-the-door (reservation) - non-PWYC
			else if (
				selectedTier.payment_method === 'free' ||
				selectedTier.payment_method === 'offline' ||
				selectedTier.payment_method === 'at_the_door'
			) {
				await onClaimTicket(selectedTier.id, tickets);
			}
			// Online payment (fixed price)
			else if (isOnline && onCheckout) {
				await onCheckout(selectedTier.id, false, undefined, tickets);
			}

			// For online payments (Stripe redirect), keep loading state visible.
			// The page will redirect, so we set a timeout as a safety fallback.
			if (isOnline) {
				setTimeout(() => {
					if (isProcessing) {
						isProcessing = false;
					}
				}, 10000);
			}
			// For non-online payments, the parent's onSuccess handler closes
			// the tier modal (which tears down this component), so no cleanup needed here.
		} catch (error) {
			// On error, reset state so user can try again
			isProcessing = false;
			throw error; // Re-throw so TicketConfirmationDialog can handle it
		}
	}

	function canCheckoutTier(tier: TierSchemaWithId): boolean {
		return tier.payment_method === 'online' && onCheckout !== undefined;
	}

	function canClaimTier(tier: TierSchemaWithId): boolean {
		return (
			tier.payment_method === 'free' ||
			tier.payment_method === 'offline' ||
			tier.payment_method === 'at_the_door'
		);
	}

	// Check if user has required membership tier for restricted tickets
	function checkMembershipTierRestriction(tier: TierSchemaWithId): {
		allowed: boolean;
		reason?: string;
	} {
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
			{#if tiers.length === 0}
				<div class="py-8 text-center text-muted-foreground">
					<p>{m['ticketTierModal.noTickets']()}</p>
				</div>
			{:else}
				{#each tiers as tier (tier.id)}
					{@const membershipRestriction = checkMembershipTierRestriction(tier)}
					{@const purchaseStatus = getTierPurchaseStatus(tier)}
					<Card class="overflow-hidden p-0">
						<div class="p-4">
							<div class="flex items-start justify-between gap-4">
								<div class="flex-1 space-y-2">
									<!-- Tier Name & Description -->
									<div>
										<h3 class="text-lg font-semibold">{tier.name}</h3>
										{#if tier.description}
											<MarkdownContent
												content={tier.description}
												class="text-sm text-muted-foreground"
											/>
										{/if}
									</div>

									<!-- Price & Availability -->
									<div class="flex flex-wrap gap-4 text-sm">
										<div>
											<span class="font-medium text-foreground">{getPriceDisplay(tier)}</span>
											{#if tier.payment_method !== 'free'}
												<span class="ml-2 text-muted-foreground">
													{tier.price_type === 'pwyc' ? 'Pay What You Can' : 'Fixed Price'}
												</span>
											{/if}
										</div>
										<div class="text-muted-foreground">
											{getQuantityDisplay(tier)}
										</div>
									</div>
								</div>

								<!-- Action Button -->
								<div class="flex flex-col items-end gap-1">
									{#if !isAuthenticated && !canAttendWithoutLogin}
										<Button variant="secondary" size="sm" disabled
											>{m['ticketTierModal.signIn']()}</Button
										>
									{:else if !isAuthenticated && canAttendWithoutLogin && purchaseStatus.canPurchase}
										<Button variant="default" size="sm" onclick={() => onGuestTierClick?.(tier)}>
											<Ticket class="mr-2 h-4 w-4" />
											Get Ticket
										</Button>
									{:else if !isAuthenticated && canAttendWithoutLogin && !purchaseStatus.canPurchase}
										<Button variant="secondary" size="sm" disabled>
											{purchaseStatus.reason === 'Limit reached'
												? 'Limit Reached'
												: m['ticketTierModal.soldOut']()}
										</Button>
									{:else if !purchaseStatus.canPurchase}
										<!-- User cannot purchase from this tier (sold out or limit reached) -->
										<Button variant="secondary" size="sm" disabled>
											{#if purchaseStatus.reason === 'Limit reached'}
												<Check class="mr-2 h-4 w-4" />
												Limit Reached
											{:else}
												{m['ticketTierModal.soldOut']()}
											{/if}
										</Button>
									{:else if !membershipRestriction.allowed}
										<Button variant="secondary" size="sm" disabled>
											<AlertCircle class="mr-2 h-4 w-4" />
											Not Eligible
										</Button>
										{#if membershipRestriction.reason}
											<p class="max-w-[200px] text-right text-xs text-muted-foreground">
												{membershipRestriction.reason}
											</p>
										{/if}
									{:else if canCheckoutTier(tier)}
										<Button variant="default" size="sm" onclick={() => handleTierClick(tier)}>
											<Ticket class="mr-2 h-4 w-4" />
											Get Ticket
										</Button>
									{:else if canClaimTier(tier)}
										<Button variant="default" size="sm" onclick={() => handleTierClick(tier)}>
											<Ticket class="mr-2 h-4 w-4" />
											{tier.payment_method === 'free' ? 'Claim' : 'Reserve'}
										</Button>
									{/if}
								</div>
							</div>
						</div>
					</Card>
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
	/>
{/if}
