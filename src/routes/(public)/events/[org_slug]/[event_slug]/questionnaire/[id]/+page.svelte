<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import { createMutation } from '@tanstack/svelte-query';
	import { eventpublicattendanceSubmitQuestionnaire } from '$lib/api';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { RadioGroup, RadioGroupItem } from '$lib/components/ui/radio-group';
	import { ArrowLeft, Check, Loader2, AlertCircle, CornerDownRight, Upload } from 'lucide-svelte';
	import { cn } from '$lib/utils/cn';
	import * as m from '$lib/paraglide/messages.js';
	import { toast } from 'svelte-sonner';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { slide } from 'svelte/transition';
	import MarkdownContent from '$lib/components/common/MarkdownContent.svelte';
	import FileUploadQuestion from '$lib/components/questionnaires/FileUploadQuestion.svelte';
	import type { QuestionnaireFileSchema } from '$lib/api/generated';
	import {
		flattenQuestionnaire,
		getVisibleQuestionIds,
		getVisibleSectionIds,
		getQuestionsForOption,
		getSectionsForOption,
		optionHasDependents,
		type ConditionalQuestion,
		type ConditionalSection
	} from '$lib/utils/conditional-questions';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	// Flatten the questionnaire for easier conditional handling
	let flattened = $derived(flattenQuestionnaire(data.questionnaire));

	// Form state - using SvelteMap for fine-grained reactivity
	let multipleChoiceAnswers = new SvelteMap<string, string[]>();
	let freeTextAnswers = new SvelteMap<string, string>();
	let fileUploadAnswers = new SvelteMap<string, QuestionnaireFileSchema[]>();
	let validationErrors = new SvelteMap<string, string>();

	// Track all selected option IDs across all questions
	let selectedOptionIds = $derived.by(() => {
		const ids = new SvelteSet<string>();
		for (const [, optionIds] of multipleChoiceAnswers) {
			for (const id of optionIds) {
				ids.add(id);
			}
		}
		return ids;
	});

	// Compute visible questions and sections based on selections
	let visibleQuestionIds = $derived(getVisibleQuestionIds(flattened, selectedOptionIds));
	let visibleSectionIds = $derived(getVisibleSectionIds(flattened, selectedOptionIds));

	// Helper to check if a question is visible
	function isQuestionVisible(questionId: string): boolean {
		return visibleQuestionIds.has(questionId);
	}

	// Helper to check if a section is visible
	function isSectionVisible(sectionId: string): boolean {
		return visibleSectionIds.has(sectionId);
	}

	// Get all visible questions (for validation and submission)
	let allVisibleQuestions = $derived.by(() => {
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

	// Submission mutation
	const submitMutation = createMutation(() => ({
		mutationFn: async () => {
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
				throw new Error(m['questionnaireSubmissionPage.validation_allRequired']());
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

			const submission = {
				questionnaire_id: data.questionnaire.id,
				multiple_choice_answers: visibleMcAnswers,
				free_text_answers: visibleFtAnswers,
				file_upload_answers: visibleFuAnswers,
				status: 'ready' as const
			};

			const { data: result, error } = await eventpublicattendanceSubmitQuestionnaire({
				path: {
					event_id: data.event.id,
					questionnaire_id: data.questionnaire.id
				},
				body: submission
			});

			if (error || !result) {
				throw new Error(m['questionnaireSubmissionPage.error_submitFailed']());
			}

			return result;
		},
		onSuccess: (result) => {
			// Check if it's an evaluation response (has status field)
			if ('status' in result) {
				if (result.status === 'approved') {
					toast.success(m['questionnaireSubmissionPage.toast_approved_title'](), {
						description: m['questionnaireSubmissionPage.toast_approved_description']()
					});
				} else if (result.status === 'pending review') {
					toast.info(m['questionnaireSubmissionPage.toast_pending_title'](), {
						description: m['questionnaireSubmissionPage.toast_pending_description']()
					});
				} else if (result.status === 'rejected') {
					toast.error(m['questionnaireSubmissionPage.toast_rejected_title'](), {
						description: m['questionnaireSubmissionPage.toast_rejected_description']()
					});
				}
			} else {
				// Simple submission response
				toast.success(m['questionnaireSubmissionPage.toast_success_title'](), {
					description: m['questionnaireSubmissionPage.toast_success_description']()
				});
			}

			// Redirect back to event page
			setTimeout(() => {
				goto(`/events/${data.event.organization.slug}/${data.event.slug}`);
			}, 2000);
		},
		onError: (error: Error) => {
			toast.error(m['questionnaireSubmissionPage.toast_error_title'](), {
				description: error.message || m['questionnaireSubmissionPage.toast_error_description']()
			});
		}
	}));

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
		submitMutation.mutate();
	}

	// Helper to check if option is selected
	function isOptionSelected(questionId: string, optionId: string): boolean {
		return multipleChoiceAnswers.get(questionId)?.includes(optionId) || false;
	}
</script>

<svelte:head>
	<title
		>{m['questionnaireSubmissionPage.pageTitle']({
			questionnaireName: data.questionnaire.name,
			eventName: data.event.name
		})}</title
	>
</svelte:head>

<div class="container mx-auto max-w-3xl px-4 py-8">
	<!-- Header -->
	<div class="mb-8">
		<a
			href="/events/{data.event.organization.slug}/{data.event.slug}"
			class="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
		>
			<ArrowLeft class="h-4 w-4" />
			{m['questionnaireSubmissionPage.backToEvent']()}
		</a>
		<h1 class="text-3xl font-bold">{data.questionnaire.name}</h1>
		<p class="mt-2 text-muted-foreground">
			{m['questionnaireSubmissionPage.subtitle']({ eventName: data.event.name })}
		</p>
		{#if data.questionnaire.description}
			<div class="mt-4 rounded-lg border bg-muted/50 p-4">
				<MarkdownContent content={data.questionnaire.description} />
			</div>
		{/if}
	</div>

	<!-- Form -->
	<form onsubmit={handleSubmit} class="space-y-8">
		<!-- Non-conditional Sections -->
		{#each flattened.sections
			.filter((s) => !s.depends_on_option_id)
			.sort((a, b) => a.order - b.order) as section (section.id)}
			<div class="rounded-lg border bg-card p-6">
				<h2 class="mb-2 text-xl font-semibold">{section.name}</h2>
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
		<div class="flex items-center justify-end gap-4 border-t pt-6">
			<Button
				type="button"
				variant="outline"
				onclick={() => goto(`/events/${data.event.organization.slug}/${data.event.slug}`)}
			>
				{m['questionnaireSubmissionPage.button_cancel']()}
			</Button>
			<Button type="submit" disabled={submitMutation.isPending}>
				{#if submitMutation.isPending}
					<Loader2 class="h-5 w-5 animate-spin" />
					{m['questionnaireSubmissionPage.button_submitting']()}
				{:else if submitMutation.isSuccess}
					<Check class="h-5 w-5" />
					{m['questionnaireSubmissionPage.button_submitted']()}
				{:else}
					{m['questionnaireSubmissionPage.button_submit']()}
				{/if}
			</Button>
		</div>

		<!-- Error message -->
		{#if submitMutation.isError}
			<div
				class="flex items-start gap-3 rounded-md border border-destructive bg-destructive/10 p-4 text-destructive"
				role="alert"
			>
				<AlertCircle class="mt-0.5 h-5 w-5 shrink-0" />
				<div class="flex-1">
					<p class="font-semibold">{m['questionnaireSubmissionPage.error_alert_title']()}</p>
					<p class="mt-1 text-sm">
						{submitMutation.error?.message ||
							m['questionnaireSubmissionPage.error_alert_description']()}
					</p>
				</div>
			</div>
		{/if}
	</form>
</div>

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
			<div class="space-y-2">
				{#each question.options || [] as option (option.id)}
					<div class="space-y-2">
						<div class="flex items-center space-x-2">
							<Checkbox
								id="{question.id}-{option.id}"
								checked={isOptionSelected(question.id, option.id)}
								onCheckedChange={(checked) =>
									handleMultipleChoiceChange(question.id, option.id, !!checked, true)}
							/>
							<label
								for="{question.id}-{option.id}"
								class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
							>
								{option.option}
							</label>
						</div>
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
			>
				{#each question.options || [] as option (option.id)}
					<div class="space-y-2">
						<div class="flex items-center space-x-2">
							<RadioGroupItem value={option.id} id="{question.id}-{option.id}" />
							<Label for="{question.id}-{option.id}">{option.option}</Label>
						</div>
						<!-- Conditional questions/sections for this option -->
						{@render conditionalContent(option.id, question.id)}
					</div>
				{/each}
			</RadioGroup>
		{/if}

		{#if validationErrors.has(question.id)}
			<p class="text-sm text-destructive">{validationErrors.get(question.id)}</p>
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

		<!-- AI Evaluation Warning -->
		{#if data.questionnaire.evaluation_mode === 'automatic'}
			<div
				class="flex items-start gap-2 rounded-md border border-orange-500/50 bg-orange-50 p-3 text-sm text-orange-900 dark:border-orange-500/30 dark:bg-orange-950/20 dark:text-orange-200"
				role="status"
			>
				<AlertCircle class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
				<p>{m['questionnaireSubmissionPage.aiWarning_automatic']()}</p>
			</div>
		{:else if data.questionnaire.evaluation_mode === 'hybrid'}
			<div
				class="flex items-start gap-2 rounded-md border border-yellow-500/50 bg-yellow-50 p-3 text-sm text-yellow-900 dark:border-yellow-500/30 dark:bg-yellow-950/20 dark:text-yellow-200"
				role="status"
			>
				<AlertCircle class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
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
			maxlength={500}
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
					<h3 class="mb-2 text-lg font-semibold">{conditionalSection.name}</h3>
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
