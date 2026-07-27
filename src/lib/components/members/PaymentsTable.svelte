<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { MembershipPaymentSchema } from '$lib/api/generated/types.gen';
	import { Button } from '$lib/components/ui/button';
	import { ExternalLink } from '@lucide/svelte';
	import { formatDate } from '$lib/utils/date';

	interface Props {
		payments: MembershipPaymentSchema[];
		/**
		 * Whether the owning subscription sits on an ONLINE (Stripe) plan. Mirrors
		 * the backend guard, which refuses `POST .../refund` with a 400 for those
		 * payments: money moved through Stripe has to come back through Stripe,
		 * and the `charge.refunded` webhook records it here on its own. So we hide
		 * the control entirely rather than render one the API will reject.
		 */
		isOnlinePlan?: boolean;
		onRefund: (p: MembershipPaymentSchema) => void;
	}

	const { payments, isOnlinePlan = false, onRefund }: Props = $props();

	const showOnlineRefundNote = $derived(
		isOnlinePlan && payments.some((p) => p.status === 'succeeded')
	);

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
					<td class="py-2">
						<div class="flex flex-wrap items-center justify-end gap-1">
							{#if p.stripe_dashboard_url}
								<Button
									href={p.stripe_dashboard_url}
									target="_blank"
									rel="noopener noreferrer"
									size="sm"
									variant="ghost"
								>
									<ExternalLink class="h-4 w-4" aria-hidden="true" />
									{m['orgAdmin.members.subscriptions.drawer.paymentOnStripe']()}
								</Button>
							{/if}
							{#if p.status === 'succeeded' && !isOnlinePlan}
								<Button size="sm" variant="ghost" onclick={() => onRefund(p)}>
									{m['orgAdmin.members.subscriptions.drawer.refund']()}
								</Button>
							{/if}
						</div>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
	{#if showOnlineRefundNote}
		<p class="mt-2 text-xs text-muted-foreground">
			{m['orgAdmin.members.subscriptions.drawer.onlineRefundNote']()}
		</p>
	{/if}
{/if}
