<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { AlertTriangle } from '@lucide/svelte';

	interface Stats {
		yesCount: number;
		maybeCount: number;
		noCount: number;
		total: number;
	}

	interface Props {
		stats: Stats;
		totalCount: number;
		hasMultiplePages: boolean;
	}

	const { stats, totalCount, hasMultiplePages }: Props = $props();
</script>

<div class="space-y-4">
	<!-- Warning for incomplete data -->
	{#if hasMultiplePages}
		<div
			class="flex items-start gap-2 rounded-lg border border-highlight bg-highlight/10 p-3 text-sm"
			role="alert"
		>
			<AlertTriangle
				class="mt-0.5 h-5 w-5 shrink-0 text-highlight-foreground dark:text-highlight"
				aria-hidden="true"
			/>
			<div>
				<p class="font-medium">{m['attendeesAdmin.warningIncompleteData']()}</p>
				<p class="text-muted-foreground">
					{m['attendeesAdmin.warningTotalRsvps']({ total: totalCount })}
				</p>
			</div>
		</div>
	{/if}

	<!-- Stats grid. Tint recipes mirror common/ToneTile's audited pairs; all
	     three are COMPOSITED_PAIRS entries in scripts/audit-brand-themes.py
	     (issue #783), so the ratios below are printed, not asserted by hand.
	     Text-vs-composited-tint, light / dark:
	       success  4.39 (FAILS 4.5, bare bg-success/10 over --background) /
	                8.71 — light needs an opaque bg-card layer under the tint
	                to reach 4.93; dark already clears the bar unaided.
	       highlight (text-highlight-foreground light / text-highlight dark)
	                13.27 / 8.40 — clears both, no split needed beyond the
	                existing foreground/dark swap.
	       destructive 7.20 / 5.84 — `text-destructive` in both modes now that
	                the token is split (issue #781); the dark row keeps the /25
	                tint but no longer whites out the copy. -->
	<div class="grid gap-4 sm:grid-cols-4">
		<div class="rounded-lg border border-border bg-card p-4">
			<p class="text-sm font-medium text-muted-foreground">{m['attendeesAdmin.statsTotal']()}</p>
			<p class="mt-1 text-2xl font-bold">{stats.total}</p>
		</div>
		<div class="relative overflow-hidden rounded-lg border border-success/30 bg-card p-4">
			<div class="absolute inset-0 bg-success/10" aria-hidden="true"></div>
			<p class="relative text-sm font-medium text-success">
				{m['attendeesAdmin.statsYes']()}
			</p>
			<p class="relative mt-1 text-2xl font-bold text-success">{stats.yesCount}</p>
		</div>
		<div class="rounded-lg border border-highlight/50 bg-highlight/10 p-4">
			<p class="text-sm font-medium text-highlight-foreground dark:text-highlight">
				{m['attendeesAdmin.statsMaybe']()}
			</p>
			<p class="mt-1 text-2xl font-bold text-highlight-foreground dark:text-highlight">
				{stats.maybeCount}
			</p>
		</div>
		<div
			class="rounded-lg border border-destructive/30 bg-destructive/10 p-4 dark:bg-destructive/25"
		>
			<p class="text-sm font-medium text-destructive">
				{m['attendeesAdmin.statsNo']()}
			</p>
			<p class="mt-1 text-2xl font-bold text-destructive">
				{stats.noCount}
			</p>
		</div>
	</div>
</div>
