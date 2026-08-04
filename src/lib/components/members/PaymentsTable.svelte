<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { MembershipPaymentSchema } from '$lib/api/generated/types.gen';
	import { Button } from '$lib/components/ui/button';
	import { ExternalLink } from '@lucide/svelte';
	import { formatDate } from '$lib/utils/date';
	import { formatMoney } from '$lib/utils/format';
	import { partialRefundAmount, platformFeeBreakdown } from './SubscriptionPaymentsShared';

	interface Props {
		payments: MembershipPaymentSchema[];
		/**
		 * Whether the owning subscription sits on an ONLINE (Stripe) plan. Mirrors
		 * the backend guard, which refuses `POST .../refund` with a 400 for those
		 * payments: money moved through Stripe has to come back through Stripe,
		 * and the `charge.refunded` webhook records it here on its own. So we hide
		 * the control entirely rather than render one the API will reject.
		 *
		 * REQUIRED, deliberately: an optional `= false` default fails OPEN. A
		 * future consumer that simply forgets the prop would silently get the
		 * offline branch back and render a refund button that can only ever 400.
		 * Required makes that a compile error at the call site instead.
		 */
		isOnlinePlan: boolean;
		onRefund: (p: MembershipPaymentSchema) => void;
	}

	const { payments, isOnlinePlan, onRefund }: Props = $props();

	/**
	 * The note tells staff to refund from the Stripe dashboard — so it only earns
	 * its place when there is at least one succeeded payment that actually links
	 * there. Without a link it is a URL-less dead end: it names a destination the
	 * reader has no way to reach from this drawer.
	 */
	const showOnlineRefundNote = $derived(
		isOnlinePlan && payments.some((p) => p.status === 'succeeded' && !!p.stripe_dashboard_url)
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
	<!-- The fee breakdown adds depth, not width, to the Amount cell — but the
	     drawer is narrow, so the table still gets its own scroll container
	     rather than pushing the page sideways. -->
	<div class="overflow-x-auto">
		<table class="w-full text-sm">
			<thead class="border-b text-left">
				<tr>
					<th
						scope="col"
						class="py-2 text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground"
						>{m['orgAdmin.members.subscriptions.drawer.paymentsCol.date']()}</th
					>
					<th
						scope="col"
						class="py-2 text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground"
						>{m['orgAdmin.members.subscriptions.drawer.paymentsCol.amount']()}</th
					>
					<th
						scope="col"
						class="py-2 text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground"
						>{m['orgAdmin.members.subscriptions.drawer.paymentsCol.status']()}</th
					>
					<th class="py-2"></th>
				</tr>
			</thead>
			<tbody>
				{#each payments as p (p.id)}
					{@const refunded = partialRefundAmount(p)}
					{@const fee = platformFeeBreakdown(p)}
					<tr class="border-b align-top last:border-0">
						<td class="py-2">{fmtDate(p.occurred_at ?? p.created_at)}</td>
						<td class="py-2">
							<span class="tabular-nums">{formatMoney(p.amount, p.currency)}</span>
							{#if refunded !== null}
								<span class="block text-xs text-muted-foreground">
									{m['orgAdmin.members.subscriptions.drawer.partiallyRefunded']({
										amount: refunded,
										currency: p.currency
									})}
								</span>
							{/if}
							{#if fee}
								<!-- Kept in parity with SubscriptionPaymentsRow/Card (org-wide ledger). -->
								<p class="sr-only">
									{m['orgAdmin.members.subscriptions.drawer.feeBreakdownLabel']()}
								</p>
								<dl class="mt-1 space-y-0.5 text-xs text-muted-foreground">
									<div class="flex justify-between gap-3">
										<dt>{m['orgAdmin.members.subscriptions.drawer.feePlatformFee']()}</dt>
										<dd class="tabular-nums">{formatMoney(-fee.feeGross, p.currency)}</dd>
									</div>
									{#if fee.feeExclVat !== null}
										<div class="flex justify-between gap-3">
											<dt>{m['orgAdmin.members.subscriptions.drawer.feeExclVat']()}</dt>
											<dd class="tabular-nums">{formatMoney(fee.feeExclVat, p.currency)}</dd>
										</div>
									{/if}
									{#if fee.reverseCharge}
										<div class="flex justify-between gap-3">
											<dt>{m['orgAdmin.members.subscriptions.drawer.feeReverseCharge']()}</dt>
											<dd>{m['orgAdmin.members.subscriptions.drawer.feeReverseChargeYes']()}</dd>
										</div>
									{:else if fee.feeVat !== null && fee.feeVatRate !== null}
										<div class="flex justify-between gap-3">
											<dt>
												{m['orgAdmin.members.subscriptions.drawer.feeVat']({
													rate: fee.feeVatRate
												})}
											</dt>
											<dd class="tabular-nums">{formatMoney(fee.feeVat, p.currency)}</dd>
										</div>
									{/if}
									{#if fee.refundAmount !== null}
										<!-- The refund is its own deduction, below the fee: Revel keeps the
										     fee, so the money handed back comes out of the organizer's share. -->
										<div class="flex justify-between gap-3">
											<dt>{m['orgAdmin.members.subscriptions.drawer.feeRefunded']()}</dt>
											<dd class="tabular-nums">{formatMoney(-fee.refundAmount, p.currency)}</dd>
										</div>
									{/if}
									<div class="flex justify-between gap-3 font-medium text-foreground">
										<dt>{m['orgAdmin.members.subscriptions.drawer.feeNetToOrg']()}</dt>
										<dd class="tabular-nums" class:text-destructive={fee.netToOrganizer < 0}>
											{formatMoney(fee.netToOrganizer, p.currency)}
										</dd>
									</div>
								</dl>
								{#if fee.hasRefund}
									<!-- Only next to a refund: this is what explains why the fee line
									     above did NOT shrink. On an unrefunded row it would be noise. -->
									<p class="mt-1 text-xs text-muted-foreground">
										{m['orgAdmin.members.subscriptions.drawer.feeRefundRule']()}
									</p>
								{/if}
								{#if fee.netToOrganizer < 0}
									<!-- Spells the minus sign out in words, so a legitimately negative
									     net cannot be read as a rendering bug. Never colour alone. -->
									<p class="mt-1 text-xs text-muted-foreground">
										{m['orgAdmin.members.subscriptions.drawer.feeNetNegative']()}
									</p>
								{/if}
							{/if}
						</td>
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
	</div>
	{#if showOnlineRefundNote}
		<p class="mt-2 text-xs text-muted-foreground">
			{m['orgAdmin.members.subscriptions.drawer.onlineRefundNote']()}
		</p>
	{/if}
{/if}
