<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { formatMoney } from '$lib/utils/format';
	import type { RateBucketSchema } from '$lib/api/generated';

	interface Props {
		/** Per-VAT-rate breakdown for a single currency. */
		buckets: RateBucketSchema[];
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
					<th scope="col" class="py-2 pr-4 text-right font-medium">{m['financials.gross']()}</th>
					<th scope="col" class="py-2 text-right font-medium"
						>{m['financials.rateBuckets.tickets']()}</th
					>
				</tr>
			</thead>
			<tbody>
				{#each buckets as bucket (bucket.vat_rate + bucket.label)}
					<tr class="border-b border-border/50 last:border-0">
						<th scope="row" class="py-2 pr-4 font-normal">{bucket.label}</th>
						<td class="py-2 pr-4 text-right tabular-nums">{formatMoney(bucket.net, currency)}</td>
						<td class="py-2 pr-4 text-right tabular-nums">{formatMoney(bucket.vat, currency)}</td>
						<td class="py-2 pr-4 text-right tabular-nums">{formatMoney(bucket.gross, currency)}</td>
						<td class="py-2 text-right tabular-nums">{bucket.ticket_count}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
