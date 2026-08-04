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

	<!-- Stats grid. Tint recipes mirror common/ToneTile's audited pairs:
	     success is dark-enough-as-text in both modes (bg-success/10 text-success);
	     highlight needs the foreground/dark split (amber itself is ~1.9:1 on a
	     light tint); destructive needs the light/dark split the other way
	     (dark destructive is too bright a red as text on its own dark tint). -->
	<div class="grid gap-4 sm:grid-cols-4">
		<div class="rounded-lg border border-border bg-card p-4">
			<p class="text-sm font-medium text-muted-foreground">{m['attendeesAdmin.statsTotal']()}</p>
			<p class="mt-1 text-2xl font-bold">{stats.total}</p>
		</div>
		<div class="rounded-lg border border-success/30 bg-success/10 p-4">
			<p class="text-sm font-medium text-success">
				{m['attendeesAdmin.statsYes']()}
			</p>
			<p class="mt-1 text-2xl font-bold text-success">{stats.yesCount}</p>
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
			<p class="text-sm font-medium text-destructive dark:text-destructive-foreground">
				{m['attendeesAdmin.statsNo']()}
			</p>
			<p class="mt-1 text-2xl font-bold text-destructive dark:text-destructive-foreground">
				{stats.noCount}
			</p>
		</div>
	</div>
</div>
