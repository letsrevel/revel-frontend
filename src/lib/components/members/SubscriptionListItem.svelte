<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { SubscriptionSchema } from '$lib/api/generated/types.gen';
	import StatusBadge from './StatusBadge.svelte';
	import { formatPlanPrice } from '$lib/utils/subscriptions';

	interface Props {
		sub: SubscriptionSchema;
		tierName?: string | null;
		onClick: () => void;
	}

	const { sub, tierName = null, onClick }: Props = $props();

	function fmtDate(d: string | null | undefined): string {
		if (!d) return '—';
		return new Date(d).toLocaleDateString();
	}
</script>

<!-- Desktop row -->
<tr
	class="hidden cursor-pointer hover:bg-accent focus-visible:bg-accent focus-visible:outline-none md:table-row"
	tabindex="0"
	role="button"
	aria-label={m['orgAdmin.members.subscriptions.openDrawer']()}
	onclick={onClick}
	onkeydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			onClick();
		}
	}}
>
	<td class="px-3 py-2">
		<div class="font-medium">{sub.user_display_name}</div>
		<div class="text-xs text-muted-foreground">{sub.user_email}</div>
	</td>
	<td class="px-3 py-2 text-sm">{tierName ?? '—'}</td>
	<td class="px-3 py-2">
		<div>{sub.plan.name}</div>
		<div class="text-xs text-muted-foreground">{formatPlanPrice(sub.plan)}</div>
	</td>
	<td class="px-3 py-2"><StatusBadge status={sub.status} /></td>
	<td class="px-3 py-2 text-sm">{fmtDate(sub.current_period_end)}</td>
</tr>

<!-- Mobile card -->
<button
	type="button"
	class="block w-full rounded-lg border p-3 text-left hover:bg-accent md:hidden"
	onclick={onClick}
>
	<div class="flex items-start justify-between gap-2">
		<div>
			<div class="font-medium">{sub.user_display_name}</div>
			<div class="text-xs text-muted-foreground">{sub.user_email}</div>
		</div>
		<StatusBadge status={sub.status} />
	</div>
	<div class="mt-2 text-sm">
		{#if tierName}<span class="text-muted-foreground">{tierName} · </span>{/if}{sub.plan.name} · {formatPlanPrice(
			sub.plan
		)}
	</div>
	<div class="mt-1 text-xs text-muted-foreground">
		{m['orgAdmin.members.subscriptions.col.periodEnd']()}: {fmtDate(sub.current_period_end)}
	</div>
</button>
