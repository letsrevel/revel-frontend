<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { RadioGroup, RadioGroupItem } from '$lib/components/ui/radio-group';
	import { Check, Loader2, AlertCircle, CornerDownRight } from '@lucide/svelte';
	import { cn } from '$lib/utils/cn';
	import * as m from '$lib/paraglide/messages.js';
	import { toast } from 'svelte-sonner';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { slide } from 'svelte/transition';
	import MarkdownContent from '$lib/components/common/MarkdownContent.svelte';
	import FileUploadQuestion from '$lib/components/questionnaires/FileUploadQuestion.svelte';
	import type {
		QuestionnaireFileSchema,
		QuestionnaireSchema,
		QuestionnaireSubmissionSchema
	} from '$lib/api/generated';
	import {
		flattenQuestionnaire,
		getVisibleQuestionIds,
		getVisibleSectionIds,
		getQuestionsForOption,
		getSectionsForOption,
		optionHasDependents,
		type ConditionalQuestion
	} from '$lib/utils/conditional-questions';

	interface Props {
		questionnaire: QuestionnaireSchema;
		/** Whether the caller's submit mutation is in flight. */
		submitting?: boolean;
		/** Whether the caller's submit mutation has succeeded. */
		submitted?: boolean;
		/** Caller-mapped error line, rendered in the form's error alert. */
		submitError?: string | null;
		/** Called with a validated submission payload. */
		onSubmit: (payload: QuestionnaireSubmissionSchema) => void;
		onCancel: () => void;
	}

	const {
		questionnaire,
		submitting = false,
		submitted = false,
		submitError = null,
		onSubmit,
		onCancel
	}: Props = $props();

	// Flatten the questionnaire for easier conditional handling
	const flattened = $derived(flattenQuestionnaire(questionnaire));

	// Form state - using SvelteMap for fine-grained reactivity
	const multipleChoiceAnswers = new SvelteMap<string, string[]>();
	const freeTextAnswers = new SvelteMap<string, string>();
	const fileUploadAnswers = new SvelteMap<string, QuestionnaireFileSchema[]>();
	const validationErrors = new SvelteMap<string, string>();

	// Set when a local validation pass fails (i.e. before the caller's mutation runs)
	let localError = $state<string | null>(null);
	const displayedError = $derived(localError ?? submitError);

	// Track all selected option IDs across all questions
	const selectedOptionIds = $derived.by(() => {
		const ids = new SvelteSet<string>();
		for (const [, optionIds] of multipleChoiceAnswers) {
			for (const id of optionIds) {
				ids.add(id);
			}
		}
		return ids;
	});

	// Compute visible questions and sections based on selections
	const visibleQuestionIds = $derived(getVisibleQuestionIds(flattened, selectedOptionIds));
	const visibleSectionIds = $derived(getVisibleSectionIds(flattened, selectedOptionIds));

	// Helper to check if a question is visible
	function isQuestionVisible(questionId: string): boolean {
		return visibleQuestionIds.has(questionId);
	}

	// Helper to check if a section is visible
	function isSectionVisible(sectionId: string): boolean {
		return visibleSectionIds.has(sectionId);
	}

	// Get all visible questions (for validation and submission)
	const allVisibleQuestions = $derived.by(() => {
		const questions: ConditionalQuestion[] = [];

		// Top-level questions (non-conditional are always included)
		for (const q of flattened.topLevelQuestions) {
			if (isQuestionVisible(q.id)) {
				questions.push(q);
			}
		}

		// Questions from visible sections
		for (const section of flattened.sections) {
			if (isSectionVisible(section.id)) {
				for (const q of section.questions) {
					if (isQuestionVisible(q.id)) {
						questions.push(q);
					}
				}
			}
		}

		// Questions from conditional sections that are now visible
		for (const optionId of selectedOptionIds) {
			const conditionalSections = getSectionsForOption(flattened, optionId);
			for (const section of conditionalSections) {
				for (const q of section.questions) {
					if (isQuestionVisible(q.id)) {
						questions.push(q);
					}
				}
			}
		}

		// Conditional questions that are directly dependent on options
		for (const optionId of selectedOptionIds) {
			const conditionalQuestions = getQuestionsForOption(flattened, optionId);
			for (const q of conditionalQuestions) {
				questions.push(q);
			}
		}

		return questions;
	});

	// Every visible mandatory question answered? Until then the Submit button
	// stays DISABLED: the backend accepts a partial/empty submission (scored 0
	// → rejected), which burns one of the limited attempts (#596).
	const allRequiredAnswered = $derived.by(() => {
		for (const q of allVisibleQuestions) {
			if (!q.is_mandatory) continue;
			if (q.type === 'multiple_choice') {
				const answers = multipleChoiceAnswers.get(q.id);
				if (!answers || answers.length === 0) return false;
			} else if (q.type === 'free_text') {
				const answer = freeTextAnswers.get(q.id);
				if (!answer || answer.trim().length === 0) return false;
			} else if (q.type === 'file_upload') {
				const files = fileUploadAnswers.get(q.id);
				if (!files || files.length === 0) return false;
			}
		}
		return true;
	});

	/**
	 * Validate the visible mandatory questions and build the submission payload.
	 * Returns `null` when validation fails (per-question errors are set instead).
	 */
	function buildSubmission(): QuestionnaireSubmissionSchema | null {
		// Validate only visible mandatory questions
		validationErrors.clear();

		for (const q of allVisibleQuestions) {
			if (q.is_mandatory) {
				if (q.type === 'multiple_choice') {
					const answers = multipleChoiceAnswers.get(q.id);
					if (!answers || answers.length === 0) {
						validationErrors.set(q.id, m['questionnaireSubmissionPage.validation_required']());
					}
				} else if (q.type === 'free_text') {
					const answer = freeTextAnswers.get(q.id);
					if (!answer || answer.trim().length === 0) {
						validationErrors.set(q.id, m['questionnaireSubmissionPage.validation_required']());
					}
				} else if (q.type === 'file_upload') {
					const files = fileUploadAnswers.get(q.id);
					if (!files || files.length === 0) {
						validationErrors.set(q.id, m['questionnaireSubmissionPage.validation_required']());
					}
				}
			}
		}

		if (validationErrors.size > 0) {
			return null;
		}

		// Build submission - only include answers for visible questions
		const visibleMcAnswers = Array.from(multipleChoiceAnswers.entries())
			.filter(([questionId]) => visibleQuestionIds.has(questionId))
			.map(([question_id, options_id]) => ({
				question_id,
				options_id
			}));

		const visibleFtAnswers = Array.from(freeTextAnswers.entries())
			.filter(
				([questionId, answer]) => visibleQuestionIds.has(questionId) && answer.trim().length > 0
			)
			.map(([question_id, answer]) => ({
				question_id,
				answer: answer.trim()
			}));

		const visibleFuAnswers = Array.from(fileUploadAnswers.entries())
			.filter(([questionId, files]) => visibleQuestionIds.has(questionId) && files.length > 0)
			.map(([question_id, files]) => ({
				question_id,
				file_ids: files.map((f) => f.id)
			}));

		return {
			questionnaire_id: questionnaire.id,
			multiple_choice_answers: visibleMcAnswers,
			free_text_answers: visibleFtAnswers,
			file_upload_answers: visibleFuAnswers,
			status: 'ready' as const
		};
	}

	function handleMultipleChoiceChange(
		questionId: string,
		optionId: string,
		checked: boolean,
		allowMultiple: boolean
	) {
		const currentAnswers = multipleChoiceAnswers.get(questionId) || [];

		if (allowMultiple) {
			// Checkbox: add or remove option
			if (checked) {
				multipleChoiceAnswers.set(questionId, [...currentAnswers, optionId]);
			} else {
				multipleChoiceAnswers.set(
					questionId,
					currentAnswers.filter((id) => id !== optionId)
				);
			}
		} else {
			// Radio: replace with single option
			multipleChoiceAnswers.set(questionId, [optionId]);
		}

		// Clear validation error
		validationErrors.delete(questionId);
	}

	function handleFreeTextChange(questionId: string, value: string) {
		freeTextAnswers.set(questionId, value);

		// Clear validation error
		validationErrors.delete(questionId);
	}

	function handleFileUploadChange(questionId: string, files: QuestionnaireFileSchema[]) {
		fileUploadAnswers.set(questionId, files);

		// Clear validation error
		validationErrors.delete(questionId);
	}

	function handleSubmit(e: Event) {
		e.preventDefault();
		localError = null;

		const submission = buildSubmission();
		if (!submission) {
			// Mirrors the previous mutation-level failure: toast + inline alert.
			localError = m['questionnaireSubmissionPage.validation_allRequired']();
			toast.error(m['questionnaireSubmissionPage.toast_error_title'](), {
				description: localError
			});
			return;
		}

		onSubmit(submission);
	}

	// Helper to check if option is selected
	function isOptionSelected(questionId: string, optionId: string): boolean {
		return multipleChoiceAnswers.get(questionId)?.includes(optionId) || false;
	}

	/**
	 * The landing's QuestionnaireMock look, on theme tokens: rounded option rows
	 * with a purple selected state. Mirrors `polls/PollVoteForm`'s
	 * `optionRowClass` exactly — this is the mock-alignment ledger handoff from
	 * the public-discovery PR, which built the poll side of this pattern and
	 * left the questionnaire side (this component, shared by both PUBLIC
	 * questionnaire routes) for the owning cluster.
	 *
	 * The row IS the `<label>`, so the whole padded box is the hit target the
	 * hover state promises — a padded row that highlights on hover but only
	 * activates on its 16px control is a lie, and a 44px-tall row is the mobile
	 * target we want anyway. Purely markup: the native label/control
	 * association (unchanged `for`/`id`) still drives selection, so keyboard,
	 * screen-reader, and `getByRole('radio'|'checkbox', { name })` behaviour
	 * are untouched.
	 *
	 * The selected fill is `bg-primary/10`, which composites to ~the card
	 * colour, so the label keeps `text-foreground` and the token contract's AA
	 * guarantee; the 2px `border-primary` is >= 3:1 non-text against the card
	 * in both modes (5.9 light / 5.3 dark, the same measurement as ToneTile's
	 * brand row). Selection is never carried by the fill alone — the
	 * radio/checkbox state is.
	 */
	function optionRowClass(selected: boolean): string {
		return cn(
			'flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border-2 px-3 py-2 transition-colors',
			selected ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40'
		);
	}
</script>

<!-- Form -->
<form onsubmit={handleSubmit} class="space-y-8">
	<!-- Non-conditional Sections -->
	{#each flattened.sections
		.filter((s) => !s.depends_on_option_id)
		.sort((a, b) => a.order - b.order) as section (section.id)}
		<div class="rounded-lg border bg-card p-6">
			<h2 class="mb-2 text-xl font-extrabold">{section.name}</h2>
			{#if section.description}
				<div class="mb-6">
					<MarkdownContent content={section.description} class="text-muted-foreground" />
				</div>
			{:else}
				<div class="mb-6"></div>
			{/if}

			<div class="space-y-6">
				{#each section.questions
					.filter((q) => !q.depends_on_option_id)
					.sort((a, b) => a.order - b.order) as question (question.id)}
					{@const isVisible = isQuestionVisible(question.id)}
					{#if isVisible}
						{#if question.type === 'multiple_choice'}
							{@render multipleChoiceQuestion(question, false)}
						{:else if question.type === 'file_upload'}
							{@render fileUploadQuestion(question, false)}
						{:else}
							{@render freeTextQuestion(question, false)}
						{/if}
					{/if}
				{/each}
			</div>
		</div>
	{/each}

	<!-- Top-level questions (not in any section, non-conditional) -->
	{#if flattened.topLevelQuestions.filter((q) => !q.depends_on_option_id).length > 0}
		<div class="space-y-6">
			{#each flattened.topLevelQuestions
				.filter((q) => !q.depends_on_option_id)
				.sort((a, b) => a.order - b.order) as question (question.id)}
				{@const isVisible = isQuestionVisible(question.id)}
				{#if isVisible}
					<div class="rounded-lg border bg-card p-6">
						{#if question.type === 'multiple_choice'}
							{@render multipleChoiceQuestion(question, false)}
						{:else if question.type === 'file_upload'}
							{@render fileUploadQuestion(question, false)}
						{:else}
							{@render freeTextQuestion(question, false)}
						{/if}
					</div>
				{/if}
			{/each}
		</div>
	{/if}

	<!-- Submit Button -->
	<div class="flex flex-col items-end gap-2 border-t pt-6">
		{#if !allRequiredAnswered}
			<p class="text-sm text-muted-foreground">
				{m['questionnaireSubmissionPage.validation_allRequired']()}
			</p>
		{/if}
		<div class="flex items-center justify-end gap-4">
			<Button type="button" variant="outline" onclick={onCancel}>
				{m['questionnaireSubmissionPage.button_cancel']()}
			</Button>
			<Button type="submit" disabled={submitting || !allRequiredAnswered}>
				{#if submitting}
					<Loader2 class="h-5 w-5 animate-spin" />
					{m['questionnaireSubmissionPage.button_submitting']()}
				{:else if submitted}
					<Check class="h-5 w-5" />
					{m['questionnaireSubmissionPage.button_submitted']()}
				{:else}
					{m['questionnaireSubmissionPage.button_submit']()}
				{/if}
			</Button>
		</div>
	</div>

	<!-- Error message -->
	{#if displayedError}
		<div
			class="flex items-start gap-3 rounded-md border border-destructive bg-destructive/10 p-4 text-destructive"
			role="alert"
		>
			<AlertCircle class="mt-0.5 h-5 w-5 shrink-0" />
			<div class="flex-1">
				<p class="font-semibold">{m['questionnaireSubmissionPage.error_alert_title']()}</p>
				<p class="mt-1 text-sm">
					{displayedError}
				</p>
			</div>
		</div>
	{/if}
</form>

<!-- Multiple Choice Question Snippet -->
{#snippet multipleChoiceQuestion(question: ConditionalQuestion, isConditional: boolean)}
	{@const useCheckboxes = question.allow_multiple_answers || (question.options?.length || 0) <= 1}
	<div class={cn('space-y-3', isConditional && 'border-l-2 border-primary/30 pl-4')}>
		<div class="flex items-start gap-2">
			{#if isConditional}
				<CornerDownRight class="mt-1 h-4 w-4 shrink-0 text-primary/60" aria-hidden="true" />
			{/if}
			<div class="flex-1">
				<Label class="text-base">
					<MarkdownContent content={question.question} inline={true} />
					{#if question.is_mandatory}
						<span class="text-destructive">*</span>
					{/if}
				</Label>
				{#if question.hint}
					<MarkdownContent content={question.hint} class="mt-1 text-sm text-muted-foreground" />
				{/if}
			</div>
		</div>

		{#if useCheckboxes}
			<!-- Checkboxes: for multiple answers OR single option (single option = yes/no choice) -->
			<div
				class="space-y-2"
				role="group"
				aria-describedby={validationErrors.has(question.id) ? `${question.id}-error` : undefined}
			>
				{#each question.options || [] as option (option.id)}
					<div class="space-y-2">
						<label
							for="{question.id}-{option.id}"
							class={optionRowClass(isOptionSelected(question.id, option.id))}
						>
							<Checkbox
								id="{question.id}-{option.id}"
								checked={isOptionSelected(question.id, option.id)}
								onCheckedChange={(checked) =>
									handleMultipleChoiceChange(question.id, option.id, !!checked, true)}
							/>
							<span
								class="flex-1 text-sm font-bold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
							>
								{option.option}
							</span>
						</label>
						<!-- Conditional questions/sections for this option -->
						{@render conditionalContent(option.id, question.id)}
					</div>
				{/each}
			</div>
		{:else}
			<!-- Radio buttons for single answer (only when 2+ options) -->
			<RadioGroup
				value={multipleChoiceAnswers.get(question.id)?.[0] || ''}
				onValueChange={(value: string) =>
					handleMultipleChoiceChange(question.id, value, true, false)}
				aria-invalid={validationErrors.has(question.id) ? true : undefined}
				aria-describedby={validationErrors.has(question.id) ? `${question.id}-error` : undefined}
			>
				{#each question.options || [] as option (option.id)}
					<div class="space-y-2">
						<Label
							for="{question.id}-{option.id}"
							class={optionRowClass(isOptionSelected(question.id, option.id))}
						>
							<RadioGroupItem value={option.id} id="{question.id}-{option.id}" />
							<span class="flex-1">{option.option}</span>
						</Label>
						<!-- Conditional questions/sections for this option -->
						{@render conditionalContent(option.id, question.id)}
					</div>
				{/each}
			</RadioGroup>
		{/if}

		{#if validationErrors.has(question.id)}
			<p id="{question.id}-error" class="text-sm text-destructive">
				{validationErrors.get(question.id)}
			</p>
		{/if}
	</div>
{/snippet}

<!-- Free Text Question Snippet -->

<!-- File Upload Question Snippet -->
{#snippet fileUploadQuestion(question: ConditionalQuestion, isConditional: boolean)}
	<div class={cn('space-y-2', isConditional && 'border-l-2 border-primary/30 pl-4')}>
		<div class="flex items-start gap-2">
			{#if isConditional}
				<CornerDownRight class="mt-1 h-4 w-4 shrink-0 text-primary/60" aria-hidden="true" />
			{/if}
			<div class="flex-1">
				<!-- FileUploadQuestion renders its file input with id `file-upload-<questionId>` -->
				<Label for="file-upload-{question.id}" class="text-base">
					<MarkdownContent content={question.question} inline={true} />
					{#if question.is_mandatory}
						<span class="text-destructive">*</span>
					{/if}
				</Label>
				{#if question.hint}
					<MarkdownContent content={question.hint} class="mt-1 text-sm text-muted-foreground" />
				{/if}
			</div>
		</div>

		<FileUploadQuestion
			questionId={question.id}
			selectedFiles={fileUploadAnswers.get(question.id) || []}
			accept={question.allowed_mime_types?.join(',') || '*/*'}
			maxSize={question.max_file_size || 10 * 1024 * 1024}
			maxFiles={question.max_files || 1}
			required={question.is_mandatory}
			error={validationErrors.get(question.id)}
			onFilesChange={(files) => handleFileUploadChange(question.id, files)}
		/>
	</div>
{/snippet}

{#snippet freeTextQuestion(question: ConditionalQuestion, isConditional: boolean)}
	<div class={cn('space-y-2', isConditional && 'border-l-2 border-primary/30 pl-4')}>
		<div class="flex items-start gap-2">
			{#if isConditional}
				<CornerDownRight class="mt-1 h-4 w-4 shrink-0 text-primary/60" aria-hidden="true" />
			{/if}
			<div class="flex-1">
				<Label for={question.id} class="text-base">
					<MarkdownContent content={question.question} inline={true} />
					{#if question.is_mandatory}
						<span class="text-destructive">*</span>
					{/if}
				</Label>
				{#if question.hint}
					<MarkdownContent content={question.hint} class="mt-1 text-sm text-muted-foreground" />
				{/if}
			</div>
		</div>

		<!-- AI Evaluation Warning. Both branches share the same `warning` tone
		     (there is no `--warning` token — `border-highlight bg-highlight/10`
		     is the audited pair); the copy, not the tint, distinguishes automatic
		     from hybrid. Heading/lead text stays `text-foreground` per the dark
		     `--destructive`-style trap for `--highlight` too — only the icon
		     carries the tone. -->
		{#if questionnaire.evaluation_mode === 'automatic'}
			<div
				class="flex items-start gap-2 rounded-md border border-highlight bg-highlight/10 p-3 text-sm text-foreground"
				role="status"
			>
				<AlertCircle
					class="mt-0.5 h-4 w-4 shrink-0 text-highlight-foreground dark:text-highlight"
					aria-hidden="true"
				/>
				<p>{m['questionnaireSubmissionPage.aiWarning_automatic']()}</p>
			</div>
		{:else if questionnaire.evaluation_mode === 'hybrid'}
			<div
				class="flex items-start gap-2 rounded-md border border-highlight bg-highlight/10 p-3 text-sm text-foreground"
				role="status"
			>
				<AlertCircle
					class="mt-0.5 h-4 w-4 shrink-0 text-highlight-foreground dark:text-highlight"
					aria-hidden="true"
				/>
				<p>{m['questionnaireSubmissionPage.aiWarning_hybrid']()}</p>
			</div>
		{/if}

		<Textarea
			id={question.id}
			value={freeTextAnswers.get(question.id) || ''}
			oninput={(e) => handleFreeTextChange(question.id, e.currentTarget.value)}
			placeholder={m['questionnaireSubmissionPage.textarea_placeholder']()}
			class={cn(validationErrors.has(question.id) && 'border-destructive')}
			rows={4}
			maxlength={1000}
		/>
		<p class="text-xs text-muted-foreground">
			{m['questionnaireSubmissionPage.characterCount']({
				count: (freeTextAnswers.get(question.id) || '').length
			})}
		</p>
		{#if validationErrors.has(question.id)}
			<p class="text-sm text-destructive">{validationErrors.get(question.id)}</p>
		{/if}
	</div>
{/snippet}

<!-- Conditional Content (questions/sections that appear when an option is selected) -->
{#snippet conditionalContent(optionId: string, parentQuestionId: string)}
	{#if optionHasDependents(flattened, optionId) && isOptionSelected(parentQuestionId, optionId)}
		<div transition:slide={{ duration: 200 }} class="mt-3 space-y-4">
			<!-- Conditional questions for this option -->
			{#each getQuestionsForOption(flattened, optionId).sort((a, b) => a.order - b.order) as conditionalQ (conditionalQ.id)}
				{#if conditionalQ.type === 'multiple_choice'}
					{@render multipleChoiceQuestion(conditionalQ, true)}
				{:else if conditionalQ.type === 'free_text'}
					{@render freeTextQuestion(conditionalQ, true)}
				{:else if conditionalQ.type === 'file_upload'}
					{@render fileUploadQuestion(conditionalQ, true)}
				{/if}
			{/each}

			<!-- Conditional sections for this option -->
			{#each getSectionsForOption(flattened, optionId).sort((a, b) => a.order - b.order) as conditionalSection (conditionalSection.id)}
				<div class="ml-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
					<h3 class="mb-2 text-lg font-extrabold">{conditionalSection.name}</h3>
					{#if conditionalSection.description}
						<div class="mb-4">
							<MarkdownContent
								content={conditionalSection.description}
								class="text-sm text-muted-foreground"
							/>
						</div>
					{/if}
					<div class="space-y-4">
						{#each conditionalSection.questions.sort((a, b) => a.order - b.order) as sectionQ (sectionQ.id)}
							{#if sectionQ.type === 'multiple_choice'}
								{@render multipleChoiceQuestion(sectionQ, true)}
							{:else if sectionQ.type === 'free_text'}
								{@render freeTextQuestion(sectionQ, true)}
							{:else if sectionQ.type === 'file_upload'}
								{@render fileUploadQuestion(sectionQ, true)}
							{/if}
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/if}
{/snippet}
