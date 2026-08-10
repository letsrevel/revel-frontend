<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import {
		Tooltip,
		TooltipContent,
		TooltipProvider,
		TooltipTrigger
	} from '$lib/components/ui/tooltip';
	import { Info } from '@lucide/svelte';
	import { estimateNetPayout, type PlatformFeeInfo } from '$lib/utils/fees';
	import { formatMoney } from '$lib/utils/format';
	import { SUPPORTED_CURRENCIES, normalizeDecimalInput } from './tier-form-helpers';

	interface Props {
		priceType: 'fixed' | 'pwyc';
		currency: string;
		price: string;
		pwycMin: string;
		pwycMax: string;
		currencySymbol: string;
		isPending: boolean;
		/** Org platform-fee terms; null hides the net-payout preview. */
		platformFees?: PlatformFeeInfo | null;
		/** True only for online (Stripe) tiers — the preview is meaningless otherwise. */
		showNetPayout?: boolean;
	}

	let {
		priceType = $bindable(),
		currency = $bindable(),
		price = $bindable(),
		pwycMin = $bindable(),
		pwycMax = $bindable(),
		currencySymbol,
		isPending,
		platformFees = null,
		showNetPayout = false
	}: Props = $props();

	// "You get: ~X" preview for online tiers — PWYC previews at the minimum
	// price (that is what the price field stores for PWYC anyway).
	const netPayout = $derived.by(() => {
		if (!showNetPayout || !platformFees) return null;
		const effectivePrice = parseFloat(
			normalizeDecimalInput(priceType === 'fixed' ? price : pwycMin)
		);
		return estimateNetPayout({
			price: effectivePrice,
			platformFeePercent: platformFees.percent,
			platformFeeFixed: platformFees.fixed,
			platformFeeVatRate: platformFees.vatRate
		});
	});
</script>

<div>
	<Label for="price-type">{m['tierForm.priceType']()}</Label>
	<select
		id="price-type"
		bind:value={priceType}
		disabled={isPending}
		class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
	>
		<option value="fixed">{m['tierForm.fixedPrice']()}</option>
		<option value="pwyc">{m['tierForm.payWhatYouCan']()}</option>
	</select>
</div>

<!-- Currency Selection -->
<div>
	<Label for="currency">{m['tierForm.currency']()}</Label>
	<select
		id="currency"
		bind:value={currency}
		disabled={isPending}
		class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
	>
		{#each SUPPORTED_CURRENCIES as curr (curr.code)}
			<option value={curr.code}>{curr.code} - {curr.name}</option>
		{/each}
	</select>
	<p class="mt-1 text-xs text-muted-foreground">
		{m['tierForm.currencyHelp']()}
	</p>
</div>

{#if priceType === 'fixed'}
	<div>
		<Label for="price">{m['tierForm.price']()}</Label>
		<div class="relative">
			<span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
				>{currencySymbol}</span
			>
			<Input
				id="price"
				type="text"
				inputmode="decimal"
				value={price}
				oninput={(e) => {
					price = normalizeDecimalInput((e.currentTarget as HTMLInputElement).value);
				}}
				required
				disabled={isPending}
				class="pl-10"
			/>
		</div>
	</div>
{:else}
	<div class="grid grid-cols-2 gap-4">
		<div>
			<Label for="pwyc-min">{m['tierForm.minPrice']()}</Label>
			<div class="relative">
				<span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
					>{currencySymbol}</span
				>
				<Input
					id="pwyc-min"
					type="text"
					inputmode="decimal"
					value={pwycMin}
					oninput={(e) => {
						pwycMin = normalizeDecimalInput((e.currentTarget as HTMLInputElement).value);
					}}
					required
					disabled={isPending}
					class="pl-10"
				/>
			</div>
		</div>
		<div>
			<Label for="pwyc-max">{m['tierForm.maxPrice']()}</Label>
			<div class="relative">
				<span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
					>{currencySymbol}</span
				>
				<Input
					id="pwyc-max"
					type="text"
					inputmode="decimal"
					value={pwycMax}
					oninput={(e) => {
						pwycMax = normalizeDecimalInput((e.currentTarget as HTMLInputElement).value);
					}}
					disabled={isPending}
					class="pl-10"
					placeholder={m['tierForm.noLimitPlaceholder']()}
				/>
			</div>
		</div>
	</div>
{/if}

<!-- Net payout preview: online tiers only, and only when the org's fee terms
     are known. The tooltip explains why it is approximate. -->
{#if netPayout}
	<div class="flex items-center gap-2 rounded-lg border bg-muted/30 px-4 py-3">
		<p class="text-sm">
			<span class="font-medium">{m['tierForm.netPayoutLabel']()}</span>
			<span class="font-bold">
				{m['tierForm.netPayoutAmount']({ amount: formatMoney(netPayout.net, currency) })}
			</span>
			<span class="text-muted-foreground">
				{priceType === 'pwyc'
					? m['tierForm.netPayoutPerTicketAtMin']()
					: m['tierForm.netPayoutPerTicket']()}
			</span>
		</p>
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger
					type="button"
					aria-label={m['tierForm.netPayoutInfoAria']()}
					class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
				>
					<Info class="h-4 w-4" aria-hidden="true" />
				</TooltipTrigger>
				<TooltipContent>
					<p class="max-w-xs text-sm">{m['tierForm.netPayoutTooltip']()}</p>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	</div>
{/if}
