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

<!--
	Voter-attribution pill. Backend ships user_display_name / user_email /
	user_id when staff_anonymous=false (all null when staff_anonymous=true).
	Prefer display_name → email → truncated UUID; email/full-id in `title` for
	hover disambiguation. Used for both MC per-option voters and free-text
	answers, which share the same user_* shape.
-->
{#snippet voterPill(
	displayName: string | null | undefined,
	email: string | null | undefined,
	userId: string | null | undefined
)}
	<span class="rounded bg-muted px-1.5 py-0.5 text-[11px]" title={email ?? userId ?? undefined}>
		{#if displayName}
			{displayName}
		{:else if email}
			{email}
		{:else if userId}
			<span class="font-mono">{userId.slice(0, 8)}…</span>
		{/if}
	</span>
{/snippet}

<div class="space-y-6">
	<p class="text-sm text-muted-foreground">
		<strong class="text-foreground">{votersLabel}</strong>
	</p>

	{#each results.mc_question_stats ?? [] as stat (stat.question_id)}
		<div class="space-y-2">
			<McQuestionChart questionText={stat.question_text} options={stat.options} />

			<!--
				Per-option voter breakdown — only present when staff_anonymous=false
				(the backend leaves `voters` null otherwise). Lists who picked each
				option beneath the aggregate chart.
			-->
			{#if !staffAnonymous && stat.options.some((o) => o.voters && o.voters.length > 0)}
				<ul class="space-y-1 pl-1 text-xs text-muted-foreground">
					{#each stat.options as opt (opt.option_id)}
						{#if opt.voters && opt.voters.length > 0}
							<li class="flex flex-wrap items-center gap-x-2 gap-y-1">
								<span class="font-medium text-foreground">{opt.option_text}:</span>
								{#each opt.voters as voter (voter.user_id)}
									{@render voterPill(voter.user_display_name, voter.user_email, voter.user_id)}
								{/each}
							</li>
						{/if}
					{/each}
				</ul>
			{/if}
		</div>
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
								{@render voterPill(r.user_display_name, r.user_email, r.user_id)}
							{/if}
						</p>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</div>
