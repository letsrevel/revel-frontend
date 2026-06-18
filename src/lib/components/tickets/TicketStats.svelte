<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { AlertTriangle, TrendingUp } from 'lucide-svelte';
	import { formatMoney } from '$lib/utils/format';
	import type { EventRevenueSchema } from '$lib/api/generated/types.gen';

	interface Stats {
		total: number;
		pending: number;
		active: number;
		checkedIn: number;
		cancelled: number;
	}

	interface Props {
		stats: Stats;
		totalCount: number;
		hasMultiplePages: boolean;
		/** Whole-event revenue aggregate, or null when it failed to load. */
		revenue: EventRevenueSchema | null;
	}

	const { stats, totalCount, hasMultiplePages, revenue }: Props = $props();

	// Only currencies that actually earned something. Hides the card entirely
	// when there is no revenue yet (avoids a misleading "Free"/zero figure).
	const earned = $derived((revenue?.by_currency ?? []).filter((c) => parseFloat(c.gross) !== 0));
</script>

<div class="space-y-4">
	<!-- Whole-event revenue (NOT page-local, unlike the stat grid below) -->
	{#if earned.length > 0}
		<div class="rounded-lg border border-primary/30 bg-primary/5 p-4">
			<div class="flex items-center gap-2 text-sm font-medium text-muted-foreground">
				<TrendingUp class="h-4 w-4 text-primary" aria-hidden="true" />
				{m['eventTicketsAdmin.revenueTitle']()}
			</div>
			<div class="mt-2 flex flex-wrap gap-x-8 gap-y-3">
				{#each earned as c (c.currency)}
					<div>
						<div class="text-2xl font-bold">{formatMoney(c.gross, c.currency)}</div>
						<div class="text-xs text-muted-foreground">
							{m['eventTicketsAdmin.revenuePaidTickets']({ count: c.paid_ticket_count })}
							{#if parseFloat(c.gross) !== parseFloat(c.net)}
								· {m['eventTicketsAdmin.revenueNet']({ amount: formatMoney(c.net, c.currency) })}
								· {m['eventTicketsAdmin.revenueRefunded']({
									amount: formatMoney(c.refunded, c.currency)
								})}
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Warning for incomplete (page-local) counts -->
	{#if hasMultiplePages}
		<div
			class="flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-100"
			role="alert"
		>
			<AlertTriangle class="h-5 w-5 shrink-0" aria-hidden="true" />
			<div>
				<p class="font-medium">{m['eventTicketsAdmin.pageWarningTitle']()}</p>
				<p class="text-sm">
					{m['eventTicketsAdmin.pageWarningDescription']({ total: totalCount })}
				</p>
			</div>
		</div>
	{/if}

	<!-- Stats grid (current page only) -->
	<div class="grid gap-4 sm:grid-cols-5">
		<div class="rounded-lg border bg-card p-4">
			<div class="text-2xl font-bold">{stats.total}</div>
			<div class="text-sm text-muted-foreground">{m['eventTicketsAdmin.statsTotalPage']()}</div>
		</div>
		<div class="rounded-lg border bg-card p-4">
			<div class="text-2xl font-bold text-yellow-600">{stats.pending}</div>
			<div class="text-sm text-muted-foreground">{m['eventTicketsAdmin.statsPending']()}</div>
		</div>
		<div class="rounded-lg border bg-card p-4">
			<div class="text-2xl font-bold text-green-600">{stats.active}</div>
			<div class="text-sm text-muted-foreground">{m['eventTicketsAdmin.statsActive']()}</div>
		</div>
		<div class="rounded-lg border bg-card p-4">
			<div class="text-2xl font-bold text-blue-600">{stats.checkedIn}</div>
			<div class="text-sm text-muted-foreground">{m['eventTicketsAdmin.statsCheckedIn']()}</div>
		</div>
		<div class="rounded-lg border bg-card p-4">
			<div class="text-2xl font-bold text-red-600">{stats.cancelled}</div>
			<div class="text-sm text-muted-foreground">{m['eventTicketsAdmin.statsCancelled']()}</div>
		</div>
	</div>
</div>
