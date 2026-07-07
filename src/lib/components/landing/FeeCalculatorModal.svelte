<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { X } from '@lucide/svelte';

	interface Props {
		open: boolean;
	}
	let { open = $bindable() }: Props = $props();

	let ticketPrice = $state(20);

	// Fee calculations
	// Stripe fees: 1.5% + €0.25 for EU cards (higher for UK cards, see Stripe pricing)
	const STRIPE_PERCENTAGE = 0.015; // 1.5%
	const STRIPE_FIXED = 0.25; // €0.25

	// Revel platform fee: 1.5% + €0.25
	const REVEL_PERCENTAGE = 0.015; // 1.5%
	const REVEL_FIXED = 0.25; // €0.25

	const stripeFee = $derived(ticketPrice * STRIPE_PERCENTAGE + STRIPE_FIXED);
	const revelFee = $derived(ticketPrice * REVEL_PERCENTAGE + REVEL_FIXED);
	const totalFees = $derived(stripeFee + revelFee);
	const organizerReceives = $derived(ticketPrice - totalFees);

	function formatCurrency(amount: number): string {
		return new Intl.NumberFormat('en-EU', {
			style: 'currency',
			currency: 'EUR',
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		}).format(amount);
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
		onclick={(e) => e.target === e.currentTarget && (open = false)}
		onkeydown={(e) => e.key === 'Escape' && (open = false)}
		role="dialog"
		aria-modal="true"
		aria-labelledby="fee-calculator-title"
		tabindex="-1"
	>
		<div class="w-full max-w-md rounded-lg border bg-background shadow-xl">
			<!-- Header -->
			<div class="flex items-center justify-between border-b px-6 py-4">
				<h2 id="fee-calculator-title" class="text-xl font-bold">
					{m['learnMore.feeCalculator.title']()}
				</h2>
				<button
					type="button"
					onclick={() => (open = false)}
					class="rounded-full p-1 hover:bg-accent"
					aria-label={m['learnMore.feeCalculator.close']()}
				>
					<X class="h-5 w-5" />
				</button>
			</div>

			<!-- Content -->
			<div class="space-y-6 px-6 py-4">
				<!-- Ticket Price Input -->
				<div>
					<label for="ticket-price" class="mb-2 block text-sm font-medium"
						>{m['learnMore.feeCalculator.ticketPrice']()}</label
					>
					<div class="relative">
						<span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
						<input
							id="ticket-price"
							type="number"
							min="0"
							step="0.01"
							bind:value={ticketPrice}
							class="w-full rounded-md border border-input bg-background py-2 pl-8 pr-4 text-lg focus:outline-none focus:ring-2 focus:ring-primary"
						/>
					</div>
				</div>

				<!-- Fee Breakdown -->
				<div class="space-y-4">
					<!-- Stripe Fees -->
					<div class="rounded-lg border bg-muted/30 p-4">
						<div class="flex items-center justify-between">
							<span class="font-medium">{m['learnMore.feeCalculator.creditCardFees']()}</span>
							<span class="text-lg font-bold text-orange-600 dark:text-orange-400">
								{formatCurrency(stripeFee)}
							</span>
						</div>
						<p class="mt-1 text-xs text-muted-foreground">
							{m['learnMore.feeCalculator.creditCardFeesDescription']()}
							<a
								href="https://stripe.com/en-at/pricing"
								target="_blank"
								rel="noopener noreferrer"
								class="text-primary hover:underline"
							>
								{m['learnMore.feeCalculator.viewStripePricing']()}
							</a>
						</p>
					</div>

					<!-- Revel Platform Fee -->
					<div class="rounded-lg border bg-muted/30 p-4">
						<div class="flex items-center justify-between">
							<span class="font-medium">{m['learnMore.feeCalculator.platformFee']()}</span>
							<span class="text-lg font-bold text-primary">
								{formatCurrency(revelFee)}
							</span>
						</div>
						<p class="mt-1 text-xs text-muted-foreground">
							{m['learnMore.feeCalculator.platformFeeDescription']()}
						</p>
					</div>

					<!-- Divider -->
					<div class="border-t"></div>

					<!-- Organization Receives -->
					<div class="rounded-lg border-2 border-green-500 bg-green-50 p-4 dark:bg-green-950/30">
						<div class="flex items-center justify-between">
							<span class="font-semibold"
								>{m['learnMore.feeCalculator.organizationReceives']()}</span
							>
							<span class="text-2xl font-bold text-green-600 dark:text-green-400">
								{formatCurrency(organizerReceives)}
							</span>
						</div>
						<p class="mt-1 text-xs text-muted-foreground">
							{m['learnMore.feeCalculator.perTicketSoldAt']({ price: formatCurrency(ticketPrice) })}
						</p>
					</div>
				</div>

				<!-- Summary -->
				<p class="text-center text-xs text-muted-foreground">
					{m['learnMore.feeCalculator.totalFees']({
						fees: formatCurrency(totalFees),
						percentage: ((totalFees / ticketPrice) * 100).toFixed(1)
					})}
				</p>
				<p class="text-center text-xs text-muted-foreground/70">
					{m['learnMore.feesExcludeVat']()}
				</p>
			</div>

			<!-- Footer -->
			<div class="border-t px-6 py-4">
				<p class="text-center text-sm text-muted-foreground">
					{m['learnMore.feeCalculator.questionsAboutFees']()}
					<a
						href="mailto:contact@letsrevel.io?subject=Revel%20Fee%20Question"
						class="text-primary hover:underline"
					>
						{m['learnMore.feeCalculator.contactUs']()}
					</a>
				</p>
			</div>
		</div>
	</div>
{/if}
