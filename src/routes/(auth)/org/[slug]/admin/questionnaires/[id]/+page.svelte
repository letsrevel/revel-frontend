<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import * as m from '$lib/paraglide/messages.js';
	import { flip } from 'svelte/animate';
	import { dndzone, SHADOW_PLACEHOLDER_ITEM_ID } from 'svelte-dnd-action';
	import { Button } from '$lib/components/ui/button';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import {
		ArrowLeft,
		FileEdit,
		CalendarCheck,
		Calendar,
		Plus,
		FolderPlus,
		Pencil,
		Upload
	} from 'lucide-svelte';
	import QuestionnaireAssignmentModal from '$lib/components/questionnaires/QuestionnaireAssignmentModal.svelte';
	import QuestionnaireStatusBar from '$lib/components/questionnaires/QuestionnaireStatusBar.svelte';
	import QuestionnaireFormFields from '$lib/components/questionnaires/QuestionnaireFormFields.svelte';
	import QuestionnaireReadOnlyView from '$lib/components/questionnaires/QuestionnaireReadOnlyView.svelte';
	import QuestionEditor from '$lib/components/questionnaires/QuestionEditor.svelte';
	import SectionEditor from '$lib/components/questionnaires/SectionEditor.svelte';
	import { questionnaireUpdateQuestionnaireStatus } from '$lib/api/generated/sdk.gen';
	import type { PageData } from './$types';
	import type {
		QuestionnaireEvaluationMode,
		QuestionnaireStatus
	} from '$lib/api/generated/types.gen';
	import { Badge } from '$lib/components/ui/badge';
	import type {
		QuestionnaireQuestion as Question,
		QuestionnaireSection as Section
	} from '$lib/utils/questionnaire-form-types';
	import { DND_FLIP_DURATION_MS, DND_DROP_TARGET_STYLE } from '$lib/utils/questionnaire-form-types';
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
		reorderQuestionsInSection as _reorderQuestionsInSection
	} from '$lib/utils/questionnaire-form-helpers';
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
		if (!q) return;

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
		topLevelQuestions = result.topLevelQuestions;
		sections = result.sections;

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

	// Local state for questions/sections (same as create page)
	let topLevelQuestions = $state<Question[]>([]);
	let sections = $state<Section[]>([]);

	// Initialize when data loads
	$effect(() => {
		if (isLoaded && !isInitialized) {
			initializeFromApi();
		}
	});

	// Total question count
	const totalQuestionCount = $derived(
		topLevelQuestions.length + sections.reduce((sum, s) => sum + s.questions.length, 0)
	);

	// All questions for validation
	const allQuestions = $derived([...topLevelQuestions, ...sections.flatMap((s) => s.questions)]);

	// Form validation
	let errors = $state<{ name?: string; questions?: string }>({});

	// Saving state
	let isSaving = $state(false);
	let saveError = $state<string | null>(null);

	// Status change state
	let isChangingStatus = $state(false);

	// Assignment modal state
	let isAssignmentModalOpen = $state(false);

	// Edit mode state - user must explicitly enable editing
	// This protects against accidental modifications while still allowing edits to any questionnaire
	let isEditMode = $state(false);

	// Derived helper for UI - combines edit mode with data availability
	const canEdit = $derived(isEditMode && isLoaded);

	// Current status
	const currentStatus = $derived<QuestionnaireStatus>(
		(q?.status as QuestionnaireStatus) ?? 'draft'
	);

	// Status info is needed for the changeStatus confirm dialog
	const statusDescriptions: Record<QuestionnaireStatus, string> = {
		draft: m['questionnaireEditPage.status.draft_description'](),
		ready: m['questionnaireEditPage.status.ready_description'](),
		published: m['questionnaireEditPage.status.published_description']()
	};

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

	function reorderQuestionsInSection(sectionId: string, newQuestions: Question[]) {
		sections = _reorderQuestionsInSection(sections, sectionId, newQuestions);
	}

	// DnD config
	const flipDurationMs = DND_FLIP_DURATION_MS;
	const dropTargetStyle = DND_DROP_TARGET_STYLE;

	// Handle DnD for top-level questions
	function handleTopLevelQuestionsDndConsider(e: CustomEvent<{ items: Question[] }>) {
		topLevelQuestions = e.detail.items;
	}

	function handleTopLevelQuestionsDndFinalize(e: CustomEvent<{ items: Question[] }>) {
		topLevelQuestions = e.detail.items
			.filter((q) => q.id !== SHADOW_PLACEHOLDER_ITEM_ID)
			.map((q, index) => ({ ...q, order: index }));
	}

	// Handle DnD for sections
	function handleSectionsDndConsider(e: CustomEvent<{ items: Section[] }>) {
		sections = e.detail.items;
	}

	function handleSectionsDndFinalize(e: CustomEvent<{ items: Section[] }>) {
		sections = e.detail.items
			.filter((s) => s.id !== SHADOW_PLACEHOLDER_ITEM_ID)
			.map((s, index) => ({ ...s, order: index }));
	}

	// ===== Validation =====

	function validate(): boolean {
		errors = {};

		if (!name.trim()) {
			errors.name = m['questionnaireEditPage.basicInfo.nameRequired']();
		}

		if (totalQuestionCount === 0) {
			errors.questions = 'At least one question is required';
		}

		const invalidQuestions = allQuestions.filter((q) => !q.text.trim());
		if (invalidQuestions.length > 0) {
			errors.questions = 'All questions must have text';
		}

		return Object.keys(errors).length === 0;
	}

	// ===== Status Management =====

	function getOrgQuestionnaireId(): string {
		if (!questionnaire?.id) throw new Error('Questionnaire not loaded');
		return questionnaire.id;
	}

	async function changeStatus(newStatus: QuestionnaireStatus) {
		const statusAction = newStatus === 'published' ? 'publish' : `mark as ${newStatus}`;
		const confirmed = confirm(
			`Are you sure you want to ${statusAction} this questionnaire?\n\n${statusDescriptions[newStatus]}`
		);

		if (!confirmed) return;

		isChangingStatus = true;

		try {
			const user = data.auth;
			if (!user.accessToken) {
				throw new Error(m['questionnaireEditPage.error_notAuthenticated']());
			}

			const response = await questionnaireUpdateQuestionnaireStatus({
				path: {
					org_questionnaire_id: getOrgQuestionnaireId(),
					status: newStatus
				},
				headers: { Authorization: `Bearer ${user.accessToken}` }
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
			const user = data.auth;
			if (!user.accessToken) {
				throw new Error(m['questionnaireEditPage.error_notAuthenticated']());
			}

			const orgQuestionnaireId = getOrgQuestionnaireId();
			const authHeader = { Authorization: `Bearer ${user.accessToken}` };

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
				topLevelQuestions,
				sections
			});

			// Refresh data, re-initialize state from API, and exit edit mode (stay on same page)
			await invalidateAll();
			initializeFromApi(); // Explicitly re-init with fresh data (avoids race with $effect)
			isEditMode = false;

			// Scroll to top so user sees the updated questionnaire
			window.scrollTo({ top: 0, behavior: 'smooth' });
		} catch (err) {
			console.error('Failed to save questionnaire:', err);
			saveError = 'Failed to save questionnaire. Please try again.';
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
			<p class="mt-4 text-muted-foreground">Loading questionnaire...</p>
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
						<p class="font-medium text-green-800 dark:text-green-200">Edit mode enabled</p>
						<p class="mt-1 text-green-700 dark:text-green-300">
							You can now edit questions, sections, and options. Changes will be saved when you
							click Save.
						</p>
					</div>
				</div>
				<Button variant="outline" size="sm" onclick={() => (isEditMode = false)} class="shrink-0">
					Cancel Editing
				</Button>
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
						<p class="font-medium text-blue-800 dark:text-blue-200">View mode</p>
						<p class="mt-1 text-blue-700 dark:text-blue-300">
							Click "Edit Questionnaire" to modify questions, sections, and options.
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
					Edit Questionnaire
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
		<Card>
			<CardHeader>
				<div class="flex items-center justify-between">
					<div>
						<CardTitle>{m['questionnaireEditPage.assignments.title']()}</CardTitle>
						<CardDescription>{m['questionnaireEditPage.assignments.description']()}</CardDescription
						>
					</div>
					<Button
						variant="outline"
						size="sm"
						onclick={() => (isAssignmentModalOpen = true)}
						class="gap-2"
					>
						<CalendarCheck class="h-4 w-4" />
						Manage Assignments
					</Button>
				</div>
			</CardHeader>
			<CardContent>
				{#if (questionnaire?.events?.length || 0) === 0 && (questionnaire?.event_series?.length || 0) === 0}
					<div class="rounded-lg border border-dashed p-8 text-center">
						<Calendar class="mx-auto mb-2 h-8 w-8 text-muted-foreground" aria-hidden="true" />
						<p class="text-sm font-medium">
							{m['questionnaireEditPage.assignments.noAssignments']()}
						</p>
						<p class="mt-1 text-xs text-muted-foreground">
							{m['questionnaireEditPage.assignments.noAssignmentsDescription']()}
						</p>
					</div>
				{:else}
					<div class="space-y-4">
						{#if questionnaire?.events && questionnaire.events.length > 0}
							<div>
								<h4 class="mb-2 text-sm font-medium">
									{m['questionnaireEditPage.assignments.individualEventsTitle']()}
								</h4>
								<div class="space-y-2">
									{#each questionnaire.events as event}
										<div class="flex items-center justify-between rounded-lg border p-3">
											<div>
												<p class="font-medium">{event.name}</p>
												{#if event.start}
													<p class="text-sm text-muted-foreground">
														{new Date(event.start).toLocaleDateString('en-US', {
															month: 'short',
															day: 'numeric',
															year: 'numeric'
														})}
													</p>
												{/if}
											</div>
											<Badge variant="outline">{(event as any).event_type}</Badge>
										</div>
									{/each}
								</div>
							</div>
						{/if}

						{#if questionnaire?.event_series && questionnaire.event_series.length > 0}
							<div>
								<h4 class="mb-2 text-sm font-medium">
									{m['questionnaireEditPage.assignments.eventSeriesTitle']()}
								</h4>
								<div class="space-y-2">
									{#each questionnaire.event_series as series}
										<div class="flex items-center justify-between rounded-lg border p-3">
											<div>
												<p class="font-medium">{series.name}</p>
												<p class="text-sm text-muted-foreground">
													{(series as any).event_count || 0}
													{(series as any).event_count === 1 ? 'event' : 'events'}
												</p>
											</div>
											<Badge variant="secondary">Series</Badge>
										</div>
									{/each}
								</div>
							</div>
						{/if}
					</div>
				{/if}
			</CardContent>
		</Card>

		<!-- Questions & Sections -->
		<Card>
			<CardHeader>
				<div class="flex items-center justify-between">
					<div>
						<CardTitle
							>{m['questionnaireEditPage.questions.title']()} ({totalQuestionCount})</CardTitle
						>
						<CardDescription>{m['questionnaireEditPage.questions.description']()}</CardDescription>
					</div>
					{#if canEdit}
						<div class="flex flex-wrap gap-2">
							<Button
								variant="outline"
								size="sm"
								onclick={() => addTopLevelQuestion('multiple_choice')}
								class="gap-2"
							>
								<Plus class="h-4 w-4" />
								Multiple Choice
							</Button>
							<Button
								variant="outline"
								size="sm"
								onclick={() => addTopLevelQuestion('free_text')}
								class="gap-2"
							>
								<Plus class="h-4 w-4" />
								Free Text
							</Button>
							<Button
								variant="outline"
								size="sm"
								onclick={() => addTopLevelQuestion('file_upload')}
								class="gap-2"
							>
								<Upload class="h-4 w-4" />
								File Upload
							</Button>
							<Button variant="secondary" size="sm" onclick={addSection} class="gap-2">
								<FolderPlus class="h-4 w-4" />
								Add Section
							</Button>
						</div>
					{/if}
				</div>
			</CardHeader>
			<CardContent class="space-y-6">
				{#if totalQuestionCount === 0 && sections.length === 0}
					<div class="rounded-lg border border-dashed p-8 text-center">
						<p class="text-sm text-muted-foreground">
							{m['questionnaireEditPage.questions.empty']()}
						</p>
						{#if canEdit}
							<p class="mt-2 text-sm text-muted-foreground">
								Click the buttons above to add questions or sections.
							</p>
						{/if}
					</div>
				{:else if canEdit}
					<!-- Editable mode - same as create page -->
					<div class="space-y-4">
						<h3 class="text-sm font-medium text-muted-foreground">
							Top-level Questions ({topLevelQuestions.length})
						</h3>
						<p class="text-xs text-muted-foreground">
							Drag questions to reorder, or drag them into a section below.
						</p>
						<div
							class="min-h-[60px] space-y-4 rounded-lg"
							use:dndzone={{
								items: topLevelQuestions,
								flipDurationMs,
								dropTargetStyle,
								type: 'questions'
							}}
							onconsider={handleTopLevelQuestionsDndConsider}
							onfinalize={handleTopLevelQuestionsDndFinalize}
						>
							{#each topLevelQuestions.filter((q) => q.id !== SHADOW_PLACEHOLDER_ITEM_ID) as question (question.id)}
								<div animate:flip={{ duration: flipDurationMs }}>
									<QuestionEditor
										{question}
										onUpdate={(updates) => updateTopLevelQuestion(question.id, updates)}
										onRemove={() => removeTopLevelQuestion(question.id)}
										{showLlmGuidelines}
									/>
								</div>
							{/each}
						</div>

						{#if topLevelQuestions.length === 0}
							<div class="rounded-lg border border-dashed p-4 text-center">
								<p class="text-sm text-muted-foreground">
									No top-level questions. Add questions here or drag them from a section.
								</p>
							</div>
						{/if}

						{#if topLevelQuestions.length > 0}
							<div class="flex justify-center gap-2 border-t pt-4">
								<Button
									variant="outline"
									size="sm"
									onclick={() => addTopLevelQuestion('multiple_choice')}
									class="gap-2"
								>
									<Plus class="h-4 w-4" />
									Multiple Choice
								</Button>
								<Button
									variant="outline"
									size="sm"
									onclick={() => addTopLevelQuestion('free_text')}
									class="gap-2"
								>
									<Plus class="h-4 w-4" />
									Free Text
								</Button>
							</div>
						{/if}
					</div>

					<!-- Sections -->
					{#if sections.length > 0 || topLevelQuestions.length > 0}
						<div class="space-y-4">
							<div class="border-t pt-4">
								<h3 class="mb-2 text-sm font-medium text-muted-foreground">
									Sections ({sections.length})
								</h3>
								<p class="text-xs text-muted-foreground">
									Drag sections to reorder. Drag questions between sections.
								</p>
							</div>
							<div
								class="min-h-[60px] space-y-4 rounded-lg"
								use:dndzone={{
									items: sections,
									flipDurationMs,
									dropTargetStyle,
									type: 'sections',
									dragDisabled: false
								}}
								onconsider={handleSectionsDndConsider}
								onfinalize={handleSectionsDndFinalize}
							>
								{#each sections.filter((s) => s.id !== SHADOW_PLACEHOLDER_ITEM_ID) as section (section.id)}
									<div animate:flip={{ duration: flipDurationMs }}>
										<SectionEditor
											{section}
											onUpdate={(updates) => updateSection(section.id, updates)}
											onRemove={() => removeSection(section.id)}
											onAddQuestion={(type) => addQuestionToSection(section.id, type)}
											onUpdateQuestion={(questionId, updates) =>
												updateQuestionInSection(section.id, questionId, updates)}
											onRemoveQuestion={(questionId) =>
												removeQuestionFromSection(section.id, questionId)}
											onQuestionsReorder={(questions) =>
												reorderQuestionsInSection(section.id, questions)}
											{dropTargetStyle}
											{showLlmGuidelines}
										/>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				{:else}
					<!-- Read-only mode -->
					<QuestionnaireReadOnlyView {topLevelQuestions} {sections} />
				{/if}

				{#if errors.questions}
					<p class="mt-4 text-sm text-destructive">{errors.questions}</p>
				{/if}

				<!-- Bottom action bar (only in edit mode) -->
				{#if canEdit && (totalQuestionCount > 0 || sections.length > 0)}
					<div class="flex justify-center gap-2 border-t pt-4">
						<Button
							variant="outline"
							size="sm"
							onclick={() => addTopLevelQuestion('multiple_choice')}
							class="gap-2"
						>
							<Plus class="h-4 w-4" />
							Multiple Choice
						</Button>
						<Button
							variant="outline"
							size="sm"
							onclick={() => addTopLevelQuestion('free_text')}
							class="gap-2"
						>
							<Plus class="h-4 w-4" />
							Free Text
						</Button>
						<Button
							variant="outline"
							size="sm"
							onclick={() => addTopLevelQuestion('file_upload')}
							class="gap-2"
						>
							<Upload class="h-4 w-4" />
							File Upload
						</Button>
						<Button variant="secondary" size="sm" onclick={addSection} class="gap-2">
							<FolderPlus class="h-4 w-4" />
							Add Section
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
							<p class="font-medium text-destructive">Save Error</p>
							<p class="mt-1 whitespace-pre-wrap text-sm text-destructive/90">{saveError}</p>
						</div>
						<Button
							variant="ghost"
							size="sm"
							onclick={() => (saveError = null)}
							class="text-destructive hover:text-destructive"
						>
							Dismiss
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
			accessToken={data.auth.accessToken || ''}
			onClose={() => (isAssignmentModalOpen = false)}
		/>
	{/if}
{/if}
