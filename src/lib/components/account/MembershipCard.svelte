<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { MyMembershipSchema } from '$lib/api/generated/types.gen';
	import { Card, CardContent } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import StatusBadge from '$lib/components/members/StatusBadge.svelte';
	import { formatPlanPrice, getDateLine } from '$lib/utils/subscriptions';

	interface Props {
		membership: MyMembershipSchema;
	}

	const { membership }: Props = $props();
	const sub = $derived(membership.subscription);
	const line = $derived(sub ? getDateLine(sub) : null);

	function fmtDate(d: string | null | undefined): string {
		return d ? new Date(d).toLocaleDateString() : '—';
	}
</script>

<Card>
	<CardContent class="p-4">
		<article aria-label={membership.organization_name}>
			<div class="flex items-start justify-between gap-3">
				<div class="min-w-0">
					<h3 class="font-semibold">{membership.organization_name}</h3>
					{#if sub}
						<p class="text-sm text-muted-foreground">
							{sub.plan.name} · {formatPlanPrice(sub.plan)}
						</p>
					{:else if membership.tier}
						<p class="text-sm text-muted-foreground">{membership.tier.name}</p>
					{/if}
				</div>
				{#if sub}
					<StatusBadge status={sub.status} />
				{:else}
					<Badge variant="secondary" class="capitalize">{membership.status}</Badge>
				{/if}
			</div>

			{#if sub && line}
				<p class="mt-2 text-sm">
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
				</p>
				{#if sub.status === 'past_due'}
					<p class="mt-1 text-xs text-muted-foreground">
						{m['account.memberships.contactOrg']()}
					</p>
				{/if}
			{:else}
				<p class="mt-2 text-sm text-muted-foreground">
					{m['account.memberships.memberSince']({ date: fmtDate(membership.member_since) })}
				</p>
			{/if}

			<div class="mt-3">
				<Button href="/org/{membership.organization_slug}" variant="outline" size="sm">
					{m['account.memberships.viewOrg']()}
				</Button>
			</div>
		</article>
	</CardContent>
</Card>
