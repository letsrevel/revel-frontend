<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { PageData } from './$types';
	import { Card } from '$lib/components/ui/card';
	import SubmissionStatusBadge from '$lib/components/questionnaires/SubmissionStatusBadge.svelte';
	import QuestionAnswerDisplay from '$lib/components/questionnaires/QuestionAnswerDisplay.svelte';
	import AutoEvalRecommendation from '$lib/components/questionnaires/AutoEvalRecommendation.svelte';
	import EvaluationForm from '$lib/components/questionnaires/EvaluationForm.svelte';
	import UserAvatar from '$lib/components/common/UserAvatar.svelte';
	import { ArrowLeft, Mail, Calendar, CalendarDays, ExternalLink } from 'lucide-svelte';
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
		if (!dateString) return m['questionnaireSubmissionDetailPage.notSubmitted']();
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

	// Extract event metadata if available
	// Metadata structure: { source_event: { event_id, event_name, event_start } }
	interface SourceEventMetadata {
		event_id: string;
		event_name: string;
		event_start: string;
	}

	let eventMetadata = $derived.by(() => {
		const metadata = data.submission.metadata;
		if (metadata && metadata.source_event) {
			const sourceEvent = metadata.source_event as SourceEventMetadata;
			if (sourceEvent.event_id && sourceEvent.event_name) {
				return sourceEvent;
			}
		}
		return null;
	});

	function formatEventDate(dateString: string | undefined): string {
		if (!dateString) return '';
		try {
			return new Date(dateString).toLocaleString('en-US', {
				year: 'numeric',
				month: 'long',
				day: 'numeric',
				hour: '2-digit',
				minute: '2-digit'
			});
		} catch {
			return dateString;
		}
	}
</script>

<svelte:head>
	<title
		>{m['questionnaireSubmissionDetailPage.pageTitle']()} - {data.submission.user.display_name} - {data.organizationSlug}</title
	>
</svelte:head>

<div class="container mx-auto max-w-5xl px-4 py-8">
	<!-- Header -->
	<div class="mb-8">
		<a
			href="/org/{data.organizationSlug}/admin/questionnaires/{data.questionnaireId}/submissions"
			class="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
		>
			<ArrowLeft class="h-4 w-4" />
			{m['questionnaireSubmissionDetailPage.backToSubmissions']()}
		</a>
		<div class="flex items-start justify-between gap-4">
			<div class="flex-1">
				<h1 class="text-3xl font-bold">{m['questionnaireSubmissionDetailPage.title']()}</h1>
				<p class="mt-2 text-muted-foreground">
					{m['questionnaireSubmissionDetailPage.subtitle']()}
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
				<h2 class="mb-4 text-2xl font-semibold">
					{m['questionnaireSubmissionDetailPage.responsesTitle']()}
				</h2>
				<QuestionAnswerDisplay answers={data.submission.answers} />
			</div>

			<!-- Evaluation Form -->
			<div>
				<h2 class="mb-4 text-2xl font-semibold">
					{isEvaluated
						? m['questionnaireSubmissionDetailPage.changeEvaluationTitle']()
						: m['questionnaireSubmissionDetailPage.evaluateTitle']()}
				</h2>
				<EvaluationForm
					submissionId={data.submission.id}
					currentStatus={(data.submission.evaluation?.status as
						| 'approved'
						| 'rejected'
						| 'pending review'
						| null) || null}
					{isSubmitting}
				/>
			</div>
		</div>

		<!-- Sidebar - Submission Details -->
		<div class="space-y-6 lg:col-span-1">
			<!-- Submitter Information -->
			<Card class="p-6">
				<h3 class="mb-4 text-lg font-semibold">
					{m['questionnaireSubmissionDetailPage.submitterInfoTitle']()}
				</h3>

				<div class="space-y-4">
					<!-- Display Name with Profile Picture -->
					<div class="flex items-start gap-3">
						<UserAvatar
							profilePictureUrl={data.submission.user.profile_picture_url}
							thumbnailUrl={data.submission.user.profile_picture_thumbnail_url}
							displayName={data.submission.user.display_name}
							firstName={data.submission.user.first_name}
							lastName={data.submission.user.last_name}
							size="md"
							class="shrink-0"
							clickable={true}
						/>
						<div class="flex-1">
							<p class="text-sm font-medium text-muted-foreground">
								{m['questionnaireSubmissionDetailPage.nameLabel']()}
							</p>
							<p class="text-base font-medium">
								{data.submission.user.display_name}
								{#if data.submission.user.pronouns}
									<span class="font-normal text-muted-foreground"
										>({data.submission.user.pronouns})</span
									>
								{/if}
							</p>
						</div>
					</div>

					<!-- Full Name (if different from display name) -->
					{#if data.submission.user.first_name || data.submission.user.last_name}
						{@const fullName = [data.submission.user.first_name, data.submission.user.last_name]
							.filter(Boolean)
							.join(' ')}
						{#if fullName && fullName !== data.submission.user.display_name}
							<div class="ml-[52px]">
								<p class="text-sm text-muted-foreground">Full name</p>
								<p class="text-base">{fullName}</p>
							</div>
						{/if}
					{/if}

					<!-- Preferred Name (if different from display name) -->
					{#if data.submission.user.preferred_name && data.submission.user.preferred_name !== data.submission.user.display_name}
						<div class="ml-[52px]">
							<p class="text-sm text-muted-foreground">Preferred name</p>
							<p class="text-base">{data.submission.user.preferred_name}</p>
						</div>
					{/if}

					<!-- Email -->
					<div class="flex items-start gap-3">
						<div
							class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10"
						>
							<Mail class="h-5 w-5 text-primary" aria-hidden="true" />
						</div>
						<div class="flex-1">
							<p class="text-sm font-medium text-muted-foreground">
								{m['questionnaireSubmissionDetailPage.emailLabel']()}
							</p>
							<p class="break-words text-base">{data.submission.user.email}</p>
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
							<p class="text-sm font-medium text-muted-foreground">
								{m['questionnaireSubmissionDetailPage.submittedLabel']()}
							</p>
							<p class="text-base">{formatDate(data.submission.submitted_at)}</p>
						</div>
					</div>
				</div>
			</Card>

			<!-- Event Context (if submission was for a specific event) -->
			{#if eventMetadata}
				<Card class="p-6">
					<h3 class="mb-4 text-lg font-semibold">
						{m['questionnaireSubmissionDetailPage.eventContextTitle']?.() || 'Event Context'}
					</h3>
					<div class="space-y-4">
						<!-- Event Name -->
						<div class="flex items-start gap-3">
							<div
								class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10"
							>
								<CalendarDays class="h-5 w-5 text-primary" aria-hidden="true" />
							</div>
							<div class="flex-1">
								<p class="text-sm font-medium text-muted-foreground">
									{m['questionnaireSubmissionDetailPage.eventNameLabel']?.() || 'Event'}
								</p>
								<p class="text-base font-medium">{eventMetadata.event_name}</p>
								{#if eventMetadata.event_start}
									<p class="text-sm text-muted-foreground">
										{formatEventDate(eventMetadata.event_start)}
									</p>
								{/if}
							</div>
						</div>

						<!-- View Event Link -->
						<a
							href="/events/{eventMetadata.event_id}"
							class="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
						>
							<ExternalLink class="h-4 w-4" aria-hidden="true" />
							{m['questionnaireSubmissionDetailPage.viewEventLink']?.() || 'View event'}
						</a>
					</div>
				</Card>
			{/if}

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
