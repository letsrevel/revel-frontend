<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import McQuestionChart from '$lib/components/questionnaires/McQuestionChart.svelte';
	import type { PollResultsSchema } from '$lib/api/generated/types.gen';

	interface Props {
		results: PollResultsSchema;
		staffAnonymous: boolean;
	}
	const { results, staffAnonymous }: Props = $props();

	const votersLabel = $derived(
		results.total_voters === 1
			? m['pollResults.totalVoters_one']({ count: String(results.total_voters) })
			: m['pollResults.totalVoters_other']({ count: String(results.total_voters) })
	);
</script>

<div class="space-y-6">
	<p class="text-sm text-muted-foreground">
		<strong class="text-foreground">{votersLabel}</strong>
	</p>

	{#each results.mc_question_stats ?? [] as stat (stat.question_id)}
		<McQuestionChart questionText={stat.question_text} options={stat.options} />
	{/each}

	{#if (results.free_text_responses ?? []).length > 0}
		<section class="space-y-2">
			<h3 class="text-sm font-medium">{m['pollResults.freeTextHeading']()}</h3>
			<ul class="space-y-2">
				{#each results.free_text_responses ?? [] as r, i (i)}
					<li class="rounded-md border bg-muted/30 p-3 text-sm">
						<p class="whitespace-pre-wrap">{r.answer}</p>
						<p class="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
							<span>{new Date(r.answered_at).toLocaleString()}</span>
							{#if !staffAnonymous && (r.user_display_name || r.user_email || r.user_id)}
								<!--
									Voter attribution. Backend ships user_display_name /
									user_email / user_id when staff_anonymous=false (all three
									null when staff_anonymous=true). Prefer display_name →
									email → truncated UUID. Email shown via `title` when we
									have a display name, so staff can disambiguate on hover.
								-->
								<span
									class="rounded bg-muted px-1.5 py-0.5 text-[11px]"
									title={r.user_email ?? r.user_id ?? undefined}
								>
									{m['pollResults.userIdLabel']()}:
									{#if r.user_display_name}
										{r.user_display_name}
									{:else if r.user_email}
										{r.user_email}
									{:else if r.user_id}
										<span class="font-mono">{r.user_id.slice(0, 8)}…</span>
									{/if}
								</span>
							{/if}
						</p>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</div>
