<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { formatMoney } from '$lib/utils/format';
	import type { InvoiceVatBucketSchema } from '$lib/api/generated';

	interface Props {
		/**
		 * Per-VAT-rate buckets of a single attendee invoice (#870). Distinct from
		 * RateBucketTable's org-financials RateBucketSchema. Generated invoices
		 * reconcile these to the header totals, but a hand-edited draft can carry
		 * buckets that disagree with its header (backend #911) — never build
		 * cross-checks on the two agreeing.
		 */
		buckets: InvoiceVatBucketSchema[];
		currency: string;
	}

	const { buckets, currency }: Props = $props();
</script>

{#if buckets.length > 0}
	<div class="overflow-x-auto">
		<table class="w-full text-sm">
			<caption class="sr-only">{m['financials.rateBuckets.caption']()}</caption>
			<thead>
				<tr class="border-b text-left text-xs text-muted-foreground">
					<th scope="col" class="py-2 pr-4 font-medium">{m['financials.rateBuckets.rate']()}</th>
					<th scope="col" class="py-2 pr-4 text-right font-medium">{m['financials.net']()}</th>
					<th scope="col" class="py-2 pr-4 text-right font-medium">{m['financials.vat']()}</th>
					<th scope="col" class="py-2 text-right font-medium">{m['financials.gross']()}</th>
				</tr>
			</thead>
			<tbody>
				{#each buckets as bucket (bucket.vat_rate)}
					<tr class="border-b border-border/50 last:border-0">
						<th scope="row" class="py-2 pr-4 font-normal">{bucket.vat_rate}%</th>
						<td class="py-2 pr-4 text-right font-mono"
							>{formatMoney(bucket.net_amount, currency)}</td
						>
						<td class="py-2 pr-4 text-right font-mono"
							>{formatMoney(bucket.vat_amount, currency)}</td
						>
						<td class="py-2 text-right font-mono">{formatMoney(bucket.gross_amount, currency)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
