<script lang="ts">
	import type { PageData } from './$types';
	import { Card } from '$lib/components/ui/card';
	import SubmissionStatusBadge from '$lib/components/questionnaires/SubmissionStatusBadge.svelte';
	import QuestionAnswerDisplay from '$lib/components/questionnaires/QuestionAnswerDisplay.svelte';
	import AutoEvalRecommendation from '$lib/components/questionnaires/AutoEvalRecommendation.svelte';
	import EvaluationForm from '$lib/components/questionnaires/EvaluationForm.svelte';
	import { ArrowLeft, User, Mail, Calendar } from 'lucide-svelte';
	import {
		isPendingReview,
		type QuestionnaireEvaluationStatus
	} from '$lib/utils/questionnaire-types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	// Form submission state
	let isSubmitting = $state(false);

	function formatDate(dateString: string | null | undefined): string {
		if (!dateString) return 'Not submitted';
		return new Date(dateString).toLocaleString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	// Check if submission is already evaluated
	// Note: EvaluationResponseSchema doesn't have evaluated_by field, so we check status only
	let isEvaluated = $derived(
		data.submission.evaluation &&
			!isPendingReview(data.submission.evaluation.status as QuestionnaireEvaluationStatus)
	);
</script>

<svelte:head>
	<title>Review Submission - {data.submission.user_name} - {data.organizationSlug}</title>
</svelte:head>

<div class="container mx-auto max-w-5xl px-4 py-8">
	<!-- Header -->
	<div class="mb-8">
		<a
			href="/org/{data.organizationSlug}/admin/questionnaires/{data.questionnaireId}/submissions"
			class="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
		>
			<ArrowLeft class="h-4 w-4" />
			Back to Submissions
		</a>
		<div class="flex items-start justify-between gap-4">
			<div class="flex-1">
				<h1 class="text-3xl font-bold">Review Submission</h1>
				<p class="mt-2 text-muted-foreground">
					Evaluate this questionnaire response and decide whether to approve or reject
				</p>
			</div>
			<SubmissionStatusBadge
				status={(data.submission.evaluation?.status ||
					'pending review') as QuestionnaireEvaluationStatus}
				class="shrink-0"
			/>
		</div>
	</div>

	<div class="grid gap-8 lg:grid-cols-3">
		<!-- Main Content - Answers and Evaluation -->
		<div class="space-y-8 lg:col-span-2">
			<!-- Auto-Evaluation Recommendation -->
			{#if data.submission.evaluation}
				<AutoEvalRecommendation evaluation={data.submission.evaluation} />
			{/if}

			<!-- Questionnaire Answers -->
			<div>
				<h2 class="mb-4 text-2xl font-semibold">Responses</h2>
				<QuestionAnswerDisplay answers={data.submission.answers} />
			</div>

			<!-- Evaluation Form -->
			<div>
				<h2 class="mb-4 text-2xl font-semibold">
					{isEvaluated ? 'Change Evaluation' : 'Evaluate This Submission'}
				</h2>
				<EvaluationForm
					submissionId={data.submission.id}
					currentStatus={(data.submission.evaluation?.status as 'approved' | 'rejected' | 'pending review' | null) || null}
					{isSubmitting}
				/>
			</div>
		</div>

		<!-- Sidebar - Submission Details -->
		<div class="space-y-6 lg:col-span-1">
			<!-- Submitter Information -->
			<Card class="p-6">
				<h3 class="mb-4 text-lg font-semibold">Submitter Information</h3>

				<div class="space-y-4">
					<!-- Name -->
					<div class="flex items-start gap-3">
						<div
							class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10"
						>
							<User class="h-5 w-5 text-primary" aria-hidden="true" />
						</div>
						<div class="flex-1">
							<p class="text-sm font-medium text-muted-foreground">Name</p>
							<p class="text-base font-medium">{data.submission.user_name}</p>
						</div>
					</div>

					<!-- Email -->
					<div class="flex items-start gap-3">
						<div
							class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10"
						>
							<Mail class="h-5 w-5 text-primary" aria-hidden="true" />
						</div>
						<div class="flex-1">
							<p class="text-sm font-medium text-muted-foreground">Email</p>
							<p class="break-words text-base">{data.submission.user_email}</p>
						</div>
					</div>

					<!-- Submission Date -->
					<div class="flex items-start gap-3">
						<div
							class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10"
						>
							<Calendar class="h-5 w-5 text-primary" aria-hidden="true" />
						</div>
						<div class="flex-1">
							<p class="text-sm font-medium text-muted-foreground">Submitted</p>
							<p class="text-base">{formatDate(data.submission.submitted_at)}</p>
						</div>
					</div>
				</div>
			</Card>

			<!-- Questionnaire Information -->
			<Card class="p-6">
				<h3 class="mb-4 text-lg font-semibold">Questionnaire</h3>
				<div class="space-y-2">
					<p class="font-medium">{data.submission.questionnaire.name}</p>
					<div class="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
						<span>
							{data.submission.answers.length}
							{data.submission.answers.length === 1 ? 'question' : 'questions'} answered
						</span>
					</div>
				</div>
			</Card>
		</div>
	</div>
</div>
