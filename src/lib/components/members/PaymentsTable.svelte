<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { PaymentSchema2 } from '$lib/api/generated/types.gen';
	import { Button } from '$lib/components/ui/button';
	import { formatDate } from '$lib/utils/date';

	interface Props {
		payments: PaymentSchema2[];
		onRefund: (p: PaymentSchema2) => void;
	}

	const { payments, onRefund }: Props = $props();

	function fmtDate(d: string | null | undefined): string {
		if (!d) return '—';
		return formatDate(d);
	}
</script>

{#if payments.length === 0}
	<p class="text-sm text-muted-foreground">
		{m['orgAdmin.members.subscriptions.drawer.paymentsEmpty']()}
	</p>
{:else}
	<table class="w-full text-sm">
		<thead class="border-b text-left">
			<tr>
				<th class="py-2">{m['orgAdmin.members.subscriptions.drawer.paymentsCol.date']()}</th>
				<th class="py-2">{m['orgAdmin.members.subscriptions.drawer.paymentsCol.amount']()}</th>
				<th class="py-2">{m['orgAdmin.members.subscriptions.drawer.paymentsCol.status']()}</th>
				<th class="py-2"></th>
			</tr>
		</thead>
		<tbody>
			{#each payments as p (p.id)}
				<tr class="border-b last:border-0">
					<td class="py-2">{fmtDate(p.occurred_at ?? p.created_at)}</td>
					<td class="py-2">{p.amount} {p.currency}</td>
					<td class="py-2 capitalize">{p.status}</td>
					<td class="py-2 text-right">
						{#if p.status === 'succeeded'}
							<Button size="sm" variant="ghost" onclick={() => onRefund(p)}>
								{m['orgAdmin.members.subscriptions.drawer.refund']()}
							</Button>
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}
