<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createQuery } from '@tanstack/svelte-query';
	import { mesubscriptionsGetMySubscription } from '$lib/api/generated/sdk.gen';
	import type { MySubscriptionSchema } from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Card, CardContent } from '$lib/components/ui/card';
	import StatusBadge from '$lib/components/members/StatusBadge.svelte';
	import { formatPlanPrice, getDateLine } from '$lib/utils/subscriptions';
	import { formatDate } from '$lib/utils/date';

	interface Props {
		orgId: string;
		orgName: string;
	}

	const { orgId, orgName }: Props = $props();
	const accessToken = $derived(authStore.accessToken);

	const subQuery = createQuery(() => ({
		queryKey: ['me', 'org', orgId, 'subscription'],
		queryFn: async () => {
			const res = await mesubscriptionsGetMySubscription({
				path: { org_id: orgId },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (res.error) return null;
			return res.data as MySubscriptionSchema;
		},
		enabled: !!accessToken,
		retry: false
	}));

	const sub = $derived(subQuery.data);

	function fmtDate(d: string | null | undefined): string {
		return d ? formatDate(d) : '—';
	}
</script>

{#if sub}
	{@const line = getDateLine(sub)}
	<Card>
		<CardContent class="p-4">
			<h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
				{m['orgPublic.yourMembership.title']()}
			</h3>
			<div class="mt-1 font-medium">{sub.plan.name}</div>
			<div class="text-sm text-muted-foreground">{formatPlanPrice(sub.plan)}</div>
			<div class="mt-2 flex items-center gap-2">
				<StatusBadge status={sub.status} />
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
			<p class="mt-3 text-xs text-muted-foreground">
				{m['orgPublic.yourMembership.managedBy']({ org: orgName })}
			</p>
		</CardContent>
	</Card>
{/if}
