<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { RefundPolicyTier, TicketTierSchema } from '$lib/api/generated/types.gen';
	import { formatPrice } from '$lib/utils/format';
	import { ShieldCheck, ShieldOff, Receipt } from 'lucide-svelte';

	interface Props {
		tier: TicketTierSchema;
	}

	const { tier }: Props = $props();

	const isFree = $derived(tier.payment_method === 'free');

	// Three states: unknown (field absent — old API, fall back to silent),
	// non-refundable (field present and false), refundable (field present and true).
	const state = $derived.by((): 'unknown' | 'non-refundable' | 'refundable' => {
		if (isFree) return 'unknown';
		if (typeof tier.allow_user_cancellation !== 'boolean') return 'unknown';
		return tier.allow_user_cancellation ? 'refundable' : 'non-refundable';
	});

	// Sort by hours descending, just in case (backend already enforces this).
	const sortedBrackets = $derived.by((): RefundPolicyTier[] => {
		const tiers = tier.refund_policy?.tiers;
		if (!tiers || tiers.length === 0) return [];
		return [...tiers].sort((a, b) => Number(b.hours_before_event) - Number(a.hours_before_event));
	});

	const flatFeeAmount = $derived.by(() => {
		const fee = tier.refund_policy?.flat_fee;
		if (fee === undefined || fee === null) return 0;
		const n = typeof fee === 'string' ? parseFloat(fee) : Number(fee);
		return Number.isFinite(n) ? n : 0;
	});
</script>

{#if state === 'non-refundable'}
	<div
		class="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3 text-sm"
		role="note"
	>
		<ShieldOff class="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
		<div>
			<p class="font-medium">{m['cancellationPolicy.nonRefundableTitle']()}</p>
			<p class="text-xs text-muted-foreground">
				{m['cancellationPolicy.nonRefundableHelp']()}
			</p>
		</div>
	</div>
{:else if state === 'refundable'}
	<div class="space-y-2 rounded-lg border border-border bg-muted/30 p-3 text-sm" role="note">
		<div class="flex items-start gap-3">
			<ShieldCheck class="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
			<div class="flex-1">
				<p class="font-medium">{m['cancellationPolicy.title']()}</p>
				{#if sortedBrackets.length === 0}
					<p class="text-xs text-muted-foreground">
						{#if tier.cancellation_deadline_hours != null}
							{m['cancellationPolicy.fullRefundUntilDeadline']({
								hours: String(tier.cancellation_deadline_hours)
							})}
						{:else}
							{m['cancellationPolicy.fullRefundUntilStart']()}
						{/if}
					</p>
				{:else}
					<ul class="mt-1 space-y-0.5 text-xs text-muted-foreground">
						{#each sortedBrackets as bracket (bracket.hours_before_event)}
							<li class="tabular-nums">
								{m['cancellationPolicy.bracketRow']({
									hours: String(bracket.hours_before_event),
									pct: String(bracket.refund_percentage)
								})}
							</li>
						{/each}
					</ul>
				{/if}

				{#if tier.cancellation_deadline_hours != null && sortedBrackets.length > 0}
					<p class="mt-2 text-xs text-muted-foreground">
						{m['cancellationPolicy.deadlineNote']({
							hours: String(tier.cancellation_deadline_hours)
						})}
					</p>
				{/if}
			</div>
		</div>

		{#if flatFeeAmount > 0}
			<div
				class="flex items-center gap-2 border-t border-border/50 pt-2 text-xs text-muted-foreground"
			>
				<Receipt class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
				<span>
					{m['cancellationPolicy.flatFeeNote']({
						fee: formatPrice(tier.refund_policy?.flat_fee, tier.currency, '')
					})}
				</span>
			</div>
		{/if}
	</div>
{/if}
