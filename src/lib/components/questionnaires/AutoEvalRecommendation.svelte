<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Card } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { AlertCircle, CheckCircle, XCircle, Sparkles } from 'lucide-svelte';
	import { cn } from '$lib/utils/cn';
	import type { EvaluationResponseSchema } from '$lib/api/generated';
	import type { QuestionnaireEvaluationStatus } from '$lib/utils/questionnaire-types';

	interface Props {
		evaluation: EvaluationResponseSchema | null;
	}

	let { evaluation }: Props = $props();

	// Determine if auto-evaluation is present
	let hasAutoEval = $derived(
		evaluation &&
			(evaluation.status as QuestionnaireEvaluationStatus) !== 'pending review' &&
			evaluation.evaluator_id === null // Auto-eval has no evaluator
	);

	let statusConfig = $derived.by(() => {
		if (!evaluation || (evaluation.status as QuestionnaireEvaluationStatus) === 'pending review') {
			return {
				icon: AlertCircle,
				label: 'Awaiting Review',
				description: 'This submission has not been evaluated yet.',
				bgClass: 'bg-yellow-50 dark:bg-yellow-950/20',
				borderClass: 'border-yellow-200 dark:border-yellow-800',
				iconClass: 'text-yellow-700 dark:text-yellow-400'
			};
		}

		if ((evaluation.status as QuestionnaireEvaluationStatus) === 'approved') {
			return {
				icon: CheckCircle,
				label: 'Recommended: Approve',
				description: evaluation.comments || 'This submission meets the requirements.',
				bgClass: 'bg-green-50 dark:bg-green-950/20',
				borderClass: 'border-green-200 dark:border-green-800',
				iconClass: 'text-green-700 dark:text-green-400'
			};
		}

		return {
			icon: XCircle,
			label: 'Recommended: Reject',
			description: evaluation.comments || 'This submission does not meet the requirements.',
			bgClass: 'bg-red-50 dark:bg-red-950/20',
			borderClass: 'border-red-200 dark:border-red-800',
			iconClass: 'text-red-700 dark:text-red-400'
		};
	});

	let IconComponent = $derived(statusConfig.icon);
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
		aria-label="Automatic evaluation recommendation"
	>
		<div class="flex items-start gap-4">
			<!-- Icon -->
			<div
				class={cn(
					'flex h-12 w-12 shrink-0 items-center justify-center rounded-full',
					statusConfig.bgClass
				)}
			>
				<IconComponent class={cn('h-6 w-6', statusConfig.iconClass)} aria-hidden="true" />
			</div>

			<!-- Content -->
			<div class="flex-1 space-y-3">
				<div class="flex items-center gap-2">
					<Sparkles class="h-4 w-4 text-purple-500" aria-hidden="true" />
					<Badge variant="outline" class="text-xs">{m['autoEvalRecommendation.aiRecommendation']()}</Badge>
				</div>

				<div>
					<h3 class="text-lg font-semibold">{statusConfig.label}</h3>
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
						<strong>{m['autoEvalRecommendation.note']()}</strong> This is an automated recommendation. Please review the submission
						manually and use your best judgment. You can approve, reject, or change this evaluation at
						any time.
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
					<h3 class="text-lg font-semibold">{m['autoEvalRecommendation.alreadyEvaluated']()}</h3>
					<p class="mt-1 text-sm text-muted-foreground">
						Evaluated manually
						{#if evaluation.created_at}
							on {new Date(evaluation.created_at).toLocaleDateString('en-US', {
								year: 'numeric',
								month: 'long',
								day: 'numeric'
							})}
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
							? 'Approved'
							: 'Rejected'}
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
						<strong>{m['autoEvalRecommendation.note']()}</strong> You can change this evaluation at any time using the form below.
					</p>
				</div>
			</div>
		</div>
	</Card>
{/if}
