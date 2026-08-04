<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { formatMoney } from '$lib/utils/format';
	import FinancialsNote from './FinancialsNote.svelte';
	import type { CombinedTotalsSchema } from '$lib/api/generated';

	interface Props {
		/** Ticket net + membership net for a single currency. */
		data: CombinedTotalsSchema;
	}

	const { data }: Props = $props();

	const figures = $derived([
		{
			label: m['financials.combinedTicketsNet'](),
			value: formatMoney(data.tickets_net, data.currency)
		},
		{
			label: m['financials.combinedMembershipsNet'](),
			value: formatMoney(data.memberships_net, data.currency)
		},
		{
			label: m['financials.combinedNet'](),
			value: formatMoney(data.net, data.currency),
			strong: true
		}
	]);
</script>

<div class="space-y-4">
	<dl class="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
		{#each figures as figure (figure.label)}
			<div>
				<dt class="text-xs text-muted-foreground">{figure.label}</dt>
				<!-- Headline revenue figure: studio's one permitted font-black flourish. -->
				<dd class="mt-0.5 tabular-nums {figure.strong ? 'text-xl font-black' : 'font-medium'}">
					{figure.value}
				</dd>
			</div>
		{/each}
	</dl>

	<FinancialsNote>{m['financials.combinedNote']()}</FinancialsNote>
</div>
