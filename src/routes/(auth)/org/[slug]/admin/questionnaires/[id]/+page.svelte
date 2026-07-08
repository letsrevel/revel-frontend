<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent } from '$lib/components/ui/card';
	import { ArrowLeft, FileEdit, Pencil } from '@lucide/svelte';
	import QuestionnaireAssignmentModal from '$lib/components/questionnaires/QuestionnaireAssignmentModal.svelte';
	import DuplicateQuestionnaireModal from '$lib/components/questionnaires/DuplicateQuestionnaireModal.svelte';
	import QuestionnaireStatusBar from '$lib/components/questionnaires/QuestionnaireStatusBar.svelte';
	import QuestionnaireFormFields from '$lib/components/questionnaires/QuestionnaireFormFields.svelte';
	import QuestionnaireEditAssignments from '$lib/components/questionnaires/QuestionnaireEditAssignments.svelte';
	import QuestionnaireEditQuestionsCard from '$lib/components/questionnaires/QuestionnaireEditQuestionsCard.svelte';
	import { questionnaireUpdateQuestionnaireStatus } from '$lib/api/generated/sdk.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import type { PageData } from './$types';
	import type {
		QuestionnaireEvaluationMode,
		QuestionnaireStatus
	} from '$lib/api/generated/types.gen';
	import { QuestionnaireBuilder } from '$lib/utils/questionnaire-builder.svelte';
	import {
		initializeFromApiData,
		saveQuestionnaireIncremental
	} from '$lib/utils/questionnaire-api-sync';

	interface Props {
		data: PageData;
	}

	const { data }: Props = $props();

	// ===== Load and Convert Data =====

	const questionnaire = $derived(data.questionnaire);
	const isLoaded = $derived(!!questionnaire?.questionnaire);
	const q = $derived(questionnaire?.questionnaire);

	// Initialize local state from API data
	function initializeFromApi() {
		if (!questionnaire || !q) return;

		const result = initializeFromApiData(questionnaire, q);
		name = result.name;
		questionnaireType = result.questionnaireType;
		minScore = result.minScore;
		evaluationMode = result.evaluationMode as QuestionnaireEvaluationMode;
		shuffleQuestions = result.shuffleQuestions;
		shuffleSections = result.shuffleSections;
		llmGuidelines = result.llmGuidelines;
		canRetakeAfter = result.canRetakeAfter;
		maxAttempts = result.maxAttempts;
		membersExempt = result.membersExempt;
		perEvent = result.perEvent;
		requiresEvaluation = result.requiresEvaluation;
		maxSubmissionAge = result.maxSubmissionAge;
		builder.topLevelQuestions = result.topLevelQuestions;
		builder.sections = result.sections;

		// Mark as initialized
		isInitialized = true;
	}

	// ===== Form State (local editing) =====

	let isInitialized = $state(false);
	let name = $state('');
	let questionnaireType = $state<'admission' | 'membership' | 'feedback' | 'generic'>('admission');
	let minScore = $state(0);
	let evaluationMode = $state<QuestionnaireEvaluationMode>('automatic');
	let shuffleQuestions = $state(false);
	let shuffleSections = $state(false);
	let llmGuidelines = $state('');
	let maxSubmissionAge = $state<number | null>(null);
	let canRetakeAfter = $state<number | null>(null);
	let maxAttempts = $state(0);
	let membersExempt = $state(false);
	let perEvent = $state(false);
	let requiresEvaluation = $state(true);

	// Feedback type forces evaluation off; derive the effective value for the payload/UI
	const effectiveRequiresEvaluation = $derived(
		questionnaireType === 'feedback' ? false : requiresEvaluation
	);

	// LLM guidelines are only relevant for hybrid/automatic evaluation
	const showLlmGuidelines = $derived(effectiveRequiresEvaluation && evaluationMode !== 'manual');

	// Reactive questions/sections model (same as create page)
	const builder = new QuestionnaireBuilder();

	// Initialize when data loads
	$effect(() => {
		if (isLoaded && !isInitialized) {
			initializeFromApi();
		}
	});

	// Form validation
	let errors = $state<{ name?: string; questions?: string }>({});

	// Saving state
	let isSaving = $state(false);
	let saveError = $state<string | null>(null);

	// Status change state
	let isChangingStatus = $state(false);

	// Assignment modal state
	let isAssignmentModalOpen = $state(false);

	// Duplicate modal state
	let isDuplicateModalOpen = $state(false);

	// Edit mode state - user must explicitly enable editing
	// This protects against accidental modifications while still allowing edits to any questionnaire
	let isEditMode = $state(false);

	// Derived helper for UI - combines edit mode with data availability
	const canEdit = $derived(isEditMode && isLoaded);

	// Current status
	const currentStatus = $derived<QuestionnaireStatus>(
		(q?.status as QuestionnaireStatus) ?? 'draft'
	);

	// ===== Validation =====

	function validate(): boolean {
		errors = {};

		if (!name.trim()) {
			errors.name = m['questionnaireEditPage.basicInfo.nameRequired']();
		}

		if (builder.totalQuestionCount === 0) {
			errors.questions = m['questionnaireEditPage.error_noQuestions']();
		}

		const invalidQuestions = builder.allQuestions.filter((q) => !q.text.trim());
		if (invalidQuestions.length > 0) {
			errors.questions = m['questionnaireEditPage.error_questionsNeedText']();
		}

		return Object.keys(errors).length === 0;
	}

	// ===== Status Management =====

	function getOrgQuestionnaireId(): string {
		if (!questionnaire?.id) throw new Error('Questionnaire not loaded');
		return questionnaire.id;
	}

	async function changeStatus(newStatus: QuestionnaireStatus) {
		const confirmMessages: Record<QuestionnaireStatus, string> = {
			draft: m['questionnaireEditPage.status.publishConfirmDraft'](),
			ready: m['questionnaireEditPage.status.publishConfirmReady'](),
			published: m['questionnaireEditPage.status.publishConfirmPublished']()
		};
		const confirmed = confirm(confirmMessages[newStatus]);

		if (!confirmed) return;

		isChangingStatus = true;

		try {
			const accessToken = authStore.accessToken;
			if (!accessToken) {
				throw new Error(m['questionnaireEditPage.error_notAuthenticated']());
			}

			const response = await questionnaireUpdateQuestionnaireStatus({
				path: {
					org_questionnaire_id: getOrgQuestionnaireId(),
					status: newStatus
				},
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error(m['questionnaireEditPage.error_statusChangeFailed']());
			}

			await invalidateAll();
		} catch (err) {
			console.error('Failed to change status:', err);
			alert(m['questionnaireEditPage.error_statusChangeFailedMessage']());
		} finally {
			isChangingStatus = false;
		}
	}

	// ===== Save Logic =====

	async function saveQuestionnaire() {
		saveError = null;

		if (!validate()) {
			return;
		}

		isSaving = true;

		try {
			const accessToken = authStore.accessToken;
			if (!accessToken) {
				throw new Error(m['questionnaireEditPage.error_notAuthenticated']());
			}

			const orgQuestionnaireId = getOrgQuestionnaireId();
			const authHeader = { Authorization: `Bearer ${accessToken}` };

			await saveQuestionnaireIncremental({
				orgQuestionnaireId,
				authHeader,
				q,
				name,
				minScore,
				evaluationMode,
				questionnaireType,
				maxSubmissionAge,
				shuffleQuestions,
				shuffleSections,
				llmGuidelines,
				canRetakeAfter,
				maxAttempts,
				membersExempt,
				perEvent,
				requiresEvaluation: effectiveRequiresEvaluation,
				topLevelQuestions: builder.topLevelQuestions,
				sections: builder.sections
			});

			// Refresh data, re-initialize state from API, and exit edit mode (stay on same page)
			await invalidateAll();
			initializeFromApi(); // Explicitly re-init with fresh data (avoids race with $effect)
			isEditMode = false;

			// Scroll to top so user sees the updated questionnaire
			window.scrollTo({ top: 0, behavior: 'smooth' });
		} catch (err) {
			console.error('Failed to save questionnaire:', err);
			saveError = m['questionnaireEditPage.error_saveFailed']();
		} finally {
			isSaving = false;
		}
	}
</script>

<svelte:head>
	<title>{m['questionnaireEditPage.pageTitle']()} - {q?.name ?? ''}</title>
</svelte:head>

{#if !isLoaded}
	<div class="flex min-h-[50vh] items-center justify-center">
		<div class="text-center">
			<div
				class="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
			></div>
			<p class="mt-4 text-muted-foreground">{m['questionnaireEditPage.loading']()}</p>
		</div>
	</div>
{:else}
	<!-- Header -->
	<div class="mb-6">
		<Button
			href="/org/{data.organizationSlug}/admin/questionnaires"
			variant="ghost"
			size="sm"
			class="mb-4 gap-2"
		>
			<ArrowLeft class="h-4 w-4" />
			{m['questionnaireEditPage.backButton']()}
		</Button>

		<div class="flex items-center justify-between">
			<div>
				<h1 class="text-3xl font-bold tracking-tight">{m['questionnaireEditPage.title']()}</h1>
				<p class="mt-2 text-sm text-muted-foreground">{m['questionnaireEditPage.subtitle']()}</p>
			</div>
			<div class="flex gap-2">
				<Button variant="outline" size="sm" onclick={() => (isDuplicateModalOpen = true)}>
					{m['questionnaireEditPage.duplicate']()}
				</Button>
				<Button
					href="/org/{data.organizationSlug}/admin/questionnaires/{data.questionnaire?.id}/summary"
					variant="outline"
					size="sm"
				>
					{m['questionnaireEditPage.viewSummary']()}
				</Button>
			</div>
		</div>
	</div>

	<!-- Status Management -->
	<QuestionnaireStatusBar {currentStatus} {isChangingStatus} onChangeStatus={changeStatus} />

	<!-- Info Banner -->
	{#if isEditMode}
		<div
			class="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950"
		>
			<div class="flex items-start justify-between gap-3">
				<div class="flex gap-3">
					<Pencil class="h-5 w-5 flex-shrink-0 text-green-600 dark:text-green-500" />
					<div class="text-sm">
						<p class="font-medium text-green-800 dark:text-green-200">
							{m['questionnaireEditPage.editModeEnabled']()}
						</p>
						<p class="mt-1 text-green-700 dark:text-green-300">
							{m['questionnaireEditPage.editModeDescription']()}
						</p>
					</div>
				</div>
				<div class="flex shrink-0 gap-2">
					<Button variant="outline" size="sm" onclick={() => (isEditMode = false)}>
						{m['questionnaireEditPage.cancelEditing']()}
					</Button>
					<Button size="sm" onclick={saveQuestionnaire} disabled={isSaving || !canEdit}>
						{isSaving
							? m['questionnaireEditPage.savingButton']()
							: m['questionnaireEditPage.saveButton']()}
					</Button>
				</div>
			</div>
		</div>
	{:else}
		<div
			class="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950"
		>
			<div class="flex items-start justify-between gap-3">
				<div class="flex gap-3">
					<FileEdit class="h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-500" />
					<div class="text-sm">
						<p class="font-medium text-blue-800 dark:text-blue-200">
							{m['questionnaireEditPage.viewMode']()}
						</p>
						<p class="mt-1 text-blue-700 dark:text-blue-300">
							{m['questionnaireEditPage.viewModeDescription']()}
						</p>
					</div>
				</div>
				<Button
					variant="default"
					size="sm"
					onclick={() => (isEditMode = true)}
					class="shrink-0 gap-2"
				>
					<Pencil class="h-4 w-4" />
					{m['questionnaireEditPage.editQuestionnaire']()}
				</Button>
			</div>
		</div>
	{/if}

	<!-- Form -->
	<div class="mx-auto max-w-4xl space-y-6">
		<!-- Basic Information & Advanced Settings -->
		<QuestionnaireFormFields
			{name}
			{questionnaireType}
			{requiresEvaluation}
			{effectiveRequiresEvaluation}
			{minScore}
			{evaluationMode}
			{shuffleQuestions}
			{shuffleSections}
			{membersExempt}
			{perEvent}
			{llmGuidelines}
			{maxSubmissionAge}
			{canRetakeAfter}
			{maxAttempts}
			{canEdit}
			nameError={errors.name}
			onNameChange={(v) => (name = v)}
			onQuestionnaireTypeChange={(v) => (questionnaireType = v)}
			onRequiresEvaluationChange={(v) => (requiresEvaluation = v)}
			onMinScoreChange={(v) => (minScore = v)}
			onEvaluationModeChange={(v) => (evaluationMode = v)}
			onShuffleQuestionsChange={(v) => (shuffleQuestions = v)}
			onShuffleSectionsChange={(v) => (shuffleSections = v)}
			onMembersExemptChange={(v) => (membersExempt = v)}
			onPerEventChange={(v) => (perEvent = v)}
			onLlmGuidelinesChange={(v) => (llmGuidelines = v)}
			onMaxSubmissionAgeChange={(v) => (maxSubmissionAge = v)}
			onCanRetakeAfterChange={(v) => (canRetakeAfter = v)}
			onMaxAttemptsChange={(v) => (maxAttempts = v)}
		/>

		<!-- Event Assignments -->
		<QuestionnaireEditAssignments
			{questionnaire}
			onManageAssignments={() => (isAssignmentModalOpen = true)}
		/>

		<!-- Questions & Sections -->
		<QuestionnaireEditQuestionsCard
			{builder}
			{canEdit}
			{showLlmGuidelines}
			questionsError={errors.questions}
		/>

		<!-- Error Display -->
		{#if saveError}
			<Card class="border-destructive bg-destructive/10">
				<CardContent class="py-4">
					<div class="flex items-start gap-3">
						<div class="flex-1">
							<p class="font-medium text-destructive">
								{m['questionnaireEditPage.saveErrorTitle']()}
							</p>
							<p class="mt-1 whitespace-pre-wrap text-sm text-destructive/90">{saveError}</p>
						</div>
						<Button
							variant="ghost"
							size="sm"
							onclick={() => (saveError = null)}
							class="text-destructive hover:text-destructive"
						>
							{m['questionnaireEditPage.dismiss']()}
						</Button>
					</div>
				</CardContent>
			</Card>
		{/if}

		<!-- Actions -->
		<div class="flex justify-end gap-3">
			<Button href="/org/{data.organizationSlug}/admin/questionnaires" variant="outline">
				{m['questionnaireEditPage.cancelButton']()}
			</Button>
			<Button onclick={saveQuestionnaire} disabled={isSaving || !canEdit}>
				{isSaving
					? m['questionnaireEditPage.savingButton']()
					: m['questionnaireEditPage.saveButton']()}
			</Button>
		</div>
	</div>

	<!-- Assignment Modal -->
	{#if isAssignmentModalOpen && questionnaire}
		<QuestionnaireAssignmentModal
			bind:open={isAssignmentModalOpen}
			{questionnaire}
			organizationId={data.organization.id}
			accessToken={authStore.accessToken || ''}
			onClose={() => (isAssignmentModalOpen = false)}
		/>
	{/if}

	<!-- Duplicate Modal -->
	{#if data.questionnaire}
		<DuplicateQuestionnaireModal
			bind:open={isDuplicateModalOpen}
			orgQuestionnaireId={data.questionnaire.id}
			questionnaireName={data.questionnaire.questionnaire.name}
			organizationSlug={data.organizationSlug}
			onClose={() => (isDuplicateModalOpen = false)}
		/>
	{/if}
{/if}
