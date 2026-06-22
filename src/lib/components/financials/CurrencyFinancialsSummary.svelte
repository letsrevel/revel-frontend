<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { formatMoney } from '$lib/utils/format';
	import RateBucketTable from './RateBucketTable.svelte';
	import type { CurrencyFinancialsSchema } from '$lib/api/generated';

	interface Props {
		/** Financial figures for a single currency. */
		data: CurrencyFinancialsSchema;
		/** Render the per-VAT-rate breakdown as a collapsible disclosure. */
		showRateBuckets?: boolean;
	}

	const { data, showRateBuckets = true }: Props = $props();

	// The number of currently-held (non-refunded) tickets. The backend removed the
	// old `paid_ticket_count`; it is derived as sold minus refunded.
	const netTicketCount = $derived(data.sold_count - data.refunded_count);

	const figures = $derived([
		{ label: m['financials.gross'](), value: formatMoney(data.gross, data.currency) },
		{ label: m['financials.refunds'](), value: formatMoney(data.refunds, data.currency) },
		{ label: m['financials.net'](), value: formatMoney(data.net, data.currency), strong: true },
		{ label: m['financials.netTaxable'](), value: formatMoney(data.net_taxable, data.currency) },
		{ label: m['financials.vat'](), value: formatMoney(data.vat, data.currency) }
	]);
</script>

<div class="space-y-4">
	<dl class="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
		{#each figures as figure (figure.label)}
			<div>
				<dt class="text-xs text-muted-foreground">{figure.label}</dt>
				<dd class="mt-0.5 tabular-nums {figure.strong ? 'text-lg font-semibold' : 'font-medium'}">
					{figure.value}
				</dd>
			</div>
		{/each}
	</dl>

	<div class="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
		<span>{m['financials.ticketsSold']({ count: data.sold_count })}</span>
		{#if data.refunded_count > 0}
			<span>{m['financials.ticketsRefunded']({ count: data.refunded_count })}</span>
			<span>{m['financials.ticketsHeld']({ count: netTicketCount })}</span>
		{/if}
	</div>

	{#if showRateBuckets && data.rate_buckets.length > 0}
		<details class="group rounded-md border border-border/60 bg-muted/30">
			<summary
				class="cursor-pointer list-none px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			>
				{m['financials.rateBuckets.toggle']()}
			</summary>
			<div class="border-t border-border/60 px-3 py-2">
				<RateBucketTable buckets={data.rate_buckets} currency={data.currency} />
			</div>
		</details>
	{/if}
</div>
