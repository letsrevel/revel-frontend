<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		approved: number;
		rejected: number;
		pendingReview: number;
		notEvaluated: number;
	}

	let { approved, rejected, pendingReview, notEvaluated }: Props = $props();

	let total = $derived(approved + rejected + pendingReview + notEvaluated);

	function pct(value: number): number {
		if (total === 0) return 0;
		return Math.round((value / total) * 100);
	}

	function widthPct(value: number): string {
		if (total === 0) return '0%';
		return `${(value / total) * 100}%`;
	}
</script>

<div class="space-y-3">
	<!-- Stacked bar -->
	{#if total > 0}
		<div
			class="flex h-6 w-full overflow-hidden rounded-full bg-muted"
			role="img"
			aria-label="Status breakdown: {approved} approved, {rejected} rejected, {pendingReview} pending review, {notEvaluated} not evaluated"
		>
			{#if approved > 0}
				<div
					class="flex items-center justify-center bg-green-500 text-xs font-medium text-white transition-all dark:bg-green-600"
					style="width: {widthPct(approved)}"
					aria-label="{m['questionnaireSummaryPage.approved']()}: {approved} ({pct(approved)}%)"
				>
					{#if pct(approved) >= 10}
						{pct(approved)}%
					{/if}
				</div>
			{/if}
			{#if rejected > 0}
				<div
					class="flex items-center justify-center bg-red-500 text-xs font-medium text-white transition-all dark:bg-red-600"
					style="width: {widthPct(rejected)}"
					aria-label="{m['questionnaireSummaryPage.rejected']()}: {rejected} ({pct(rejected)}%)"
				>
					{#if pct(rejected) >= 10}
						{pct(rejected)}%
					{/if}
				</div>
			{/if}
			{#if pendingReview > 0}
				<div
					class="flex items-center justify-center bg-yellow-500 text-xs font-medium text-white transition-all dark:bg-yellow-600"
					style="width: {widthPct(pendingReview)}"
					aria-label="{m['questionnaireSummaryPage.pendingReview']()}: {pendingReview} ({pct(
						pendingReview
					)}%)"
				>
					{#if pct(pendingReview) >= 10}
						{pct(pendingReview)}%
					{/if}
				</div>
			{/if}
			{#if notEvaluated > 0}
				<div
					class="flex items-center justify-center bg-gray-400 text-xs font-medium text-white transition-all dark:bg-gray-500"
					style="width: {widthPct(notEvaluated)}"
					aria-label="{m['questionnaireSummaryPage.notEvaluated']()}: {notEvaluated} ({pct(
						notEvaluated
					)}%)"
				>
					{#if pct(notEvaluated) >= 10}
						{pct(notEvaluated)}%
					{/if}
				</div>
			{/if}
		</div>
	{:else}
		<div class="flex h-6 w-full items-center justify-center rounded-full bg-muted">
			<span class="text-xs text-muted-foreground">No data</span>
		</div>
	{/if}

	<!-- Legend -->
	<div class="flex flex-wrap gap-4 text-sm">
		<div class="flex items-center gap-1.5">
			<div class="h-3 w-3 rounded-full bg-green-500 dark:bg-green-600" aria-hidden="true"></div>
			<span>{m['questionnaireSummaryPage.approved']()} ({approved})</span>
		</div>
		<div class="flex items-center gap-1.5">
			<div class="h-3 w-3 rounded-full bg-red-500 dark:bg-red-600" aria-hidden="true"></div>
			<span>{m['questionnaireSummaryPage.rejected']()} ({rejected})</span>
		</div>
		<div class="flex items-center gap-1.5">
			<div class="h-3 w-3 rounded-full bg-yellow-500 dark:bg-yellow-600" aria-hidden="true"></div>
			<span>{m['questionnaireSummaryPage.pendingReview']()} ({pendingReview})</span>
		</div>
		<div class="flex items-center gap-1.5">
			<div class="h-3 w-3 rounded-full bg-gray-400 dark:bg-gray-500" aria-hidden="true"></div>
			<span>{m['questionnaireSummaryPage.notEvaluated']()} ({notEvaluated})</span>
		</div>
	</div>
</div>
