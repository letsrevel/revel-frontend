<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Check } from '@lucide/svelte';

	interface OptionStat {
		option_id: string;
		option_text: string;
		is_correct: boolean;
		count: number;
	}

	interface Props {
		questionText: string;
		options: OptionStat[];
	}

	const { questionText, options }: Props = $props();

	const totalResponses = $derived(options.reduce((sum, o) => sum + o.count, 0));

	function pct(count: number): string {
		if (totalResponses === 0) return '0%';
		return `${Math.round((count / totalResponses) * 100)}%`;
	}

	// Bar length = share of all responses, the same figure the % label shows
	// (scaling to the top answer drew a 30% answer as a 75%-wide bar).
	function barWidth(count: number): string {
		if (totalResponses === 0) return '0%';
		return `${(count / totalResponses) * 100}%`;
	}

	// Count-aware "{n} response(s)" — paraglide _one/_other isn't auto-selected
	// here, so pick the variant explicitly (matches the PollResultsView pattern).
	function responsesLabel(count: number): string {
		return count === 1
			? m['questionnaireSummaryPage.responses_one']({ count: String(count) })
			: m['questionnaireSummaryPage.responses_other']({ count: String(count) });
	}
</script>

<div class="space-y-3">
	<h4 class="text-sm font-medium">{questionText}</h4>
	<div class="space-y-2">
		{#each options as option (option.option_id)}
			<div class="space-y-1">
				<div class="flex items-center justify-between text-sm">
					<span class="flex items-center gap-1.5 truncate" title={option.option_text}>
						{#if option.is_correct}
							<Check class="h-3.5 w-3.5 flex-shrink-0 text-success" aria-hidden="true" />
							<span class="sr-only">({m['questionnaireSummaryPage.correct']()})</span>
						{/if}
						<span class="truncate">{option.option_text}</span>
					</span>
					<span class="ml-2 flex-shrink-0 text-muted-foreground">
						{option.count} ({pct(option.count)})
					</span>
				</div>
				<div class="h-4 w-full overflow-hidden rounded bg-muted">
					<div
						class="h-full rounded transition-all {option.is_correct
							? 'bg-success'
							: 'bg-primary/60'}"
						style="width: {barWidth(option.count)}"
						role="img"
						aria-label="{option.option_text}: {responsesLabel(option.count)} ({pct(option.count)})"
					></div>
				</div>
			</div>
		{/each}
	</div>
	<p class="text-xs text-muted-foreground">
		{responsesLabel(totalResponses)}
	</p>
</div>
