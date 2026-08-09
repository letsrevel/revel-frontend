<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import {
		DEFAULT_PLATFORM_FEE_PERCENT,
		DEFAULT_PLATFORM_FEE_FIXED,
		PLATFORM_VAT_RATE_PERCENT,
		estimateNetPayout
	} from '$lib/utils/fees';
	import { formatMoney } from '$lib/utils/format';

	interface Props {
		open: boolean;
	}
	let { open = $bindable() }: Props = $props();

	let ticketPrice = $state(20);
	// Whether Revel charges VAT on top of its platform fee (Austrian orgs and
	// EU orgs without a validated VAT ID — cross-border EU B2B with a
	// validated VAT ID is reverse-charged instead). Off by default.
	let vatOnPlatformFee = $state(false);

	// Guard against empty/invalid/non-positive input, which would otherwise
	// yield NaN/Infinity percentages and negative receivable amounts.
	const safeTicketPrice = $derived(
		typeof ticketPrice === 'number' && Number.isFinite(ticketPrice) && ticketPrice > 0
			? ticketPrice
			: 0
	);

	// Stripe fee estimate assumes EEA cards (higher for UK cards, see Stripe
	// pricing); platform fee is Revel's standard 1.5% + €0.25.
	const breakdown = $derived(
		estimateNetPayout({
			price: safeTicketPrice,
			platformFeePercent: DEFAULT_PLATFORM_FEE_PERCENT,
			platformFeeFixed: DEFAULT_PLATFORM_FEE_FIXED,
			platformFeeVatRate: vatOnPlatformFee ? PLATFORM_VAT_RATE_PERCENT : 0
		})
	);
	const stripeFee = $derived(breakdown?.stripeFee ?? 0);
	const revelFee = $derived(breakdown?.platformFee ?? 0);
	const revelFeeVat = $derived(breakdown?.platformFeeVat ?? 0);
	const totalFees = $derived(stripeFee + revelFee + revelFeeVat);
	const organizerReceives = $derived(breakdown?.net ?? 0);
	const feePercentage = $derived(
		safeTicketPrice > 0 ? ((totalFees / safeTicketPrice) * 100).toFixed(1) : '0.0'
	);

	function formatCurrency(amount: number): string {
		return formatMoney(amount, 'EUR');
	}
</script>

<Dialog bind:open>
	<DialogContent class="max-h-[90vh] max-w-md overflow-y-auto">
		<DialogHeader>
			<DialogTitle>{m['learnMore.feeCalculator.title']()}</DialogTitle>
		</DialogHeader>

		<!-- Content -->
		<div class="space-y-6">
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
					{#if vatOnPlatformFee}
						<div class="mt-2 flex items-center justify-between border-t pt-2">
							<span class="text-sm">
								{m['learnMore.feeCalculator.vatOnPlatformFee']({
									rate: PLATFORM_VAT_RATE_PERCENT
								})}
							</span>
							<span class="font-bold text-primary">
								{formatCurrency(revelFeeVat)}
							</span>
						</div>
					{/if}
					<p class="mt-1 text-xs text-muted-foreground">
						{m['learnMore.feeCalculator.platformFeeDescription']()}
					</p>
				</div>

				<!-- VAT on platform fee toggle -->
				<div>
					<label class="flex cursor-pointer items-start gap-2">
						<input
							type="checkbox"
							bind:checked={vatOnPlatformFee}
							aria-describedby="vat-checkbox-help"
							class="mt-0.5 h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-primary"
						/>
						<span class="text-sm font-medium">
							{m['learnMore.feeCalculator.vatCheckboxLabel']({
								rate: PLATFORM_VAT_RATE_PERCENT
							})}
						</span>
					</label>
					<p id="vat-checkbox-help" class="mt-1 text-xs text-muted-foreground">
						{m['learnMore.feeCalculator.vatCheckboxHelp']()}
					</p>
				</div>

				<!-- Divider -->
				<div class="border-t"></div>

				<!-- Organization Receives -->
				<div class="rounded-lg border-2 border-green-500 bg-green-50 p-4 dark:bg-green-950/30">
					<div class="flex items-center justify-between">
						<span class="font-semibold">{m['learnMore.feeCalculator.organizationReceives']()}</span>
						<span class="text-2xl font-bold text-green-600 dark:text-green-400">
							{formatCurrency(organizerReceives)}
						</span>
					</div>
					<p class="mt-1 text-xs text-muted-foreground">
						{m['learnMore.feeCalculator.perTicketSoldAt']({
							price: formatCurrency(safeTicketPrice)
						})}
					</p>
				</div>
			</div>

			<!-- Summary -->
			<p class="text-center text-xs text-muted-foreground">
				{m['learnMore.feeCalculator.totalFees']({
					fees: formatCurrency(totalFees),
					percentage: feePercentage
				})}
			</p>
			{#if !vatOnPlatformFee}
				<p class="text-center text-xs text-muted-foreground/70">
					{m['learnMore.feesExcludeVat']()}
				</p>
			{/if}
		</div>

		<!-- Footer -->
		<div class="border-t pt-4">
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
	</DialogContent>
</Dialog>
