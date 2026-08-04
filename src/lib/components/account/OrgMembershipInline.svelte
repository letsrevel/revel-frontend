<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createQuery } from '@tanstack/svelte-query';
	import type { PublicPlanSchema } from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { myOrgSubscriptionQueryOptions } from '$lib/queries/my-org-subscription';
	import { Card, CardContent } from '$lib/components/ui/card';
	import SubscriptionStatusBadge from '$lib/components/members/SubscriptionStatusBadge.svelte';
	import { formatPlanPrice, getDateLine } from '$lib/utils/subscriptions';
	import { formatDate } from '$lib/utils/date';
	import { resolve } from '$app/paths';

	interface Props {
		orgId: string;
		orgName: string;
		/** Public plans of the org — used only to name a pending plan switch. */
		plans?: PublicPlanSchema[];
	}

	const { orgId, orgName, plans = [] }: Props = $props();
	const accessToken = $derived(authStore.accessToken);

	// Shared options: the plan grid further down the page observes the very same
	// key and fetcher, so the two surfaces cost one request and never disagree.
	const subQuery = createQuery(() => myOrgSubscriptionQueryOptions(orgId, accessToken));

	const sub = $derived(subQuery.data);

	function fmtDate(d: string | null | undefined): string {
		return d ? formatDate(d) : '—';
	}

	/**
	 * A queued plan change takes effect at the end of the paid period, so the
	 * line only makes sense once we know that date — otherwise it is omitted.
	 */
	const pendingSwitch = $derived.by(() => {
		const pendingPlanId = sub?.pending_plan_id;
		const periodEnd = sub?.current_period_end;
		if (!pendingPlanId || !periodEnd) return null;
		const name =
			plans.find((p) => p.id === pendingPlanId)?.name ??
			m['orgPublic.yourMembership.pendingSwitchFallbackPlan']();
		return m['orgPublic.yourMembership.pendingSwitch']({
			plan: name,
			date: formatDate(periodEnd)
		});
	});
</script>

{#if sub}
	{@const line = getDateLine(sub)}
	<Card>
		<CardContent class="p-4">
			<h3 class="text-xs font-extrabold uppercase tracking-[0.12em] text-primary">
				{m['orgPublic.yourMembership.title']()}
			</h3>
			<div class="mt-1 font-medium">{sub.plan.name}</div>
			<div class="text-sm text-muted-foreground">{formatPlanPrice(sub.plan)}</div>
			<div class="mt-2 flex items-center gap-2">
				<SubscriptionStatusBadge status={sub.status} />
				<span class="text-xs text-muted-foreground">
					{#if line.kind === 'renewal'}
						{m['subscriptions.dateLine.renewal']({ date: fmtDate(line.date) })}
					{:else if line.kind === 'cancels'}
						{m['subscriptions.dateLine.cancels']({ date: fmtDate(line.date) })}
					{:else if line.kind === 'period_ends'}
						{m['subscriptions.dateLine.periodEnds']({ date: fmtDate(line.date) })}
					{:else if line.kind === 'paused_since'}
						{m['subscriptions.dateLine.pausedSince']({ date: fmtDate(line.date) })}
					{:else if line.kind === 'ended'}
						{m['subscriptions.dateLine.ended']({ date: fmtDate(line.date) })}
					{:else if line.kind === 'pending'}
						{m['subscriptions.dateLine.pending']()}
					{/if}
				</span>
			</div>
			{#if pendingSwitch}
				<p class="mt-2 text-sm text-muted-foreground">{pendingSwitch}</p>
			{/if}
			<a
				href={resolve('/(auth)/account/memberships', {})}
				class="mt-3 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
			>
				{m['orgPublic.yourMembership.manage']()}<span aria-hidden="true"> →</span>
			</a>
			{#if sub.plan.payment_method === 'offline'}
				<p class="mt-3 text-xs text-muted-foreground">
					{m['orgPublic.yourMembership.managedBy']({ org: orgName })}
				</p>
			{/if}
		</CardContent>
	</Card>
{/if}
