<script lang="ts">
	import McQuestionChart from '$lib/components/questionnaires/McQuestionChart.svelte';
	import type { PollResultsSchema } from '$lib/api/generated/types.gen';

	interface Props {
		results: PollResultsSchema;
		staffAnonymous: boolean;
	}
	const { results, staffAnonymous }: Props = $props();
</script>

<div class="space-y-6">
	<p class="text-sm text-muted-foreground">
		<strong class="text-foreground">{results.total_voters}</strong>
		voters
	</p>

	{#each results.mc_question_stats ?? [] as stat (stat.question_id)}
		<McQuestionChart questionText={stat.question_text} options={stat.options} />
	{/each}

	{#if (results.free_text_responses ?? []).length > 0}
		<section class="space-y-2">
			<h3 class="text-sm font-medium">Free-text answers</h3>
			<ul class="space-y-2">
				{#each results.free_text_responses ?? [] as r, i (i)}
					<li class="rounded-md border bg-muted/30 p-3 text-sm">
						<p class="whitespace-pre-wrap">{r.answer}</p>
						<p class="mt-1 text-xs text-muted-foreground">
							{new Date(r.answered_at).toLocaleString()}
							{#if r.user_id && !staffAnonymous}
								· {r.user_id}{/if}
						</p>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</div>
