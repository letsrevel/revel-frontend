<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/ui/button';
	import { Download, Loader2 } from '@lucide/svelte';
	import type { AttendeeInvoiceDetailSchema } from '$lib/api/generated/types.gen';
	import { formatMoney } from '$lib/utils/format';
	import { formatDate } from '$lib/utils/date';
	import { buyerAddressText, exemptionEntries } from '$lib/utils/attendee-invoice';
	import InvoiceVatBreakdownTable from '$lib/components/financials/InvoiceVatBreakdownTable.svelte';
	import AttendeeInvoiceDraftActions from '$lib/components/financials/AttendeeInvoiceDraftActions.svelte';

	interface Props {
		invoice: AttendeeInvoiceDetailSchema;
		onEdit: () => void;
		onIssue: () => void;
		onDelete: () => void;
		onDownload: () => void;
		downloadPending?: boolean;
	}

	const {
		invoice: inv,
		onEdit,
		onIssue,
		onDelete,
		onDownload,
		downloadPending = false
	}: Props = $props();

	const buyerAddress = $derived(buyerAddressText(inv));
	const exemptions = $derived(exemptionEntries(inv.vat_exemptions));
</script>

<div class="space-y-5">
	<div class="grid gap-4 sm:grid-cols-2">
		<div class="space-y-1 text-sm">
			<h3 class="font-medium">{m['orgAdmin.billing.attendeeInvoices.buyerInfo']()}</h3>
			<p>{inv.buyer_name}</p>
			<p class="text-muted-foreground">{inv.buyer_email}</p>
			{#if buyerAddress}<p
					class="whitespace-pre-line text-muted-foreground"
					data-testid="buyer-address"
				>
					{buyerAddress}
				</p>{/if}
			{#if inv.buyer_vat_id}<p class="text-muted-foreground">
					VAT: {inv.buyer_vat_id}
				</p>{/if}
			{#if inv.buyer_vat_country}<p class="text-muted-foreground">
					{inv.buyer_vat_country}
				</p>{/if}
		</div>
		<div class="space-y-1 text-sm">
			<h3 class="font-medium">{m['orgAdmin.billing.attendeeInvoices.sellerInfo']()}</h3>
			<p>{inv.seller_name}</p>
			{#if inv.seller_email}<p class="text-muted-foreground">{inv.seller_email}</p>{/if}
			{#if inv.seller_address}<p class="text-muted-foreground">{inv.seller_address}</p>{/if}
			{#if inv.seller_vat_id}<p class="text-muted-foreground">
					VAT: {inv.seller_vat_id}
				</p>{/if}
			{#if inv.seller_vat_country}<p class="text-muted-foreground">
					{inv.seller_vat_country}
				</p>{/if}
		</div>
	</div>

	{#if inv.line_items?.length}
		<div class="space-y-2 rounded-lg border bg-muted/30 p-4">
			<h3 class="font-medium">{m['orgAdmin.billing.attendeeInvoices.lineItems']()}</h3>
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="text-left text-muted-foreground">
							<th class="pb-2 pr-4">{m['orgAdmin.billing.attendeeInvoices.lineDescription']()}</th>
							<th class="pb-2 pr-4 text-right"
								>{m['orgAdmin.billing.attendeeInvoices.unitPrice']()}</th
							>
							<th class="pb-2 pr-4 text-right">{m['orgAdmin.billing.attendeeInvoices.net']()}</th>
							<th class="pb-2 text-right">{m['orgAdmin.billing.attendeeInvoices.vat']()}</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border/50">
						{#each inv.line_items as item, i (i)}
							<tr>
								<td class="py-2 pr-4">{item.description}</td>
								<td class="py-2 pr-4 text-right font-mono"
									>{formatMoney(item.unit_price_gross, inv.currency)}</td
								>
								<td class="py-2 pr-4 text-right font-mono"
									>{formatMoney(item.net_amount, inv.currency)}</td
								>
								<td class="py-2 text-right font-mono"
									>{formatMoney(item.vat_amount, inv.currency)}</td
								>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}

	<div class="space-y-2 rounded-lg border bg-muted/30 p-4">
		<h3 class="font-medium">{m['orgAdmin.billing.attendeeInvoices.breakdown']()}</h3>
		<dl class="space-y-1 text-sm">
			<div class="flex justify-between">
				<dt class="text-muted-foreground">
					{m['orgAdmin.billing.attendeeInvoices.totalNet']()}
				</dt>
				<dd class="font-mono">{formatMoney(inv.total_net, inv.currency)}</dd>
			</div>
			<div class="flex justify-between">
				<dt class="text-muted-foreground">
					{#if inv.has_mixed_vat_rates}
						{m['orgAdmin.billing.attendeeInvoices.totalVatMixed']()}
					{:else}
						{m['orgAdmin.billing.attendeeInvoices.totalVat']({ rate: inv.vat_rate })}
					{/if}
				</dt>
				<dd class="font-mono">{formatMoney(inv.total_vat, inv.currency)}</dd>
			</div>
			<div class="flex justify-between border-t pt-1.5 font-medium">
				<dt>{m['orgAdmin.billing.attendeeInvoices.totalGross']()}</dt>
				<dd class="font-mono">{formatMoney(inv.total_gross, inv.currency)}</dd>
			</div>
		</dl>
		{#if inv.has_mixed_vat_rates && inv.vat_breakdown.length > 0}
			<div class="mt-3 border-t pt-3">
				<InvoiceVatBreakdownTable buckets={inv.vat_breakdown} currency={inv.currency} />
			</div>
		{/if}
	</div>

	{#if inv.reverse_charge}
		<p class="text-sm text-muted-foreground">
			{m['orgAdmin.billing.attendeeInvoices.reverseCharge']()}: {m[
				'orgAdmin.billing.attendeeInvoices.reverseChargeYes'
			]()}
		</p>
	{/if}

	{#if inv.discount_code_text || parseFloat(inv.discount_amount_total) > 0}
		<div class="text-sm">
			<h3 class="font-medium">{m['orgAdmin.billing.attendeeInvoices.discountCode']()}</h3>
			{#if inv.discount_code_text}<p class="text-muted-foreground">
					{inv.discount_code_text}
				</p>{/if}
			{#if parseFloat(inv.discount_amount_total) > 0}<p class="text-muted-foreground">
					-{formatMoney(inv.discount_amount_total, inv.currency)}
				</p>{/if}
		</div>
	{/if}

	{#if exemptions.length > 0}
		<div class="space-y-1 text-sm" data-testid="vat-exemptions">
			<h3 class="font-medium">{m['einvoice.exemptionsTitle']()}</h3>
			<ul class="space-y-0.5">
				{#each exemptions as ex (ex.category)}
					<li class="text-muted-foreground">
						{m['einvoice.exemptionCategory']({ category: ex.category })}: {ex.text}
						{#if ex.code}<span class="font-mono text-xs">{ex.code}</span>{/if}
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	{#if inv.supply_date}
		<p class="text-sm" data-testid="supply-dates">
			<span class="font-medium">
				{inv.supply_period_end ? m['einvoice.supplyPeriod']() : m['einvoice.supplyDate']()}:
			</span>
			<span class="text-muted-foreground">
				{formatDate(inv.supply_date, 'UTC')}{#if inv.supply_period_end}
					&ndash; {formatDate(inv.supply_period_end, 'UTC')}{/if}
			</span>
		</p>
	{/if}

	{#if inv.payment_method_label || inv.card_last4}
		<p class="text-sm" data-testid="payment-line">
			<span class="font-medium">{m['einvoice.payment']()}:</span>
			<span class="text-muted-foreground">
				{inv.payment_method_label}
				{#if inv.card_last4}<span class="font-mono"
						><span aria-hidden="true">••••</span> {inv.card_last4}</span
					>{/if}
			</span>
		</p>
	{/if}

	<div class="flex flex-col gap-2">
		{#if inv.status === 'draft'}
			<AttendeeInvoiceDraftActions
				blockedReason={inv.issue_blocked_reason}
				onEdit={() => onEdit()}
				onIssue={() => onIssue()}
				onDelete={() => onDelete()}
			/>
		{:else}
			<Button class="w-full" onclick={() => onDownload()} disabled={downloadPending}>
				{#if downloadPending}<Loader2
						class="mr-2 h-4 w-4 animate-spin"
						aria-hidden="true"
					/>{:else}<Download class="mr-2 h-4 w-4" aria-hidden="true" />{/if}
				{m['orgAdmin.billing.attendeeInvoices.downloadPdf']()}
			</Button>
		{/if}
	</div>
</div>
