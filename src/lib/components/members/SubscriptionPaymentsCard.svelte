<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { OrganizationMembershipPaymentSchema } from '$lib/api/generated/types.gen';
	import { formatMoney } from '$lib/utils/format';
	import { formatDate } from '$lib/utils/date';
	import { ExternalLink } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import SubscriptionPaymentsStatusBadge from './SubscriptionPaymentsStatusBadge.svelte';
	import {
		canRefundLedgerPayment,
		partialRefundAmount,
		platformFeeBreakdown
	} from './SubscriptionPaymentsShared';

	interface Props {
		payment: OrganizationMembershipPaymentSchema;
		/** Opens the refund dialog. The tab owns the mutation and the cache. */
		onRefund: (payment: OrganizationMembershipPaymentSchema) => void;
	}

	const { payment, onRefund }: Props = $props();

	const when = $derived(formatDate(payment.occurred_at ?? payment.created_at));
	const refunded = $derived(partialRefundAmount(payment));
	// Same suppression rule as the desktop row — the card must carry the same
	// information, so the two are gated by one shared predicate.
	const fee = $derived(platformFeeBreakdown(payment));
	// Same gate as the desktop row, for the same reason.
	const canRefund = $derived(!!payment.id && canRefundLedgerPayment(payment));
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

	{#if fee}
		<!-- Gross → fee → net. Kept in parity with SubscriptionPaymentsRow. -->
		<p class="sr-only">{m['orgAdmin.members.payments.feeBreakdownLabel']()}</p>
		<dl class="mt-2 space-y-0.5 border-t pt-2 text-xs text-muted-foreground">
			<div class="flex justify-between gap-3">
				<dt>{m['orgAdmin.members.payments.feePlatformFee']()}</dt>
				<dd class="tabular-nums">{formatMoney(-fee.feeGross, payment.currency)}</dd>
			</div>
			{#if fee.feeExclVat !== null}
				<div class="flex justify-between gap-3">
					<dt>{m['orgAdmin.members.payments.feeExclVat']()}</dt>
					<dd class="tabular-nums">{formatMoney(fee.feeExclVat, payment.currency)}</dd>
				</div>
			{/if}
			{#if fee.reverseCharge}
				<div class="flex justify-between gap-3">
					<dt>{m['orgAdmin.members.payments.feeReverseCharge']()}</dt>
					<dd class="text-right">{m['orgAdmin.members.payments.feeReverseChargeYes']()}</dd>
				</div>
			{:else if fee.feeVat !== null && fee.feeVatRate !== null}
				<div class="flex justify-between gap-3">
					<dt>{m['orgAdmin.members.payments.feeVat']({ rate: fee.feeVatRate })}</dt>
					<dd class="tabular-nums">{formatMoney(fee.feeVat, payment.currency)}</dd>
				</div>
			{/if}
			{#if fee.refundAmount !== null}
				<div class="flex justify-between gap-3">
					<dt>{m['orgAdmin.members.payments.feeRefunded']()}</dt>
					<dd class="tabular-nums">{formatMoney(-fee.refundAmount, payment.currency)}</dd>
				</div>
			{/if}
			<div class="flex justify-between gap-3 font-medium text-foreground">
				<dt>{m['orgAdmin.members.payments.feeNetToOrg']()}</dt>
				<dd class="tabular-nums" class:text-destructive={fee.netToOrganizer < 0}>
					{formatMoney(fee.netToOrganizer, payment.currency)}
				</dd>
			</div>
		</dl>
		{#if fee.hasRefund}
			<p class="mt-1 text-xs text-muted-foreground">
				{m['orgAdmin.members.payments.feeRefundRule']()}
			</p>
		{/if}
		{#if fee.netToOrganizer < 0}
			<p class="mt-1 text-xs text-muted-foreground">
				{m['orgAdmin.members.payments.feeNetNegative']()}
			</p>
		{/if}
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

	<!-- Full parity with the desktop row: same two controls, same gating. -->
	{#if payment.stripe_dashboard_url || canRefund}
		<div class="mt-2 flex flex-wrap items-center gap-2">
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
			{/if}
			{#if canRefund}
				<Button
					size="sm"
					variant="outline"
					aria-label={m['orgAdmin.members.payments.refundFor']({
						name: payment.user_display_name
					})}
					onclick={() => onRefund(payment)}
				>
					{m['orgAdmin.members.payments.refund']()}
				</Button>
			{/if}
		</div>
	{/if}
</li>
