<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Card } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { AlertCircle, CheckCircle, XCircle, Sparkles } from '@lucide/svelte';
	import { cn } from '$lib/utils/cn';
	import { formatDateLongMonth } from '$lib/utils/date';
	import type { EvaluationResponseSchema } from '$lib/api/generated';
	import type { QuestionnaireEvaluationStatus } from '$lib/utils/questionnaire-types';

	interface Props {
		evaluation: EvaluationResponseSchema | null;
	}

	const { evaluation }: Props = $props();

	// Determine if auto-evaluation is present
	const hasAutoEval = $derived(
		evaluation &&
			(evaluation.status as QuestionnaireEvaluationStatus) !== 'pending review' &&
			evaluation.evaluator_id === null // Auto-eval has no evaluator
	);

	// Tone→class quads (rebrand): replaces hand-picked yellow/green/red
	// bg+border+icon combos with token equivalents. The card-level `bgClass` is
	// a flat, mode-invariant /10 tint (only default `text-foreground` heading/
	// description sit on it, so no AA concern). The icon chip gets its own
	// `iconBgClass`/`iconClass` pair copied verbatim from `ToneTile`'s audited
	// tone table (`common/ToneTile.svelte`): `warning` has no `--warning` token,
	// so it reuses `bg-highlight/20` + `text-highlight-foreground
	// dark:text-highlight`; `danger` keeps a stronger /25 tint in dark (a /10 red
	// wash is nearly invisible on aubergine) with `text-destructive` in both
	// modes — at worst 7.20:1 light / 5.37:1 dark since the destructive token was
	// split into fill and text halves (#781); this chip renders on both --card and
	// --background surfaces and every combination is audited in
	// scripts/audit-brand-themes.py. `success` passes AA as direct icon color.
	const statusConfig = $derived.by(() => {
		if (!evaluation || (evaluation.status as QuestionnaireEvaluationStatus) === 'pending review') {
			return {
				icon: AlertCircle,
				label: 'Awaiting Review',
				description: 'This submission has not been evaluated yet.',
				bgClass: 'bg-highlight/10',
				borderClass: 'border-highlight',
				iconBgClass: 'bg-highlight/20',
				iconClass: 'text-highlight-foreground dark:text-highlight'
			};
		}

		if ((evaluation.status as QuestionnaireEvaluationStatus) === 'approved') {
			return {
				icon: CheckCircle,
				label: 'Recommended: Approve',
				description: evaluation.comments || 'This submission meets the requirements.',
				bgClass: 'bg-success/10',
				borderClass: 'border-success/50',
				iconBgClass: 'bg-success/10',
				iconClass: 'text-success'
			};
		}

		return {
			icon: XCircle,
			label: 'Recommended: Reject',
			description: evaluation.comments || 'This submission does not meet the requirements.',
			bgClass: 'bg-destructive/10',
			borderClass: 'border-destructive/50',
			iconBgClass: 'bg-destructive/10 dark:bg-destructive/25',
			iconClass: 'text-destructive'
		};
	});

	const IconComponent = $derived(statusConfig.icon);
</script>

<!--
  Auto-Evaluation Recommendation Component

  Displays the automatic evaluation result for a questionnaire submission,
  including the recommended decision (approve/reject) and the AI-generated reasoning.

  @component
  @example
  <AutoEvalRecommendation evaluation={submission.evaluation} />
-->
{#if hasAutoEval}
	<Card
		class={cn('border-2 p-6', statusConfig.bgClass, statusConfig.borderClass)}
		role="region"
		aria-label={m['autoEvalRecommendation.regionLabel']()}
	>
		<div class="flex items-start gap-4">
			<!-- Icon -->
			<div
				class={cn(
					'flex h-12 w-12 shrink-0 items-center justify-center rounded-full',
					statusConfig.iconBgClass
				)}
			>
				<IconComponent class={cn('h-6 w-6', statusConfig.iconClass)} aria-hidden="true" />
			</div>

			<!-- Content -->
			<div class="flex-1 space-y-3">
				<div class="flex items-center gap-2">
					<Sparkles class="h-4 w-4 text-primary" aria-hidden="true" />
					<Badge variant="outline" class="text-xs"
						>{m['autoEvalRecommendation.aiRecommendation']()}</Badge
					>
				</div>

				<div>
					<h3 class="text-lg font-bold">{statusConfig.label}</h3>
					<p class="mt-2 text-sm text-muted-foreground">{statusConfig.description}</p>
				</div>

				{#if evaluation && evaluation.score !== null}
					<div class="flex items-center gap-2">
						<span class="text-sm font-medium">{m['autoEvalRecommendation.score']()}</span>
						<Badge variant="secondary">{evaluation.score}/100</Badge>
					</div>
				{/if}

				<div
					class="rounded-md border border-dashed bg-background/50 p-3 text-xs text-muted-foreground"
				>
					<p>
						<strong>{m['autoEvalRecommendation.note']()}</strong>
						{m['autoEvalRecommendation.automatedNoteBody']()}
					</p>
				</div>
			</div>
		</div>
	</Card>
{:else if evaluation && evaluation.evaluator_id}
	<!-- Manual evaluation already exists -->
	<Card class="border-2 border-primary/20 bg-primary/5 p-6">
		<div class="flex items-start gap-4">
			<div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
				<IconComponent class="h-6 w-6 text-primary" aria-hidden="true" />
			</div>

			<div class="flex-1 space-y-3">
				<div>
					<h3 class="text-lg font-bold">{m['autoEvalRecommendation.alreadyEvaluated']()}</h3>
					<p class="mt-1 text-sm text-muted-foreground">
						{#if evaluation.created_at}
							{m['autoEvalRecommendation.evaluatedManuallyOn']({
								date: formatDateLongMonth(evaluation.created_at)
							})}
						{:else}
							{m['autoEvalRecommendation.evaluatedManually']()}
						{/if}
					</p>
				</div>

				<div>
					<Badge
						variant={(evaluation.status as QuestionnaireEvaluationStatus) === 'approved'
							? 'default'
							: 'destructive'}
						class="mb-2"
					>
						{(evaluation.status as QuestionnaireEvaluationStatus) === 'approved'
							? m['autoEvalRecommendation.approved']()
							: m['autoEvalRecommendation.rejected']()}
					</Badge>

					{#if evaluation.comments}
						<div class="mt-3 rounded-md bg-muted/50 p-3">
							<p class="text-sm">{evaluation.comments}</p>
						</div>
					{/if}

					{#if evaluation.score !== null}
						<div class="mt-3 flex items-center gap-2">
							<span class="text-sm font-medium">{m['autoEvalRecommendation.score']()}</span>
							<Badge variant="secondary">{evaluation.score}/100</Badge>
						</div>
					{/if}
				</div>

				<div
					class="mt-4 rounded-md border border-dashed bg-background/50 p-3 text-xs text-muted-foreground"
				>
					<p>
						<strong>{m['autoEvalRecommendation.note']()}</strong>
						{m['autoEvalRecommendation.changeEvaluationNoteBody']()}
					</p>
				</div>
			</div>
		</div>
	</Card>
{/if}
