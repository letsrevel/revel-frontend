<script lang="ts">
	import {
		Dialog,
		DialogContent,
		DialogHeader,
		DialogTitle,
		DialogDescription,
		DialogFooter
	} from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { Ticket, DollarSign, AlertCircle, CreditCard, Wallet, Info } from 'lucide-svelte';
	import type { TierSchemaWithId } from '$lib/types/tickets';

	interface Props {
		open: boolean;
		tier: TierSchemaWithId;
		onClose: () => void;
		onConfirm: (amount?: number) => void | Promise<void>;
		isProcessing?: boolean;
	}

	let { open = $bindable(), tier, onClose, onConfirm, isProcessing = false }: Props = $props();

	// PWYC state (only for pay-what-you-can tiers)
	let pwycAmount = $state('');
	let pwycError = $state('');

	// Computed values
	let isPwyc = $derived(tier.price_type === 'pwyc');
	let isFree = $derived(tier.payment_method === 'free');
	let isOnlinePayment = $derived(tier.payment_method === 'online');
	let isOfflinePayment = $derived(
		tier.payment_method === 'offline' || tier.payment_method === 'at_the_door'
	);

	// PWYC min/max
	let minAmount = $derived(() => {
		if (!isPwyc) return 0;
		if (tier.pwyc_min) {
			return typeof tier.pwyc_min === 'string' ? parseFloat(tier.pwyc_min) : tier.pwyc_min;
		}
		return 1;
	});

	let maxAmount = $derived(() => {
		if (!isPwyc || !tier.pwyc_max) return null;
		return typeof tier.pwyc_max === 'string' ? parseFloat(tier.pwyc_max) : tier.pwyc_max;
	});

	// Format price display
	let priceDisplay = $derived(() => {
		if (isFree) return 'Free';

		if (isPwyc) {
			const min = minAmount();
			const max = maxAmount();
			const maxDisplay = max ? `${tier.currency} ${max.toFixed(2)}` : 'any amount';
			return `${tier.currency} ${min.toFixed(2)} - ${maxDisplay}`;
		}

		const price = typeof tier.price === 'string' ? parseFloat(tier.price) : tier.price;
		return `${tier.currency} ${price.toFixed(2)}`;
	});

	// Dialog title
	let dialogTitle = $derived(() => {
		if (isFree) return 'Claim Free Ticket';
		if (isOfflinePayment) return 'Reserve Ticket';
		if (isPwyc) return 'Get Your Ticket';
		return 'Confirm Purchase';
	});

	// Dialog icon component
	let dialogIcon = $derived.by(() => {
		if (isFree) return Ticket;
		if (isOfflinePayment) return Wallet;
		if (isOnlinePayment) return CreditCard;
		return DollarSign;
	});

	// Reset state when dialog opens/closes
	$effect(() => {
		if (!open) {
			pwycAmount = '';
			pwycError = '';
		}
	});

	// PWYC validation
	function validatePwycAmount(): boolean {
		if (!isPwyc) return true;

		pwycError = '';

		if (!pwycAmount.trim()) {
			pwycError = 'Please enter an amount';
			return false;
		}

		const value = parseFloat(pwycAmount);

		if (isNaN(value)) {
			pwycError = 'Please enter a valid number';
			return false;
		}

		const min = minAmount();
		if (value < min) {
			pwycError = `Minimum amount is ${tier.currency} ${min.toFixed(2)}`;
			return false;
		}

		const max = maxAmount();
		if (max !== null && value > max) {
			pwycError = `Maximum amount is ${tier.currency} ${max.toFixed(2)}`;
			return false;
		}

		return true;
	}

	async function handleConfirm() {
		// For PWYC, validate amount
		if (isPwyc) {
			if (!validatePwycAmount()) return;
			const amount = parseFloat(pwycAmount);
			await onConfirm(amount);
		} else {
			await onConfirm();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !isProcessing) {
			e.preventDefault();
			handleConfirm();
		}
	}

	// Quick amount suggestions for PWYC
	function getSuggestions(min: number, max: number | null): number[] {
		if (max !== null) {
			return [min, Math.round((min + max) / 2), max];
		}
		return [min, min * 2, min * 3];
	}
</script>

<Dialog bind:open>
	<DialogContent class="sm:max-w-lg">
		<DialogHeader>
			<DialogTitle class="flex items-center gap-2 text-xl">
				{@const Icon = dialogIcon}
				<Icon class="h-5 w-5 text-primary" aria-hidden="true" />
				{dialogTitle()}
			</DialogTitle>
			<DialogDescription>
				{#if isFree}
					Confirm that you'd like to claim this free ticket for the event.
				{:else if isOfflinePayment}
					Reserve your spot and complete payment {tier.payment_method === 'at_the_door'
						? 'at the door'
						: 'offline'}.
				{:else if isPwyc}
					Choose how much you'd like to pay for your ticket.
				{:else}
					Confirm your purchase. You'll be redirected to complete payment.
				{/if}
			</DialogDescription>
		</DialogHeader>

		<div class="space-y-4 py-2">
			<!-- Tier Information Card -->
			<div class="rounded-lg border border-border bg-muted/50 p-4">
				<div class="flex items-start justify-between gap-4">
					<div class="flex-1 space-y-1">
						<h3 class="font-semibold">{tier.name}</h3>
						{#if tier.description}
							<p class="text-sm text-muted-foreground">{tier.description}</p>
						{/if}
						{#if !isPwyc}
							<p class="text-lg font-bold text-primary">{priceDisplay()}</p>
						{/if}
					</div>
					<Ticket class="h-8 w-8 shrink-0 text-muted-foreground" aria-hidden="true" />
				</div>
			</div>

			<!-- PWYC Amount Selection -->
			{#if isPwyc}
				<div class="space-y-3">
					<div class="space-y-2">
						<Label for="pwyc-amount">Payment Amount</Label>
						<div class="text-xs text-muted-foreground">
							Range: {tier.currency}
							{minAmount().toFixed(2)} - {maxAmount() !== null
								? `${tier.currency} ${maxAmount()?.toFixed(2)}`
								: 'any amount'}
						</div>
						<div class="relative">
							<span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
								{tier.currency}
							</span>
							<Input
								id="pwyc-amount"
								type="number"
								min={minAmount()}
								max={maxAmount() ?? undefined}
								step="0.01"
								bind:value={pwycAmount}
								onkeydown={handleKeydown}
								class="pl-12 text-lg font-semibold"
								placeholder={minAmount().toFixed(2)}
								disabled={isProcessing}
								aria-invalid={pwycError ? 'true' : 'false'}
								aria-describedby={pwycError ? 'amount-error' : undefined}
							/>
						</div>
						{#if pwycError}
							<p id="amount-error" class="text-sm text-destructive" role="alert">
								{pwycError}
							</p>
						{/if}
					</div>

					<!-- Quick Amount Suggestions -->
					<div class="space-y-2">
						<p class="text-sm font-medium">Quick select:</p>
						<div class="grid grid-cols-3 gap-2">
							{#each getSuggestions(minAmount(), maxAmount()) as suggested}
								<Button
									variant="outline"
									size="sm"
									onclick={() => {
										pwycAmount = suggested.toFixed(2);
										pwycError = '';
									}}
									disabled={isProcessing}
								>
									{tier.currency}
									{suggested.toFixed(2)}
								</Button>
							{/each}
						</div>
					</div>
				</div>
			{/if}

			<!-- Payment Instructions for Non-Online Payment Methods -->
			{#if !isOnlinePayment && tier.manual_payment_instructions}
				<Alert>
					<Info class="h-4 w-4" />
					<AlertDescription>
						<p class="font-medium">Payment Instructions:</p>
						<p class="mt-1 text-sm">{tier.manual_payment_instructions}</p>
					</AlertDescription>
				</Alert>
			{/if}

			<!-- Online Payment Notice -->
			{#if isOnlinePayment && !isPwyc}
				<Alert>
					<CreditCard class="h-4 w-4" />
					<AlertDescription>
						<p class="text-sm">
							You'll be redirected to our secure payment provider to complete your purchase.
						</p>
					</AlertDescription>
				</Alert>
			{/if}

			<!-- Availability Warning -->
			{#if tier.total_available !== null && tier.total_available <= 5 && tier.total_available > 0}
				<Alert variant="destructive">
					<AlertCircle class="h-4 w-4" />
					<AlertDescription>
						<p class="text-sm font-medium">
							Only {tier.total_available} ticket{tier.total_available === 1 ? '' : 's'} remaining!
						</p>
					</AlertDescription>
				</Alert>
			{/if}
		</div>

		<DialogFooter class="gap-2 sm:gap-0">
			<Button
				variant="outline"
				onclick={onClose}
				disabled={isProcessing}
				class="flex-1 sm:flex-initial"
			>
				Cancel
			</Button>
			<Button
				onclick={handleConfirm}
				disabled={isProcessing || (isPwyc && !pwycAmount.trim())}
				class="flex-1 sm:flex-initial"
			>
				{#if isProcessing}
					Processing...
				{:else if isFree}
					Claim Ticket
				{:else if isOfflinePayment}
					Reserve Ticket
				{:else if isPwyc}
					Continue to Payment
				{:else}
					Proceed to Payment
				{/if}
			</Button>
		</DialogFooter>

		<div class="border-t pt-3 text-center text-xs text-muted-foreground">
			<p>By proceeding, you agree to the event's terms and conditions.</p>
		</div>
	</DialogContent>
</Dialog>
