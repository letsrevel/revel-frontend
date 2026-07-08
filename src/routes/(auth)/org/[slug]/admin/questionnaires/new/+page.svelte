<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import { Plus, ArrowLeft, FolderPlus, Upload } from '@lucide/svelte';
	import QuestionEditor from '$lib/components/questionnaires/QuestionEditor.svelte';
	import SectionEditor from '$lib/components/questionnaires/SectionEditor.svelte';
	import QuestionnaireCreateBasicInfo from '$lib/components/questionnaires/QuestionnaireCreateBasicInfo.svelte';
	import QuestionnaireCreateAdvancedSettings from '$lib/components/questionnaires/QuestionnaireCreateAdvancedSettings.svelte';
	import { questionnaireCreateOrgQuestionnaire } from '$lib/api/generated/sdk.gen';
	import type {
		SectionCreateSchema,
		MultipleChoiceQuestionCreateSchema,
		FreeTextQuestionCreateSchema,
		FileUploadQuestionCreateSchema
	} from '$lib/api/generated/types.gen';
	import type { PageData } from './$types';
	import { QuestionnaireBuilder } from '$lib/utils/questionnaire-builder.svelte';
	import {
		mcQuestionToCreateApiFormat,
		ftQuestionToCreateApiFormat,
		fuQuestionToCreateApiFormat,
		buildCreateApiSections,
		parseValidationErrors
	} from '$lib/utils/questionnaire-form-helpers';

	interface Props {
		data: PageData;
	}

	const { data }: Props = $props();

	// Form state
	let name = $state('');
	let description = $state(''); // Questionnaire description (markdown)
	let questionnaireType = $state<'admission' | 'membership' | 'feedback' | 'generic'>('admission');
	let minScore = $state(0);
	let evaluationMode = $state<'automatic' | 'manual' | 'hybrid'>('manual');
	let shuffleQuestions = $state(false);
	let shuffleSections = $state(false);
	let llmGuidelines = $state('');
	let maxSubmissionAge = $state<number | null>(null); // Duration in days
	let canRetakeAfter = $state<number | null>(null); // Duration in hours
	let maxAttempts = $state(1); // Max submission attempts (0 = unlimited)
	let membersExempt = $state(false); // Exempt members from questionnaire
	let perEvent = $state(false); // Require per-event completion
	let requiresEvaluation = $state(true);

	// Feedback type forces evaluation off; derive the effective value for the payload/UI
	const effectiveRequiresEvaluation = $derived(
		questionnaireType === 'feedback' ? false : requiresEvaluation
	);

	// Error state for displaying validation errors
	let saveError = $state<string | null>(null);

	// Reactive questions/sections model (top-level questions + sections)
	const builder = new QuestionnaireBuilder();

	// Check if LLM guidelines are needed
	const hasFreeTextQuestions = $derived(builder.allQuestions.some((q) => q.type === 'free_text'));
	const needsLlmGuidelines = $derived(
		hasFreeTextQuestions && (evaluationMode === 'automatic' || evaluationMode === 'hybrid')
	);
	const showLlmWarning = $derived(needsLlmGuidelines && !llmGuidelines.trim());

	// LLM guidelines are only relevant for hybrid/automatic evaluation
	const showLlmGuidelines = $derived(effectiveRequiresEvaluation && evaluationMode !== 'manual');

	// Form validation
	let errors = $state<{
		name?: string;
		questions?: string;
	}>({});

	// Saving state
	let isSaving = $state(false);

	// Validate form
	function validate(): boolean {
		errors = {};

		if (!name.trim()) {
			errors.name = m['questionnaireNewPage.error_nameRequired']();
		}

		if (builder.totalQuestionCount === 0) {
			errors.questions = m['questionnaireNewPage.error_noQuestions']();
		}

		// Validate each question has text
		const invalidQuestions = builder.allQuestions.filter((q) => !q.text.trim());
		if (invalidQuestions.length > 0) {
			errors.questions = m['questionnaireNewPage.error_questionsNeedText']();
		}

		return Object.keys(errors).length === 0;
	}

	// Save questionnaire
	async function saveQuestionnaire() {
		// Clear previous error
		saveError = null;

		if (!validate()) {
			return;
		}

		isSaving = true;

		try {
			const user = data.user;
			if (!user) {
				throw new Error('Not authenticated');
			}

			// Build sections array for API
			const apiSections = buildCreateApiSections(builder.sections);

			// Top-level questions (not in any section)
			const topLevelMC = builder.topLevelQuestions
				.filter((q) => q.type === 'multiple_choice')
				.map((q) => mcQuestionToCreateApiFormat(q));
			const topLevelFT = builder.topLevelQuestions
				.filter((q) => q.type === 'free_text')
				.map((q) => ftQuestionToCreateApiFormat(q));
			const topLevelFU = builder.topLevelQuestions
				.filter((q) => q.type === 'file_upload')
				.map((q) => fuQuestionToCreateApiFormat(q));

			// Create questionnaire
			const response = await questionnaireCreateOrgQuestionnaire({
				path: { organization_id: data.organization.id },
				body: {
					name,
					description: description || null,
					min_score: minScore,
					evaluation_mode: evaluationMode,
					questionnaire_type: questionnaireType,
					max_submission_age: maxSubmissionAge ? `P${maxSubmissionAge}D` : undefined,
					shuffle_questions: shuffleQuestions,
					shuffle_sections: shuffleSections,
					llm_guidelines: llmGuidelines || null,
					can_retake_after: canRetakeAfter ? `PT${canRetakeAfter * 3600}S` : undefined,
					max_attempts: maxAttempts,
					members_exempt: membersExempt,
					per_event: perEvent,
					requires_evaluation: effectiveRequiresEvaluation,
					sections: apiSections as SectionCreateSchema[],
					multiplechoicequestion_questions: topLevelMC as MultipleChoiceQuestionCreateSchema[],
					freetextquestion_questions: topLevelFT as FreeTextQuestionCreateSchema[],
					fileuploadquestion_questions: topLevelFU as FileUploadQuestionCreateSchema[]
				},
				headers: { Authorization: `Bearer ${user.accessToken}` }
			});

			if (response.error) {
				if (response.response?.status === 422) {
					saveError = parseValidationErrors(response.error);
					console.error('Validation error:', response.error);
				} else {
					const err = response.error;
					const detail =
						err && typeof err === 'object' && 'detail' in err && typeof err.detail === 'string'
							? err.detail
							: null;
					saveError = detail
						? `Failed to create questionnaire: ${detail}`
						: `Failed to create questionnaire (HTTP ${response.response?.status}).`;
					console.error('API error:', response.error);
				}
				return;
			}

			// Redirect to the edit page of the newly created questionnaire
			await goto(
				resolve('/(auth)/org/[slug]/admin/questionnaires/[id]', {
					slug: data.organization.slug,
					id: response.data.id
				})
			);
		} catch (err) {
			console.error('Failed to save questionnaire:', err);
			const message = err instanceof Error ? err.message : String(err);
			saveError = `Failed to save questionnaire: ${message}`;
		} finally {
			isSaving = false;
		}
	}
</script>

<svelte:head>
	<title>{m['questionnaireNewPage.pageTitle']()} - {data.organization.name} Admin</title>
</svelte:head>

<!-- Header -->
<div class="mb-6">
	<Button
		href="/org/{data.organization.slug}/admin/questionnaires"
		variant="ghost"
		size="sm"
		class="mb-4 gap-2"
	>
		<ArrowLeft class="h-4 w-4" />
		{m['questionnaireNewPage.backToQuestionnaires']()}
	</Button>

	<h1 class="text-3xl font-bold tracking-tight">{m['questionnaireNewPage.title']()}</h1>
	<p class="mt-2 text-sm text-muted-foreground">
		{m['questionnaireNewPage.subtitle']()}
	</p>
</div>

<!-- Form -->
<div class="mx-auto max-w-4xl space-y-6">
	<!-- Basic Information -->
	<QuestionnaireCreateBasicInfo
		bind:name
		bind:description
		bind:questionnaireType
		bind:requiresEvaluation
		{effectiveRequiresEvaluation}
		bind:minScore
		bind:evaluationMode
		nameError={errors.name}
	/>

	<!-- Advanced Settings -->
	<QuestionnaireCreateAdvancedSettings
		{questionnaireType}
		bind:shuffleQuestions
		bind:shuffleSections
		bind:membersExempt
		bind:perEvent
		bind:llmGuidelines
		bind:maxSubmissionAge
		bind:canRetakeAfter
		bind:maxAttempts
		{showLlmGuidelines}
		{needsLlmGuidelines}
		{showLlmWarning}
	/>

	<!-- Questions & Sections -->
	<Card>
		<CardHeader>
			<div class="flex items-center justify-between">
				<div>
					<CardTitle
						>{m['questionnaireNewPage.questionsTitleCount']({
							count: builder.totalQuestionCount
						})}</CardTitle
					>
					<CardDescription>
						{m['questionnaireNewPage.questionsHelpDescription']()}
					</CardDescription>
				</div>
				<div class="flex flex-wrap gap-2">
					<Button
						variant="outline"
						size="sm"
						onclick={() => builder.addTopLevelQuestion('multiple_choice')}
						class="gap-2"
					>
						<Plus class="h-4 w-4" />
						{m['questionnaireNewPage.addMultipleChoice']()}
					</Button>
					<Button
						variant="outline"
						size="sm"
						onclick={() => builder.addTopLevelQuestion('free_text')}
						class="gap-2"
					>
						<Plus class="h-4 w-4" />
						{m['questionnaireNewPage.addFreeText']()}
					</Button>
					<Button
						variant="outline"
						size="sm"
						onclick={() => builder.addTopLevelQuestion('file_upload')}
						class="gap-2"
					>
						<Upload class="h-4 w-4" />
						{m['questionnaireNewPage.addFileUpload']()}
					</Button>
					<Button variant="secondary" size="sm" onclick={() => builder.addSection()} class="gap-2">
						<FolderPlus class="h-4 w-4" />
						{m['questionnaireNewPage.addSection']()}
					</Button>
				</div>
			</div>
		</CardHeader>
		<CardContent class="space-y-6">
			{#if builder.totalQuestionCount === 0 && builder.sections.length === 0}
				<div class="rounded-lg border border-dashed p-8 text-center">
					<p class="text-sm text-muted-foreground">
						{m['questionnaireNewPage.noQuestionsYet']()}
					</p>
				</div>
			{:else}
				<!-- Top-level questions (not in any section) - drag and drop zone -->
				<div class="space-y-4">
					<h3 class="text-sm font-medium text-muted-foreground">
						{m['questionnaireNewPage.topLevelQuestionsHeading']({
							count: builder.topLevelQuestions.length
						})}
					</h3>
					<p class="text-xs text-muted-foreground">
						{m['questionnaireNewPage.reorderQuestionsHint']()}
					</p>
					<div class="space-y-4">
						{#each builder.topLevelQuestions as question, index (question.id)}
							<QuestionEditor
								{question}
								onUpdate={(updates) => builder.updateTopLevelQuestion(question.id, updates)}
								onRemove={() => builder.removeTopLevelQuestion(question.id)}
								onMoveUp={() => builder.moveTopLevelQuestion(index, 'up')}
								onMoveDown={() => builder.moveTopLevelQuestion(index, 'down')}
								isFirst={index === 0}
								isLast={index === builder.topLevelQuestions.length - 1}
								{showLlmGuidelines}
							/>
						{/each}
					</div>

					{#if builder.topLevelQuestions.length === 0}
						<div class="rounded-lg border border-dashed p-4 text-center">
							<p class="text-sm text-muted-foreground">
								{m['questionnaireNewPage.noTopLevelQuestions']()}
							</p>
						</div>
					{/if}

					<!-- Bottom buttons for adding more top-level questions -->
					{#if builder.topLevelQuestions.length > 0}
						<div class="flex justify-center gap-2 border-t pt-4">
							<Button
								variant="outline"
								size="sm"
								onclick={() => builder.addTopLevelQuestion('multiple_choice')}
								class="gap-2"
							>
								<Plus class="h-4 w-4" />
								{m['questionnaireNewPage.addMultipleChoice']()}
							</Button>
							<Button
								variant="outline"
								size="sm"
								onclick={() => builder.addTopLevelQuestion('free_text')}
								class="gap-2"
							>
								<Plus class="h-4 w-4" />
								{m['questionnaireNewPage.addFreeText']()}
							</Button>
							<Button
								variant="outline"
								size="sm"
								onclick={() => builder.addTopLevelQuestion('file_upload')}
								class="gap-2"
							>
								<Upload class="h-4 w-4" />
								{m['questionnaireNewPage.addFileUpload']()}
							</Button>
						</div>
					{/if}
				</div>

				<!-- Sections - drag and drop zone -->
				{#if builder.sections.length > 0 || builder.topLevelQuestions.length > 0}
					<div class="space-y-4">
						<div class="border-t pt-4">
							<h3 class="mb-2 text-sm font-medium text-muted-foreground">
								{m['questionnaireNewPage.sectionsHeading']({ count: builder.sections.length })}
							</h3>
							<p class="text-xs text-muted-foreground">
								{m['questionnaireNewPage.reorderSectionsHint']()}
							</p>
						</div>
						<div class="space-y-4">
							{#each builder.sections as section, index (section.id)}
								<SectionEditor
									{section}
									onUpdate={(updates) => builder.updateSection(section.id, updates)}
									onRemove={() => builder.removeSection(section.id)}
									onMoveUp={() => builder.moveSection(index, 'up')}
									onMoveDown={() => builder.moveSection(index, 'down')}
									isFirst={index === 0}
									isLast={index === builder.sections.length - 1}
									onAddQuestion={(type) => builder.addQuestionToSection(section.id, type)}
									onUpdateQuestion={(questionId, updates) =>
										builder.updateQuestionInSection(section.id, questionId, updates)}
									onRemoveQuestion={(questionId) =>
										builder.removeQuestionFromSection(section.id, questionId)}
									onMoveQuestionUp={(qIndex) =>
										builder.moveQuestionInSection(section.id, qIndex, 'up')}
									onMoveQuestionDown={(qIndex) =>
										builder.moveQuestionInSection(section.id, qIndex, 'down')}
									{showLlmGuidelines}
								/>
							{/each}
						</div>
					</div>
				{/if}
			{/if}

			{#if errors.questions}
				<p class="mt-4 text-sm text-destructive">{errors.questions}</p>
			{/if}

			<!-- Bottom action bar -->
			{#if builder.totalQuestionCount > 0 || builder.sections.length > 0}
				<div class="flex flex-wrap justify-center gap-2 border-t pt-4">
					<Button
						variant="outline"
						size="sm"
						onclick={() => builder.addTopLevelQuestion('multiple_choice')}
						class="gap-2"
					>
						<Plus class="h-4 w-4" />
						{m['questionnaireNewPage.addMultipleChoice']()}
					</Button>
					<Button
						variant="outline"
						size="sm"
						onclick={() => builder.addTopLevelQuestion('free_text')}
						class="gap-2"
					>
						<Plus class="h-4 w-4" />
						{m['questionnaireNewPage.addFreeText']()}
					</Button>
					<Button
						variant="outline"
						size="sm"
						onclick={() => builder.addTopLevelQuestion('file_upload')}
						class="gap-2"
					>
						<Upload class="h-4 w-4" />
						{m['questionnaireNewPage.addFileUpload']()}
					</Button>
					<Button variant="secondary" size="sm" onclick={() => builder.addSection()} class="gap-2">
						<FolderPlus class="h-4 w-4" />
						{m['questionnaireNewPage.addSection']()}
					</Button>
				</div>
			{/if}
		</CardContent>
	</Card>

	<!-- Error Display -->
	{#if saveError}
		<Card class="border-destructive bg-destructive/10">
			<CardContent class="py-4">
				<div class="flex items-start gap-3">
					<div class="flex-1">
						<p class="font-medium text-destructive">
							{m['questionnaireNewPage.validationErrorTitle']()}
						</p>
						<p class="mt-1 whitespace-pre-wrap text-sm text-destructive/90">{saveError}</p>
					</div>
					<Button
						variant="ghost"
						size="sm"
						onclick={() => (saveError = null)}
						class="text-destructive hover:text-destructive"
					>
						{m['questionnaireNewPage.dismiss']()}
					</Button>
				</div>
			</CardContent>
		</Card>
	{/if}

	<!-- Actions -->
	<div class="flex justify-end gap-3">
		<Button href="/org/{data.organization.slug}/admin/questionnaires" variant="outline">
			{m['questionnaireNewPage.cancelButton']()}
		</Button>
		<Button onclick={saveQuestionnaire} disabled={isSaving}>
			{isSaving ? m['questionnaireNewPage.savingButton']() : m['questionnaireNewPage.saveButton']()}
		</Button>
	</div>
</div>
