<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';

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
			class="flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-100"
			role="alert"
		>
			<svg class="h-5 w-5 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
				<path
					fill-rule="evenodd"
					d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
					clip-rule="evenodd"
				/>
			</svg>
			<div class="text-sm">
				<p class="font-medium">{m['attendeesAdmin.warningIncompleteData']()}</p>
				<p>{m['attendeesAdmin.warningTotalRsvps']({ total: totalCount })}</p>
			</div>
		</div>
	{/if}

	<!-- Stats grid -->
	<div class="grid gap-4 sm:grid-cols-4">
		<div class="rounded-lg border border-border bg-card p-4">
			<p class="text-sm font-medium text-muted-foreground">{m['attendeesAdmin.statsTotal']()}</p>
			<p class="mt-1 text-2xl font-bold">{stats.total}</p>
		</div>
		<div
			class="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950"
		>
			<p class="text-sm font-medium text-green-700 dark:text-green-300">
				{m['attendeesAdmin.statsYes']()}
			</p>
			<p class="mt-1 text-2xl font-bold text-green-900 dark:text-green-100">{stats.yesCount}</p>
		</div>
		<div
			class="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-950"
		>
			<p class="text-sm font-medium text-yellow-700 dark:text-yellow-300">
				{m['attendeesAdmin.statsMaybe']()}
			</p>
			<p class="mt-1 text-2xl font-bold text-yellow-900 dark:text-yellow-100">
				{stats.maybeCount}
			</p>
		</div>
		<div class="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950">
			<p class="text-sm font-medium text-red-700 dark:text-red-300">
				{m['attendeesAdmin.statsNo']()}
			</p>
			<p class="mt-1 text-2xl font-bold text-red-900 dark:text-red-100">{stats.noCount}</p>
		</div>
	</div>
</div>
