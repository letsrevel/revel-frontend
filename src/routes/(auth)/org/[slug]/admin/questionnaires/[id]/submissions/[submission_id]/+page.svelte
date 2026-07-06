<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { PageData } from './$types';
	import { Card } from '$lib/components/ui/card';
	import SubmissionStatusBadge from '$lib/components/questionnaires/SubmissionStatusBadge.svelte';
	import QuestionAnswerDisplay from '$lib/components/questionnaires/QuestionAnswerDisplay.svelte';
	import AutoEvalRecommendation from '$lib/components/questionnaires/AutoEvalRecommendation.svelte';
	import EvaluationForm from '$lib/components/questionnaires/EvaluationForm.svelte';
	import UserAvatar from '$lib/components/common/UserAvatar.svelte';
	import {
		ArrowLeft,
		ChevronLeft,
		ChevronRight,
		Mail,
		Calendar,
		CalendarDays,
		ExternalLink,
		Info
	} from '@lucide/svelte';
	import {
		isPendingReview,
		type QuestionnaireEvaluationStatus
	} from '$lib/utils/questionnaire-types';
	import { resolveSubmissionBadgeStatus } from '$lib/utils/resolve-submission-badge-status';
	import { formatDateTimeVerbose } from '$lib/utils/date';

	interface Props {
		data: PageData;
	}

	const { data }: Props = $props();

	// Form submission state
	const isSubmitting = $state(false);

	// Submission list navigation (Next/Previous), preserving filter/sort context
	const submissionsBasePath = $derived(
		`/org/${data.organizationSlug}/admin/questionnaires/${data.questionnaireId}/submissions`
	);
	const contextQuery = $derived(
		data.navigation?.contextQuery ? `?${data.navigation.contextQuery}` : ''
	);
	const previousHref = $derived(
		data.navigation?.previousId
			? `${submissionsBasePath}/${data.navigation.previousId}${contextQuery}`
			: null
	);
	const nextHref = $derived(
		data.navigation?.nextId
			? `${submissionsBasePath}/${data.navigation.nextId}${contextQuery}`
			: null
	);

	function formatDate(dateString: string | null | undefined): string {
		if (!dateString) return m['questionnaireSubmissionDetailPage.notSubmitted']();
		return formatDateTimeVerbose(dateString);
	}

	// Check if submission is already evaluated
	// Note: EvaluationResponseSchema doesn't have evaluated_by field, so we check status only
	const isEvaluated = $derived(
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

	const eventMetadata = $derived.by(() => {
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
			return formatDateTimeVerbose(dateString);
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

<!-- Next/Previous navigation through the (filtered) submission list; rendered at
	 the top and again below the evaluation form so reviewers can advance without
	 scrolling back up after approving/rejecting. -->
{#snippet submissionNav()}
	{#if previousHref || nextHref}
		<nav
			class="flex items-center gap-1"
			aria-label={m['questionnaireSubmissionDetailPage.navLabel']()}
		>
			{#if previousHref}
				<a
					href={previousHref}
					class="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				>
					<ChevronLeft class="h-4 w-4" aria-hidden="true" />
					{m['questionnaireSubmissionDetailPage.previous']()}
				</a>
			{:else}
				<span
					class="inline-flex cursor-not-allowed items-center gap-1 rounded-md border px-3 py-1.5 text-sm font-medium text-muted-foreground opacity-50"
					aria-disabled="true"
				>
					<ChevronLeft class="h-4 w-4" aria-hidden="true" />
					{m['questionnaireSubmissionDetailPage.previous']()}
				</span>
			{/if}

			{#if data.navigation?.position}
				<span class="px-2 text-sm text-muted-foreground">
					{m['questionnaireSubmissionDetailPage.positionLabel']({
						current: data.navigation.position,
						total: data.navigation.total
					})}
				</span>
			{/if}

			{#if nextHref}
				<a
					href={nextHref}
					class="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				>
					{m['questionnaireSubmissionDetailPage.next']()}
					<ChevronRight class="h-4 w-4" aria-hidden="true" />
				</a>
			{:else}
				<span
					class="inline-flex cursor-not-allowed items-center gap-1 rounded-md border px-3 py-1.5 text-sm font-medium text-muted-foreground opacity-50"
					aria-disabled="true"
				>
					{m['questionnaireSubmissionDetailPage.next']()}
					<ChevronRight class="h-4 w-4" aria-hidden="true" />
				</span>
			{/if}
		</nav>
	{/if}
{/snippet}

<div class="container mx-auto max-w-5xl px-4 py-8">
	<!-- Header -->
	<div class="mb-8">
		<div class="mb-4 flex flex-wrap items-center justify-between gap-3">
			<a
				href="{submissionsBasePath}{contextQuery}"
				class="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
			>
				<ArrowLeft class="h-4 w-4" />
				{m['questionnaireSubmissionDetailPage.backToSubmissions']()}
			</a>

			{@render submissionNav()}
		</div>
		<div class="flex items-start justify-between gap-4">
			<div class="flex-1">
				<h1 class="text-3xl font-bold">{m['questionnaireSubmissionDetailPage.title']()}</h1>
				<p class="mt-2 text-muted-foreground">
					{m['questionnaireSubmissionDetailPage.subtitle']()}
				</p>
			</div>
			<SubmissionStatusBadge
				status={resolveSubmissionBadgeStatus(
					data.requiresEvaluation,
					data.submission.evaluation?.status
				)}
				class="shrink-0"
			/>
		</div>
	</div>

	<div class="grid gap-8 lg:grid-cols-3">
		<!-- Main Content - Answers and Evaluation -->
		<div class="space-y-8 lg:col-span-2">
			{#if !data.requiresEvaluation}
				<!-- No evaluation required banner -->
				<div
					class="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950"
				>
					<Info class="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
					<p class="text-sm text-blue-800 dark:text-blue-200">
						{m['questionnaireSubmissionDetailPage.noEvaluationRequired']()}
					</p>
				</div>
			{:else}
				<!-- Auto-Evaluation Recommendation -->
				{#if data.submission.evaluation}
					<AutoEvalRecommendation evaluation={data.submission.evaluation} />
				{/if}
			{/if}

			<!-- Questionnaire Answers -->
			<div>
				<h2 class="mb-4 text-2xl font-semibold">
					{m['questionnaireSubmissionDetailPage.responsesTitle']()}
				</h2>
				<QuestionAnswerDisplay answers={data.submission.answers} />
			</div>

			{#if data.requiresEvaluation}
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
						returnQuery={data.navigation?.contextQuery ?? ''}
						{isSubmitting}
					/>
				</div>
			{/if}

			<!-- Repeat the Next/Previous nav at the bottom so reviewers can advance
				 straight after approving/rejecting, without scrolling back up. -->
			{#if previousHref || nextHref}
				<div class="flex justify-end border-t pt-6">
					{@render submissionNav()}
				</div>
			{/if}
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
							previewUrl={data.submission.user.profile_picture_preview_url}
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
								<p class="text-sm text-muted-foreground">
									{m['questionnaireSubmissionDetailPage.fullNameLabel']()}
								</p>
								<p class="text-base">{fullName}</p>
							</div>
						{/if}
					{/if}

					<!-- Preferred Name (if different from display name) -->
					{#if data.submission.user.preferred_name && data.submission.user.preferred_name !== data.submission.user.display_name}
						<div class="ml-[52px]">
							<p class="text-sm text-muted-foreground">
								{m['questionnaireSubmissionDetailPage.preferredNameLabel']()}
							</p>
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
				<h3 class="mb-4 text-lg font-semibold">
					{m['questionnaireSubmissionDetailPage.questionnaireTitle']()}
				</h3>
				<div class="space-y-2">
					<p class="font-medium">{data.submission.questionnaire.name}</p>
					<div class="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
						<span>
							{data.submission.answers.length === 1
								? m['questionnaireSubmissionDetailPage.questionsAnswered']({
										count: data.submission.answers.length
									})
								: m['questionnaireSubmissionDetailPage.questionsAnsweredPlural']({
										count: data.submission.answers.length
									})}
						</span>
					</div>
				</div>
			</Card>
		</div>
	</div>
</div>
