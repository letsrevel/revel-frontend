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

	const when = $derived(formatDate(payment.occurred_at ?? payment.created_at));
	const refunded = $derived(partialRefundAmount(payment));
</script>

<li class="rounded-lg border p-3">
	<div class="flex items-start justify-between gap-2">
		<div class="min-w-0">
			<div class="truncate font-medium">{payment.user_display_name}</div>
			<div class="truncate text-xs text-muted-foreground">{payment.user_email}</div>
		</div>
		<SubscriptionPaymentsStatusBadge status={payment.status} />
	</div>

	<div class="mt-2 flex items-baseline justify-between gap-2">
		<span class="text-base font-semibold tabular-nums">
			{formatMoney(payment.amount, payment.currency)}
		</span>
		<span class="text-sm text-muted-foreground">{when}</span>
	</div>

	{#if refunded !== null}
		<p class="mt-1 text-xs text-muted-foreground">
			{m['orgAdmin.members.payments.partiallyRefunded']({
				amount: formatMoney(refunded, payment.currency)
			})}
		</p>
	{/if}

	<dl class="mt-2 space-y-0.5 text-xs text-muted-foreground">
		<div class="flex gap-1">
			<dt class="font-medium">{m['orgAdmin.members.payments.col.plan']()}</dt>
			<dd class="min-w-0 truncate">{payment.plan_name}</dd>
		</div>
		<div class="flex gap-1">
			<dt class="sr-only">{m['orgAdmin.members.payments.periodLabel']()}</dt>
			<dd>
				{m['orgAdmin.members.payments.periodRange']({
					start: formatDate(payment.period_start),
					end: formatDate(payment.period_end)
				})}
			</dd>
		</div>
		{#if payment.recorded_by_name}
			<div class="flex gap-1">
				<dt class="sr-only">{m['orgAdmin.members.payments.recordedByLabel']()}</dt>
				<dd>{m['orgAdmin.members.payments.recordedBy']({ name: payment.recorded_by_name })}</dd>
			</div>
		{/if}
	</dl>

	{#if payment.stripe_dashboard_url}
		<!-- eslint-disable svelte/no-navigation-without-resolve -- absolute Stripe Dashboard URL built by the backend; it is not an app route, so resolve() cannot express it -->
		<a
			href={payment.stripe_dashboard_url}
			target="_blank"
			rel="noopener noreferrer"
			aria-label={m['orgAdmin.members.payments.viewOnStripeFor']({
				name: payment.user_display_name
			})}
			class="mt-2 inline-flex items-center gap-1 rounded-md text-sm text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
		>
			<ExternalLink class="h-4 w-4 shrink-0" aria-hidden="true" />
			{m['orgAdmin.members.payments.viewOnStripe']()}
		</a>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
	{/if}
</li>
