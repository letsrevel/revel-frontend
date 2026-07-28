<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { OrganizationMembershipPaymentSchema } from '$lib/api/generated/types.gen';
	import { formatMoney } from '$lib/utils/format';
	import { formatDate } from '$lib/utils/date';
	import { ExternalLink } from '@lucide/svelte';
	import SubscriptionPaymentsStatusBadge from './SubscriptionPaymentsStatusBadge.svelte';
	import { partialRefundAmount } from './SubscriptionPaymentsShared';

	interface Props {
		payment: OrganizationMembershipPaymentSchema;
	}

	const { payment }: Props = $props();

	// The ledger's human "when": `occurred_at` is the real-world payment date
	// (staff can backdate it when recording an offline payment); `created_at` is
	// only when the row was written. Mirrors PaymentsTable.
	const when = $derived(formatDate(payment.occurred_at ?? payment.created_at));
	const refunded = $derived(partialRefundAmount(payment));
</script>

<tr class="border-b align-top last:border-0">
	<td class="px-3 py-2">
		<div class="font-medium">{payment.user_display_name}</div>
		<div class="text-xs text-muted-foreground">{payment.user_email}</div>
	</td>
	<td class="px-3 py-2 text-sm">{payment.plan_name}</td>
	<td class="px-3 py-2 tabular-nums">
		{formatMoney(payment.amount, payment.currency)}
		{#if refunded !== null}
			<span class="block text-xs text-muted-foreground">
				{m['orgAdmin.members.payments.partiallyRefunded']({
					amount: formatMoney(refunded, payment.currency)
				})}
			</span>
		{/if}
	</td>
	<td class="px-3 py-2">
		<SubscriptionPaymentsStatusBadge status={payment.status} />
		{#if payment.recorded_by_name}
			<span class="mt-1 block text-xs text-muted-foreground">
				{m['orgAdmin.members.payments.recordedBy']({ name: payment.recorded_by_name })}
			</span>
		{/if}
	</td>
	<td class="px-3 py-2 text-sm">
		<div>{when}</div>
		<div class="text-xs text-muted-foreground">
			{m['orgAdmin.members.payments.periodRange']({
				start: formatDate(payment.period_start),
				end: formatDate(payment.period_end)
			})}
		</div>
	</td>
	<td class="px-3 py-2 text-right">
		{#if payment.stripe_dashboard_url}
			<!-- eslint-disable svelte/no-navigation-without-resolve -- absolute Stripe Dashboard URL built by the backend; it is not an app route, so resolve() cannot express it -->
			<a
				href={payment.stripe_dashboard_url}
				target="_blank"
				rel="noopener noreferrer"
				aria-label={m['orgAdmin.members.payments.viewOnStripeFor']({
					name: payment.user_display_name
				})}
				class="inline-flex items-center gap-1 rounded-md text-sm text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			>
				<ExternalLink class="h-4 w-4 shrink-0" aria-hidden="true" />
				{m['orgAdmin.members.payments.viewOnStripe']()}
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		{:else}
			<span class="text-sm text-muted-foreground" aria-hidden="true">—</span>
			<span class="sr-only">{m['orgAdmin.members.payments.noStripeRecord']()}</span>
		{/if}
	</td>
</tr>
