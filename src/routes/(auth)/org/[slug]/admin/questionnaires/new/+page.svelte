<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { goto } from '$app/navigation';
	import { DurationInput } from '$lib/components/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import { Plus, ArrowLeft, FolderPlus, Upload } from 'lucide-svelte';
	import QuestionEditor from '$lib/components/questionnaires/QuestionEditor.svelte';
	import SectionEditor from '$lib/components/questionnaires/SectionEditor.svelte';
	import MarkdownEditor from '$lib/components/forms/MarkdownEditor.svelte';
	import { questionnaireCreateOrgQuestionnaire } from '$lib/api/generated/sdk.gen';
	import type {
		SectionCreateSchema,
		MultipleChoiceQuestionCreateSchema,
		FreeTextQuestionCreateSchema,
		FileUploadQuestionCreateSchema
	} from '$lib/api/generated/types.gen';
	import type { PageData } from './$types';
	import type {
		QuestionnaireQuestion as Question,
		QuestionnaireSection as Section
	} from '$lib/utils/questionnaire-form-types';
	import {
		addTopLevelQuestion as _addTopLevelQuestion,
		removeTopLevelQuestion as _removeTopLevelQuestion,
		updateTopLevelQuestion as _updateTopLevelQuestion,
		addSection as _addSection,
		removeSection as _removeSection,
		updateSection as _updateSection,
		addQuestionToSection as _addQuestionToSection,
		removeQuestionFromSection as _removeQuestionFromSection,
		updateQuestionInSection as _updateQuestionInSection,
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

	// Top-level questions (not in any section)
	let topLevelQuestions = $state<Question[]>([]);

	// Sections with their questions
	let sections = $state<Section[]>([]);

	// Total question count
	const totalQuestionCount = $derived(
		topLevelQuestions.length + sections.reduce((sum, s) => sum + s.questions.length, 0)
	);

	// Check if LLM guidelines are needed
	const allQuestions = $derived([...topLevelQuestions, ...sections.flatMap((s) => s.questions)]);
	const hasFreeTextQuestions = $derived(allQuestions.some((q) => q.type === 'free_text'));
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

	// Questionnaire type labels and descriptions
	const questionnaireTypes = {
		admission: {
			label: m['questionnaireNewPage.typeAdmissionLabel'](),
			description: m['questionnaireNewPage.typeAdmissionTriggerDescription']()
		},
		membership: {
			label: m['questionnaireNewPage.typeMembershipLabel'](),
			description: m['questionnaireNewPage.typeMembershipTriggerDescription']()
		},
		feedback: {
			label: m['questionnaireNewPage.typeFeedbackLabel'](),
			description: m['questionnaireNewPage.typeFeedbackDescription']()
		},
		generic: {
			label: m['questionnaireNewPage.typeGenericLabel'](),
			description: m['questionnaireNewPage.typeGenericDescription']()
		}
	};

	// Get display label for current type
	const selectedTypeLabel = $derived(
		questionnaireTypes[questionnaireType]?.label ?? m['questionnaireNewPage.typeGenericLabel']()
	);

	// Get current description safely
	const selectedTypeDescription = $derived(
		questionnaireTypes[questionnaireType]?.description ??
			m['questionnaireNewPage.typeGenericDescription']()
	);

	// Evaluation mode descriptions
	const evaluationModes = {
		automatic: {
			label: m['questionnaireNewPage.evalAutomaticLabel'](),
			description: m['questionnaireNewPage.evalAutomaticTriggerDescription']()
		},
		manual: {
			label: m['questionnaireNewPage.evalManualLabel'](),
			description: m['questionnaireNewPage.evalManualTriggerDescription']()
		},
		hybrid: {
			label: m['questionnaireNewPage.evalHybridLabel'](),
			description: m['questionnaireNewPage.evalHybridTriggerDescription']()
		}
	};

	const selectedEvaluationDescription = $derived(
		evaluationModes[evaluationMode]?.description ??
			m['questionnaireNewPage.evalAutomaticTriggerDescription']()
	);

	// ===== Wrapper functions that delegate to pure helpers and reassign $state =====

	function addTopLevelQuestion(type: 'multiple_choice' | 'free_text' | 'file_upload') {
		topLevelQuestions = _addTopLevelQuestion(topLevelQuestions, type);
	}

	function removeTopLevelQuestion(id: string) {
		topLevelQuestions = _removeTopLevelQuestion(topLevelQuestions, id);
	}

	function updateTopLevelQuestion(id: string, updates: Partial<Question>) {
		topLevelQuestions = _updateTopLevelQuestion(topLevelQuestions, id, updates);
	}

	function addSection() {
		sections = _addSection(sections);
	}

	function removeSection(id: string) {
		sections = _removeSection(sections, id);
	}

	function updateSection(id: string, updates: Partial<Section>) {
		sections = _updateSection(sections, id, updates);
	}

	function addQuestionToSection(
		sectionId: string,
		type: 'multiple_choice' | 'free_text' | 'file_upload'
	) {
		sections = _addQuestionToSection(sections, sectionId, type);
	}

	function removeQuestionFromSection(sectionId: string, questionId: string) {
		sections = _removeQuestionFromSection(sections, sectionId, questionId);
	}

	function updateQuestionInSection(
		sectionId: string,
		questionId: string,
		updates: Partial<Question>
	) {
		sections = _updateQuestionInSection(sections, sectionId, questionId, updates);
	}

	// Move top-level question up/down
	function moveTopLevelQuestion(index: number, direction: 'up' | 'down') {
		const targetIndex = direction === 'up' ? index - 1 : index + 1;
		if (targetIndex < 0 || targetIndex >= topLevelQuestions.length) return;
		const snapshot = $state.snapshot(topLevelQuestions);
		[snapshot[index], snapshot[targetIndex]] = [snapshot[targetIndex], snapshot[index]];
		topLevelQuestions = snapshot.map((q, i) => ({ ...q, order: i }));
	}

	// Move section up/down
	function moveSection(index: number, direction: 'up' | 'down') {
		const targetIndex = direction === 'up' ? index - 1 : index + 1;
		if (targetIndex < 0 || targetIndex >= sections.length) return;
		const snapshot = $state.snapshot(sections);
		[snapshot[index], snapshot[targetIndex]] = [snapshot[targetIndex], snapshot[index]];
		sections = snapshot.map((s, i) => ({ ...s, order: i }));
	}

	// Move question within a section up/down
	function moveQuestionInSection(sectionId: string, index: number, direction: 'up' | 'down') {
		const sectionSnapshot = $state.snapshot(sections);
		const section = sectionSnapshot.find((s) => s.id === sectionId);
		if (!section) return;
		const targetIndex = direction === 'up' ? index - 1 : index + 1;
		if (targetIndex < 0 || targetIndex >= section.questions.length) return;
		[section.questions[index], section.questions[targetIndex]] = [
			section.questions[targetIndex],
			section.questions[index]
		];
		section.questions = section.questions.map((q, i) => ({ ...q, order: i }));
		sections = sectionSnapshot;
	}

	// Validate form
	function validate(): boolean {
		errors = {};

		if (!name.trim()) {
			errors.name = m['questionnaireNewPage.error_nameRequired']();
		}

		if (totalQuestionCount === 0) {
			errors.questions = m['questionnaireNewPage.error_noQuestions']();
		}

		// Validate each question has text
		const invalidQuestions = allQuestions.filter((q) => !q.text.trim());
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
			const apiSections = buildCreateApiSections(sections);

			// Top-level questions (not in any section)
			const topLevelMC = topLevelQuestions
				.filter((q) => q.type === 'multiple_choice')
				.map((q) => mcQuestionToCreateApiFormat(q));
			const topLevelFT = topLevelQuestions
				.filter((q) => q.type === 'free_text')
				.map((q) => ftQuestionToCreateApiFormat(q));
			const topLevelFU = topLevelQuestions
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
				if (response.response.status === 422) {
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
						: `Failed to create questionnaire (HTTP ${response.response.status}).`;
					console.error('API error:', response.error);
				}
				return;
			}

			// Redirect to the edit page of the newly created questionnaire
			await goto(`/org/${data.organization.slug}/admin/questionnaires/${response.data.id}`);
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
	<Card>
		<CardHeader>
			<CardTitle>{m['questionnaireNewPage.basicInfoTitle']()}</CardTitle>
			<CardDescription>{m['questionnaireNewPage.basicInfoDescription']()}</CardDescription>
		</CardHeader>
		<CardContent class="space-y-4">
			<!-- Name -->
			<div class="space-y-2">
				<Label for="name">
					{m['questionnaireNewPage.nameLabel']()}
					<span class="text-destructive">*</span>
				</Label>
				<Input
					id="name"
					bind:value={name}
					placeholder={m['questionnaireNewPage.namePlaceholder']()}
					class={errors.name ? 'border-destructive' : ''}
				/>
				{#if errors.name}
					<p class="text-sm text-destructive">{errors.name}</p>
				{/if}
			</div>

			<!-- Description (markdown) -->
			<MarkdownEditor
				id="questionnaire-description"
				label={m['questionnaireNewPage.descriptionLabel']()}
				bind:value={description}
				placeholder={m['questionnaireNewPage.descriptionPlaceholder']()}
				rows={3}
			/>

			<!-- Type -->
			<div class="space-y-2">
				<Label for="type">
					{m['questionnaireNewPage.typeFieldLabel']()}
					<span class="text-destructive">*</span>
				</Label>
				<Select
					type="single"
					value={questionnaireType}
					onValueChange={(v) => {
						// Allow admission and feedback types
						if (v === 'admission' || v === 'feedback') {
							questionnaireType = v;
						}
					}}
				>
					<SelectTrigger id="type">
						{selectedTypeLabel}
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="admission" label={m['questionnaireNewPage.typeAdmissionLabel']()}>
							<div class="flex flex-col gap-0.5">
								<div class="font-medium">{m['questionnaireNewPage.typeAdmissionLabel']()}</div>
								<div class="text-xs text-muted-foreground">
									{m['questionnaireNewPage.typeAdmissionDescription']()}
								</div>
							</div>
						</SelectItem>
						<SelectItem value="feedback" label={m['questionnaireNewPage.typeFeedbackLabel']()}>
							<div class="flex flex-col gap-0.5">
								<div class="font-medium">{m['questionnaireNewPage.typeFeedbackLabel']()}</div>
								<div class="text-xs text-muted-foreground">
									{m['questionnaireNewPage.typeFeedbackDescription']()}
								</div>
							</div>
						</SelectItem>
						<SelectItem
							value="membership"
							label={m['questionnaireNewPage.typeMembershipLabel']()}
							disabled
						>
							<div class="flex flex-col gap-0.5">
								<div class="flex items-center gap-2 font-medium">
									{m['questionnaireNewPage.typeMembershipLabel']()}
									<span
										class="rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground"
										>{m['questionnaireNewPage.comingSoon']()}</span
									>
								</div>
								<div class="text-xs text-muted-foreground">
									{m['questionnaireNewPage.typeMembershipDescription']()}
								</div>
							</div>
						</SelectItem>
						<SelectItem
							value="generic"
							label={m['questionnaireNewPage.typeGenericLabel']()}
							disabled
						>
							<div class="flex flex-col gap-0.5">
								<div class="flex items-center gap-2 font-medium">
									{m['questionnaireNewPage.typeGenericLabel']()}
									<span
										class="rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground"
										>{m['questionnaireNewPage.comingSoon']()}</span
									>
								</div>
								<div class="text-xs text-muted-foreground">
									{m['questionnaireNewPage.typeGenericDescription']()}
								</div>
							</div>
						</SelectItem>
					</SelectContent>
				</Select>
				<p class="text-xs text-muted-foreground">
					{selectedTypeDescription}
				</p>
			</div>

			<!-- Requires Evaluation -->
			<div class="space-y-2">
				<div class="flex items-center space-x-2">
					<input
						id="requires-evaluation"
						type="checkbox"
						bind:checked={requiresEvaluation}
						class="h-4 w-4 rounded border-gray-300"
						disabled={questionnaireType === 'feedback'}
					/>
					<Label for="requires-evaluation" class="font-normal"
						>{m['questionnaireEditPage.evaluation.requiresEvaluationLabel']()}</Label
					>
				</div>
				{#if questionnaireType === 'feedback'}
					<p class="text-xs italic text-muted-foreground">
						{m['questionnaireEditPage.evaluation.feedbackNoEvaluation']()}
					</p>
				{:else}
					<p class="text-xs text-muted-foreground">
						{m['questionnaireEditPage.evaluation.requiresEvaluationDescription']()}
					</p>
				{/if}
			</div>

			{#if effectiveRequiresEvaluation}
				<!-- Minimum Score -->
				<div class="space-y-2">
					<Label for="min-score">
						{m['questionnaireNewPage.minScorePctLabel']()}
						<span class="text-destructive">*</span>
					</Label>
					<Input
						id="min-score"
						type="number"
						bind:value={minScore}
						min="0"
						max="100"
						step="1"
						placeholder="0"
					/>
					<p class="text-xs text-muted-foreground">
						{m['questionnaireNewPage.minScorePctDescription']()}
					</p>
				</div>

				<!-- Evaluation Mode -->
				<div class="space-y-2">
					<Label for="evaluation-mode">
						{m['questionnaireNewPage.evaluationModeLabel']()}
						<span class="text-destructive">*</span>
					</Label>
					<Select
						type="single"
						value={evaluationMode}
						onValueChange={(v) => {
							if (v) {
								evaluationMode = v as typeof evaluationMode;
							}
						}}
					>
						<SelectTrigger id="evaluation-mode">
							{evaluationModes[evaluationMode]?.label ??
								m['questionnaireNewPage.evalManualLabel']()}
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="manual" label={m['questionnaireNewPage.evalManualLabel']()}>
								<div class="flex flex-col gap-0.5">
									<div class="font-medium">{m['questionnaireNewPage.evalManualLabel']()}</div>
									<div class="text-xs text-muted-foreground">
										{m['questionnaireNewPage.evalManualDescription']()}
									</div>
								</div>
							</SelectItem>
							<SelectItem
								value="hybrid"
								label={m['questionnaireNewPage.evalHybridLabel']()}
								disabled
							>
								<div class="flex flex-col gap-0.5">
									<div class="flex items-center gap-2 font-medium">
										{m['questionnaireNewPage.evalHybridLabel']()}
										<span
											class="rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground"
											>{m['questionnaireNewPage.comingSoon']()}</span
										>
									</div>
									<div class="text-xs text-muted-foreground">
										{m['questionnaireNewPage.evalHybridDescription']()}
									</div>
								</div>
							</SelectItem>
							<SelectItem
								value="automatic"
								label={m['questionnaireNewPage.evalAutomaticLabel']()}
								disabled
							>
								<div class="flex flex-col gap-0.5">
									<div class="flex items-center gap-2 font-medium">
										{m['questionnaireNewPage.evalAutomaticLabel']()}
										<span
											class="rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground"
											>{m['questionnaireNewPage.comingSoon']()}</span
										>
									</div>
									<div class="text-xs text-muted-foreground">
										{m['questionnaireNewPage.evalAutomaticDescription']()}
									</div>
								</div>
							</SelectItem>
						</SelectContent>
					</Select>
					<p class="text-xs text-muted-foreground">
						{selectedEvaluationDescription}
					</p>
				</div>
			{/if}
		</CardContent>
	</Card>

	<!-- Advanced Settings -->
	<Card>
		<CardHeader>
			<CardTitle>{m['questionnaireNewPage.advancedSettingsTitle']()}</CardTitle>
			<CardDescription>{m['questionnaireNewPage.advancedSettingsDescription']()}</CardDescription>
		</CardHeader>
		<CardContent class="space-y-4">
			<!-- Shuffle Options -->
			<div class="space-y-3">
				<div class="flex items-center space-x-2">
					<input
						id="shuffle-questions"
						type="checkbox"
						bind:checked={shuffleQuestions}
						class="h-4 w-4 rounded border-gray-300"
					/>
					<Label for="shuffle-questions" class="font-normal"
						>{m['questionnaireNewPage.shuffleQuestionsLabel']()}</Label
					>
				</div>
				<div class="flex items-center space-x-2">
					<input
						id="shuffle-sections"
						type="checkbox"
						bind:checked={shuffleSections}
						class="h-4 w-4 rounded border-gray-300"
					/>
					<Label for="shuffle-sections" class="font-normal"
						>{m['questionnaireNewPage.shuffleSectionsLabel']()}</Label
					>
				</div>
			</div>

			<!-- Members Exempt -->
			<div class="space-y-2">
				<div class="flex items-center space-x-2">
					<input
						id="members-exempt"
						type="checkbox"
						bind:checked={membersExempt}
						class="h-4 w-4 rounded border-gray-300"
					/>
					<Label for="members-exempt" class="font-normal"
						>{m['questionnaireNewPage.membersExemptLabel']()}</Label
					>
				</div>
				<p class="text-xs text-muted-foreground">
					{m['questionnaireNewPage.membersExemptDescription']()}
				</p>
			</div>

			<!-- Per-Event Completion (only for admission type) -->
			{#if questionnaireType === 'admission'}
				<div class="space-y-2">
					<div class="flex items-center space-x-2">
						<input
							id="per-event"
							type="checkbox"
							bind:checked={perEvent}
							class="h-4 w-4 rounded border-gray-300"
						/>
						<Label for="per-event" class="font-normal"
							>{m['questionnaireNewPage.perEventLabel']()}</Label
						>
					</div>
					<p class="text-xs text-muted-foreground">
						{m['questionnaireNewPage.perEventDescription']()}
					</p>
				</div>
			{/if}

			{#if showLlmGuidelines}
				<!-- LLM Guidelines -->
				<div class="space-y-2">
					<Label for="llm-guidelines">
						{m['questionnaireNewPage.llmGuidelinesFieldLabel']()}
						{#if needsLlmGuidelines}
							<span class="text-destructive">*</span>
						{/if}
					</Label>
					<Textarea
						id="llm-guidelines"
						bind:value={llmGuidelines}
						placeholder={m['questionnaireNewPage.llmGuidelinesPlaceholder']()}
						rows={4}
						class={showLlmWarning ? 'border-destructive' : ''}
					/>
					{#if showLlmWarning}
						<p class="text-sm text-destructive">
							{m['questionnaireNewPage.llmGuidelinesRequiredWarning']()}
						</p>
					{:else}
						<p class="text-xs text-muted-foreground">
							{#if needsLlmGuidelines}
								{m['questionnaireNewPage.llmGuidelinesRequired']()}
							{:else}
								{m['questionnaireNewPage.llmGuidelinesOptional']()}
							{/if}
						</p>
					{/if}
				</div>
			{/if}

			<!-- Duration Settings -->
			<div class="grid gap-4 sm:grid-cols-2">
				<DurationInput
					id="max-submission-age"
					label={m['questionnaireNewPage.submissionValidityLabel']()}
					helpText={m['questionnaireNewPage.submissionValidityDescription']()}
					bind:value={() => maxSubmissionAge, (v) => (maxSubmissionAge = v)}
					storageUnit="days"
					defaultUnit="days"
					emptyValue={null}
					emptyLabel={m['questionnaireNewPage.submissionValidityNoLimit']()}
				/>

				<DurationInput
					id="can-retake-after"
					label={m['questionnaireNewPage.retakeCooldownLabel']()}
					helpText={m['questionnaireNewPage.retakeCooldownDescription']()}
					bind:value={() => canRetakeAfter, (v) => (canRetakeAfter = v)}
					storageUnit="hours"
					defaultUnit="hours"
					emptyValue={null}
					emptyLabel={m['questionnaireNewPage.retakeCooldownNoLimit']()}
				/>
			</div>

			<!-- Max Attempts -->
			<div class="space-y-2">
				<Label for="max-attempts">
					{m['questionnaireNewPage.maxAttemptsLabel']()}
					<span class="text-destructive">*</span>
				</Label>
				<Input id="max-attempts" type="number" bind:value={maxAttempts} min="0" step="1" required />
				<p class="text-xs text-muted-foreground">
					{m['questionnaireNewPage.maxAttemptsDescription']()}
				</p>
			</div>
		</CardContent>
	</Card>

	<!-- Questions & Sections -->
	<Card>
		<CardHeader>
			<div class="flex items-center justify-between">
				<div>
					<CardTitle
						>{m['questionnaireNewPage.questionsTitleCount']({
							count: totalQuestionCount
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
						onclick={() => addTopLevelQuestion('multiple_choice')}
						class="gap-2"
					>
						<Plus class="h-4 w-4" />
						{m['questionnaireNewPage.addMultipleChoice']()}
					</Button>
					<Button
						variant="outline"
						size="sm"
						onclick={() => addTopLevelQuestion('free_text')}
						class="gap-2"
					>
						<Plus class="h-4 w-4" />
						{m['questionnaireNewPage.addFreeText']()}
					</Button>
					<Button
						variant="outline"
						size="sm"
						onclick={() => addTopLevelQuestion('file_upload')}
						class="gap-2"
					>
						<Upload class="h-4 w-4" />
						{m['questionnaireNewPage.addFileUpload']()}
					</Button>
					<Button variant="secondary" size="sm" onclick={addSection} class="gap-2">
						<FolderPlus class="h-4 w-4" />
						{m['questionnaireNewPage.addSection']()}
					</Button>
				</div>
			</div>
		</CardHeader>
		<CardContent class="space-y-6">
			{#if totalQuestionCount === 0 && sections.length === 0}
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
							count: topLevelQuestions.length
						})}
					</h3>
					<p class="text-xs text-muted-foreground">
						{m['questionnaireNewPage.reorderQuestionsHint']()}
					</p>
					<div class="space-y-4">
						{#each topLevelQuestions as question, index (question.id)}
							<QuestionEditor
								{question}
								onUpdate={(updates) => updateTopLevelQuestion(question.id, updates)}
								onRemove={() => removeTopLevelQuestion(question.id)}
								onMoveUp={() => moveTopLevelQuestion(index, 'up')}
								onMoveDown={() => moveTopLevelQuestion(index, 'down')}
								isFirst={index === 0}
								isLast={index === topLevelQuestions.length - 1}
								{showLlmGuidelines}
							/>
						{/each}
					</div>

					{#if topLevelQuestions.length === 0}
						<div class="rounded-lg border border-dashed p-4 text-center">
							<p class="text-sm text-muted-foreground">
								{m['questionnaireNewPage.noTopLevelQuestions']()}
							</p>
						</div>
					{/if}

					<!-- Bottom buttons for adding more top-level questions -->
					{#if topLevelQuestions.length > 0}
						<div class="flex justify-center gap-2 border-t pt-4">
							<Button
								variant="outline"
								size="sm"
								onclick={() => addTopLevelQuestion('multiple_choice')}
								class="gap-2"
							>
								<Plus class="h-4 w-4" />
								{m['questionnaireNewPage.addMultipleChoice']()}
							</Button>
							<Button
								variant="outline"
								size="sm"
								onclick={() => addTopLevelQuestion('free_text')}
								class="gap-2"
							>
								<Plus class="h-4 w-4" />
								{m['questionnaireNewPage.addFreeText']()}
							</Button>
							<Button
								variant="outline"
								size="sm"
								onclick={() => addTopLevelQuestion('file_upload')}
								class="gap-2"
							>
								<Upload class="h-4 w-4" />
								{m['questionnaireNewPage.addFileUpload']()}
							</Button>
						</div>
					{/if}
				</div>

				<!-- Sections - drag and drop zone -->
				{#if sections.length > 0 || topLevelQuestions.length > 0}
					<div class="space-y-4">
						<div class="border-t pt-4">
							<h3 class="mb-2 text-sm font-medium text-muted-foreground">
								{m['questionnaireNewPage.sectionsHeading']({ count: sections.length })}
							</h3>
							<p class="text-xs text-muted-foreground">
								{m['questionnaireNewPage.reorderSectionsHint']()}
							</p>
						</div>
						<div class="space-y-4">
							{#each sections as section, index (section.id)}
								<SectionEditor
									{section}
									onUpdate={(updates) => updateSection(section.id, updates)}
									onRemove={() => removeSection(section.id)}
									onMoveUp={() => moveSection(index, 'up')}
									onMoveDown={() => moveSection(index, 'down')}
									isFirst={index === 0}
									isLast={index === sections.length - 1}
									onAddQuestion={(type) => addQuestionToSection(section.id, type)}
									onUpdateQuestion={(questionId, updates) =>
										updateQuestionInSection(section.id, questionId, updates)}
									onRemoveQuestion={(questionId) =>
										removeQuestionFromSection(section.id, questionId)}
									onMoveQuestionUp={(qIndex) => moveQuestionInSection(section.id, qIndex, 'up')}
									onMoveQuestionDown={(qIndex) => moveQuestionInSection(section.id, qIndex, 'down')}
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
			{#if totalQuestionCount > 0 || sections.length > 0}
				<div class="flex flex-wrap justify-center gap-2 border-t pt-4">
					<Button
						variant="outline"
						size="sm"
						onclick={() => addTopLevelQuestion('multiple_choice')}
						class="gap-2"
					>
						<Plus class="h-4 w-4" />
						{m['questionnaireNewPage.addMultipleChoice']()}
					</Button>
					<Button
						variant="outline"
						size="sm"
						onclick={() => addTopLevelQuestion('free_text')}
						class="gap-2"
					>
						<Plus class="h-4 w-4" />
						{m['questionnaireNewPage.addFreeText']()}
					</Button>
					<Button
						variant="outline"
						size="sm"
						onclick={() => addTopLevelQuestion('file_upload')}
						class="gap-2"
					>
						<Upload class="h-4 w-4" />
						{m['questionnaireNewPage.addFileUpload']()}
					</Button>
					<Button variant="secondary" size="sm" onclick={addSection} class="gap-2">
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
