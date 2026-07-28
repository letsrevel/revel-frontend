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

	// The ledger's human "when": `occurred_at` is the real-world payment date
	// (staff can backdate it when recording an offline payment); `created_at` is
	// only when the row was written. Mirrors PaymentsTable.
	const when = $derived(formatDate(payment.occurred_at ?? payment.created_at));
	const refunded = $derived(partialRefundAmount(payment));
	// `null` whenever no platform fee was actually taken (offline, failed, or a
	// row predating the fee columns) — the whole breakdown is then suppressed.
	const fee = $derived(platformFeeBreakdown(payment));
	// Rendered only where `POST …/payments/{id}/refund` would actually succeed.
	// `payment.id` is nullable on the schema, and the call needs it as a path param.
	const canRefund = $derived(!!payment.id && canRefundLedgerPayment(payment));
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
		{#if fee}
			<!-- Gross → fee → net, so a row reconciles against a Stripe payout line.
			     Kept in parity with SubscriptionPaymentsCard (the mobile variant). -->
			<p class="sr-only">{m['orgAdmin.members.payments.feeBreakdownLabel']()}</p>
			<dl class="mt-1 max-w-[18rem] space-y-0.5 text-xs font-normal text-muted-foreground">
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
						<dd>{m['orgAdmin.members.payments.feeReverseChargeYes']()}</dd>
					</div>
				{:else if fee.feeVat !== null && fee.feeVatRate !== null}
					<div class="flex justify-between gap-3">
						<dt>{m['orgAdmin.members.payments.feeVat']({ rate: fee.feeVatRate })}</dt>
						<dd class="tabular-nums">{formatMoney(fee.feeVat, payment.currency)}</dd>
					</div>
				{/if}
				{#if fee.refundAmount !== null}
					<!-- Its own deduction line, below the fee: Revel keeps the fee, so the
					     money handed back comes out of the organizer's share. -->
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
				<!-- Only next to a refund: this is what explains why the fee line above
				     did NOT shrink. -->
				<p class="mt-1 max-w-[18rem] text-xs font-normal text-muted-foreground">
					{m['orgAdmin.members.payments.feeRefundRule']()}
				</p>
			{/if}
			{#if fee.netToOrganizer < 0}
				<!-- Spells the minus sign out, so a legitimately negative net cannot be
				     read as a rendering bug. Never colour alone. -->
				<p class="mt-1 max-w-[18rem] text-xs font-normal text-muted-foreground">
					{m['orgAdmin.members.payments.feeNetNegative']()}
				</p>
			{/if}
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
		<div class="flex flex-wrap items-center justify-end gap-2">
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
				<!-- The ledger lists every member, so the row's own name has to be in the
				     accessible name — "Refund" alone is ambiguous across 20 rows. -->
				<Button
					size="sm"
					variant="ghost"
					aria-label={m['orgAdmin.members.payments.refundFor']({
						name: payment.user_display_name
					})}
					onclick={() => onRefund(payment)}
				>
					{m['orgAdmin.members.payments.refund']()}
				</Button>
			{/if}
			{#if !payment.stripe_dashboard_url && !canRefund}
				<span class="text-sm text-muted-foreground" aria-hidden="true">—</span>
				<span class="sr-only">{m['orgAdmin.members.payments.noActions']()}</span>
			{/if}
		</div>
	</td>
</tr>
