<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { formatMoney } from '$lib/utils/format';
	import FinancialsNote from './FinancialsNote.svelte';
	import type { MembershipFinancialsSchema } from '$lib/api/generated';

	interface Props {
		/** Membership subscription money for a single currency. */
		data: MembershipFinancialsSchema;
	}

	const { data }: Props = $props();

	// `net` is gross minus refunds with the platform fee *reported*, not deducted —
	// the same convention as the ticket side, so the two are addable.
	const figures = $derived([
		{ label: m['financials.gross'](), value: formatMoney(data.gross, data.currency) },
		{ label: m['financials.refunds'](), value: formatMoney(data.refunded_amount, data.currency) },
		{ label: m['financials.platformFee'](), value: formatMoney(data.platform_fee, data.currency) },
		{ label: m['financials.net'](), value: formatMoney(data.net, data.currency), strong: true }
	]);
</script>

<div class="space-y-4">
	<dl class="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
		{#each figures as figure (figure.label)}
			<div>
				<dt class="text-xs text-muted-foreground">{figure.label}</dt>
				<dd class="mt-0.5 tabular-nums {figure.strong ? 'text-lg font-semibold' : 'font-medium'}">
					{figure.value}
				</dd>
			</div>
		{/each}
	</dl>

	<p class="text-sm text-muted-foreground">
		{m['financials.membershipPayments']({ count: data.payment_count })}
	</p>

	<FinancialsNote>{m['financials.membershipsNote']()}</FinancialsNote>

	<p class="text-xs leading-relaxed text-muted-foreground">
		{m['financials.membershipsFeeNote']()}
	</p>
</div>
