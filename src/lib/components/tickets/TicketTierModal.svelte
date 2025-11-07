<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { TierSchemaWithId } from '$lib/types/tickets';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Card } from '$lib/components/ui/card';
	import DemoCardInfo from '$lib/components/common/DemoCardInfo.svelte';
	import TicketConfirmationDialog from './TicketConfirmationDialog.svelte';
	import { Ticket, Check } from 'lucide-svelte';

	interface Props {
		open: boolean;
		tiers: TierSchemaWithId[];
		isAuthenticated: boolean;
		hasTicket: boolean;
		onClose: () => void;
		onClaimTicket: (tierId: string) => void;
		onCheckout?: (tierId: string, isPwyc: boolean, amount?: number) => void;
	}

	let {
		open = $bindable(),
		tiers,
		isAuthenticated,
		hasTicket,
		onClose,
		onClaimTicket,
		onCheckout
	}: Props = $props();

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
		// If total_available is null, it means infinite/unlimited
		if (tier.total_available === null) return 'Unlimited';

		// If it's a number, check if sold out
		if (tier.total_available === 0) return 'Sold out';

		return `${tier.total_available} available`;
	}

	function isTierAvailable(tier: TierSchemaWithId): boolean {
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
	async function handleConfirm(amount?: number): Promise<void> {
		if (!selectedTier || isProcessing) return;

		isProcessing = true;
		try {
			// Free tickets or offline/at-the-door (reservation)
			if (
				selectedTier.payment_method === 'free' ||
				selectedTier.payment_method === 'offline' ||
				selectedTier.payment_method === 'at_the_door'
			) {
				await onClaimTicket(selectedTier.id);
			}
			// Online payment (with or without PWYC)
			else if (selectedTier.payment_method === 'online' && onCheckout) {
				await onCheckout(selectedTier.id, selectedTier.price_type === 'pwyc', amount);
			}

			// Close both dialogs on success
			showConfirmation = false;
			selectedTier = null;
			onClose();
		} finally {
			isProcessing = false;
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
					<Card class="overflow-hidden p-0">
						<div class="p-4">
							<div class="flex items-start justify-between gap-4">
								<div class="flex-1 space-y-2">
									<!-- Tier Name & Description -->
									<div>
										<h3 class="text-lg font-semibold">{tier.name}</h3>
										{#if tier.description}
											<p class="text-sm text-muted-foreground">{tier.description}</p>
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

									<!-- Payment Method & Instructions -->
									{#if (tier as any).manual_payment_instructions}
										<div class="mt-2 rounded-md border border-border bg-muted/50 p-2 text-xs">
											<p class="font-medium text-muted-foreground">
												{m['ticketTierModal.paymentInstructions']()}
											</p>
											<p class="mt-1">{(tier as any).manual_payment_instructions}</p>
										</div>
									{/if}
								</div>

								<!-- Action Button -->
								<div>
									{#if !isAuthenticated}
										<Button variant="secondary" size="sm" disabled
											>{m['ticketTierModal.signIn']()}</Button
										>
									{:else if hasTicket}
										<Button variant="secondary" size="sm" disabled>
											<Check class="mr-2 h-4 w-4" />
											Claimed
										</Button>
									{:else if !isTierAvailable(tier)}
										<Button variant="secondary" size="sm" disabled
											>{m['ticketTierModal.soldOut']()}</Button
										>
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
		onClose={closeConfirmation}
		onConfirm={handleConfirm}
		{isProcessing}
	/>
{/if}
