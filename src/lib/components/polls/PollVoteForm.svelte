<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { createMutation } from '@tanstack/svelte-query';
	import { pollVote } from '$lib/api/generated/sdk.gen';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { RadioGroup, RadioGroupItem } from '$lib/components/ui/radio-group';
	import { Loader2, Check, AlertCircle, CornerDownRight } from '@lucide/svelte';
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
		PollVoteSchema
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
	import { authStore } from '$lib/stores/auth.svelte';

	interface Props {
		questionnaire: QuestionnaireSchema;
		pollId: string;
		/**
		 * The caller's existing vote, if they've already voted and are now
		 * changing it. Used to pre-fill the form so "Change my vote" doesn't
		 * make the user re-pick from scratch. MC + free-text answers pre-fill
		 * fully; file uploads can't (the API returns file_ids only, not the
		 * file metadata the upload widget needs to render).
		 */
		initialVote?: PollVoteSchema | null;
		onSuccess?: () => void;
	}

	const { questionnaire, pollId, initialVote, onSuccess }: Props = $props();

	const flattened = $derived(flattenQuestionnaire(questionnaire));

	// Form state — SvelteMap for fine-grained reactivity
	const multipleChoiceAnswers = new SvelteMap<string, string[]>();
	const freeTextAnswers = new SvelteMap<string, string>();
	const fileUploadAnswers = new SvelteMap<string, QuestionnaireFileSchema[]>();
	const validationErrors = new SvelteMap<string, string>();

	// Seed the form from the caller's existing vote (change-vote flow).
	for (const a of initialVote?.mc_answers ?? []) {
		multipleChoiceAnswers.set(a.question_id, [...a.option_ids]);
	}
	for (const a of initialVote?.free_text_answers ?? []) {
		freeTextAnswers.set(a.question_id, a.answer);
	}

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

	const visibleQuestionIds = $derived(getVisibleQuestionIds(flattened, selectedOptionIds));
	const visibleSectionIds = $derived(getVisibleSectionIds(flattened, selectedOptionIds));

	// Prune answers for questions that are no longer visible (e.g. conditional branches)
	$effect(() => {
		for (const qid of multipleChoiceAnswers.keys()) {
			if (!visibleQuestionIds.has(qid)) multipleChoiceAnswers.delete(qid);
		}
		for (const qid of freeTextAnswers.keys()) {
			if (!visibleQuestionIds.has(qid)) freeTextAnswers.delete(qid);
		}
		for (const qid of fileUploadAnswers.keys()) {
			if (!visibleQuestionIds.has(qid)) fileUploadAnswers.delete(qid);
		}
	});

	function isQuestionVisible(questionId: string): boolean {
		return visibleQuestionIds.has(questionId);
	}

	function isSectionVisible(sectionId: string): boolean {
		return visibleSectionIds.has(sectionId);
	}

	const allVisibleQuestions = $derived.by(() => {
		const questions: ConditionalQuestion[] = [];

		for (const q of flattened.topLevelQuestions) {
			if (isQuestionVisible(q.id)) questions.push(q);
		}

		for (const section of flattened.sections) {
			if (isSectionVisible(section.id)) {
				for (const q of section.questions) {
					if (isQuestionVisible(q.id)) questions.push(q);
				}
			}
		}

		for (const optionId of selectedOptionIds) {
			for (const section of getSectionsForOption(flattened, optionId)) {
				for (const q of section.questions) {
					if (isQuestionVisible(q.id)) questions.push(q);
				}
			}
		}

		for (const optionId of selectedOptionIds) {
			for (const q of getQuestionsForOption(flattened, optionId)) {
				questions.push(q);
			}
		}

		return questions;
	});

	const submitMutation = createMutation(() => ({
		mutationFn: async () => {
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
				// Required-field errors are surfaced inline per question; suppress
				// the generic global "Action failed" toast.
				throw Object.assign(new Error(m['questionnaireSubmissionPage.validation_allRequired']()), {
					silent: true
				});
			}

			// Safety net for the "phantom voter" case: even when every visible
			// question is marked is_mandatory=false (poll built that way, or
			// is_mandatory wasn't persisted), refuse to submit a vote that
			// contains zero non-empty answers. Without this, an empty Submit
			// click registers as a voter (total_voters increments) with all
			// option counts staying 0, skewing results.
			//
			// The thrown error carries `silent: true` so the global "Action
			// failed" toast in +layout.svelte's mutations.onError doesn't fire
			// on top of the inline toast we just showed.
			const hasAnyAnswer =
				[...multipleChoiceAnswers.values()].some((opts) => opts.length > 0) ||
				[...freeTextAnswers.values()].some((a) => a.trim().length > 0) ||
				[...fileUploadAnswers.values()].some((files) => files.length > 0);

			if (!hasAnyAnswer) {
				toast.error(m['pollVoterPage.submitErrorEmpty']());
				throw Object.assign(new Error('empty'), { silent: true });
			}

			const mc_answers = [...multipleChoiceAnswers.entries()]
				.filter(([qid]) => visibleQuestionIds.has(qid))
				.map(([question_id, option_ids]) => ({ question_id, option_ids }));

			const free_text_answers = [...freeTextAnswers.entries()]
				.filter(([qid, answer]) => visibleQuestionIds.has(qid) && answer.trim().length > 0)
				.map(([question_id, answer]) => ({ question_id, answer: answer.trim() }));

			const file_upload_answers = [...fileUploadAnswers.entries()]
				.filter(([qid, files]) => visibleQuestionIds.has(qid) && files.length > 0)
				.map(([question_id, files]) => ({ question_id, file_ids: files.map((f) => f.id) }));

			if (!authStore.accessToken) {
				// Inline toast + silent throw, matching the API-error branches below,
				// so the global "Action failed" handler doesn't fire a second toast
				// with the raw internal message.
				toast.error(m['pollVoterPage.submitErrorAuth']());
				throw Object.assign(new Error('not authenticated'), { silent: true });
			}

			const res = await pollVote({
				path: { poll_id: pollId },
				headers: { Authorization: `Bearer ${authStore.accessToken}` },
				body: { mc_answers, free_text_answers, file_upload_answers }
			});

			if (res.error) {
				// Each branch shows a specific inline toast, so the thrown error
				// carries `silent: true` to suppress the global "Action failed"
				// toast in +layout.svelte's mutations.onError (otherwise the user
				// sees two toasts for one failure).
				const status = res.response?.status;
				if (status === 423) {
					toast.error(m['pollVoterPage.submitErrorClosed']());
					throw Object.assign(new Error('closed'), { silent: true });
				} else if (status === 409) {
					toast.error(m['pollVoterPage.submitErrorConflict']());
					await invalidateAll();
					throw Object.assign(new Error('conflict'), { silent: true });
				} else if (status === 422) {
					toast.error(m['pollVoterPage.submitErrorValidation']());
					throw Object.assign(new Error('validation'), { silent: true });
				} else if (status === 403) {
					toast.error(m['pollVoterPage.submitErrorIneligible']());
					throw Object.assign(new Error('ineligible'), { silent: true });
				} else {
					toast.error(m['pollEditPage.saveError']());
					throw Object.assign(new Error('error'), { silent: true });
				}
			}
		},
		onSuccess: async () => {
			toast.success(m['pollVoterPage.submitSuccess']());
			await invalidateAll();
			onSuccess?.();
		}
	}));

	function handleMultipleChoiceChange(
		questionId: string,
		optionId: string,
		checked: boolean,
		allowMultiple: boolean
	) {
		const current = multipleChoiceAnswers.get(questionId) ?? [];
		if (allowMultiple) {
			multipleChoiceAnswers.set(
				questionId,
				checked ? [...current, optionId] : current.filter((id) => id !== optionId)
			);
		} else {
			multipleChoiceAnswers.set(questionId, [optionId]);
		}
		validationErrors.delete(questionId);
	}

	function handleFreeTextChange(questionId: string, value: string) {
		freeTextAnswers.set(questionId, value);
		validationErrors.delete(questionId);
	}

	function handleFileUploadChange(questionId: string, files: QuestionnaireFileSchema[]) {
		fileUploadAnswers.set(questionId, files);
		validationErrors.delete(questionId);
	}

	function handleSubmit(e: Event) {
		e.preventDefault();
		submitMutation.mutate();
	}

	function isOptionSelected(questionId: string, optionId: string): boolean {
		return multipleChoiceAnswers.get(questionId)?.includes(optionId) ?? false;
	}
</script>

<form onsubmit={handleSubmit} class="space-y-8">
	<!-- Non-conditional sections -->
	{#each flattened.sections
		.filter((s) => !s.depends_on_option_id)
		.sort((a, b) => a.order - b.order) as section (section.id)}
		<div class="rounded-lg border bg-card p-6">
			<h3 class="mb-2 text-xl font-semibold">{section.name}</h3>
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
					{#if isQuestionVisible(question.id)}
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
				{#if isQuestionVisible(question.id)}
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

	<!-- Submit -->
	<div class="flex items-center justify-end gap-4 border-t pt-6">
		<Button type="submit" disabled={submitMutation.isPending}>
			{#if submitMutation.isPending}
				<Loader2 class="h-4 w-4 animate-spin" />
				{m['pollVoterPage.submitting']()}
			{:else if submitMutation.isSuccess}
				<Check class="h-4 w-4" />
				{m['pollVoterPage.submitVote']()}
			{:else}
				{m['pollVoterPage.submitVote']()}
			{/if}
		</Button>
	</div>

	<!-- Inline validation error (shown when required questions are missing) -->
	{#if validationErrors.size > 0}
		<div
			class="flex items-start gap-3 rounded-md border border-destructive bg-destructive/10 p-4 text-destructive"
			role="alert"
		>
			<AlertCircle class="mt-0.5 h-5 w-5 shrink-0" />
			<p class="text-sm">{m['questionnaireSubmissionPage.validation_allRequired']()}</p>
		</div>
	{/if}
</form>

<!-- Multiple Choice Question -->
{#snippet multipleChoiceQuestion(question: ConditionalQuestion, isConditional: boolean)}
	{@const useCheckboxes = question.allow_multiple_answers || (question.options?.length ?? 0) <= 1}
	<div class={cn('space-y-3', isConditional && 'border-l-2 border-primary/30 pl-4')}>
		<div class="flex items-start gap-2">
			{#if isConditional}
				<CornerDownRight class="mt-1 h-4 w-4 shrink-0 text-primary/60" aria-hidden="true" />
			{/if}
			<div class="flex-1">
				<Label class="text-base">
					<MarkdownContent content={question.question} inline={true} />
					{#if question.is_mandatory}<span class="text-destructive">*</span>{/if}
				</Label>
				{#if question.hint}
					<MarkdownContent content={question.hint} class="mt-1 text-sm text-muted-foreground" />
				{/if}
			</div>
		</div>

		{#if useCheckboxes}
			<div
				class="space-y-2"
				role="group"
				aria-describedby={validationErrors.has(question.id) ? `${question.id}-error` : undefined}
			>
				{#each question.options ?? [] as option (option.id)}
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
						{@render conditionalContent(option.id, question.id)}
					</div>
				{/each}
			</div>
		{:else}
			<RadioGroup
				value={multipleChoiceAnswers.get(question.id)?.[0] ?? ''}
				onValueChange={(value: string) =>
					handleMultipleChoiceChange(question.id, value, true, false)}
				aria-invalid={validationErrors.has(question.id) ? true : undefined}
				aria-describedby={validationErrors.has(question.id) ? `${question.id}-error` : undefined}
			>
				{#each question.options ?? [] as option (option.id)}
					<div class="space-y-2">
						<div class="flex items-center space-x-2">
							<RadioGroupItem value={option.id} id="{question.id}-{option.id}" />
							<Label for="{question.id}-{option.id}">{option.option}</Label>
						</div>
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

<!-- Free Text Question -->
{#snippet freeTextQuestion(question: ConditionalQuestion, isConditional: boolean)}
	<div class={cn('space-y-2', isConditional && 'border-l-2 border-primary/30 pl-4')}>
		<div class="flex items-start gap-2">
			{#if isConditional}
				<CornerDownRight class="mt-1 h-4 w-4 shrink-0 text-primary/60" aria-hidden="true" />
			{/if}
			<div class="flex-1">
				<Label for={question.id} class="text-base">
					<MarkdownContent content={question.question} inline={true} />
					{#if question.is_mandatory}<span class="text-destructive">*</span>{/if}
				</Label>
				{#if question.hint}
					<MarkdownContent content={question.hint} class="mt-1 text-sm text-muted-foreground" />
				{/if}
			</div>
		</div>
		<Textarea
			id={question.id}
			value={freeTextAnswers.get(question.id) ?? ''}
			oninput={(e) => handleFreeTextChange(question.id, e.currentTarget.value)}
			placeholder={m['questionnaireSubmissionPage.textarea_placeholder']()}
			class={cn(validationErrors.has(question.id) && 'border-destructive')}
			rows={4}
			maxlength={1000}
			aria-invalid={validationErrors.has(question.id) ? true : undefined}
			aria-describedby={validationErrors.has(question.id) ? `${question.id}-error` : undefined}
		/>
		<p class="text-xs text-muted-foreground">
			{m['questionnaireSubmissionPage.characterCount']({
				count: (freeTextAnswers.get(question.id) ?? '').length
			})}
		</p>
		{#if validationErrors.has(question.id)}
			<p id="{question.id}-error" class="text-sm text-destructive">
				{validationErrors.get(question.id)}
			</p>
		{/if}
	</div>
{/snippet}

<!-- File Upload Question -->
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
					{#if question.is_mandatory}<span class="text-destructive">*</span>{/if}
				</Label>
				{#if question.hint}
					<MarkdownContent content={question.hint} class="mt-1 text-sm text-muted-foreground" />
				{/if}
			</div>
		</div>
		<FileUploadQuestion
			questionId={question.id}
			selectedFiles={fileUploadAnswers.get(question.id) ?? []}
			accept={question.allowed_mime_types?.join(',') ?? '*/*'}
			maxSize={question.max_file_size ?? 10 * 1024 * 1024}
			maxFiles={question.max_files ?? 1}
			required={question.is_mandatory}
			error={validationErrors.get(question.id)}
			onFilesChange={(files) => handleFileUploadChange(question.id, files)}
		/>
	</div>
{/snippet}

<!-- Conditional content (questions/sections that appear when an option is selected) -->
{#snippet conditionalContent(optionId: string, parentQuestionId: string)}
	{#if optionHasDependents(flattened, optionId) && isOptionSelected(parentQuestionId, optionId)}
		<div transition:slide={{ duration: 200 }} class="mt-3 space-y-4">
			{#each getQuestionsForOption(flattened, optionId).sort((a, b) => a.order - b.order) as conditionalQ (conditionalQ.id)}
				{#if conditionalQ.type === 'multiple_choice'}
					{@render multipleChoiceQuestion(conditionalQ, true)}
				{:else if conditionalQ.type === 'free_text'}
					{@render freeTextQuestion(conditionalQ, true)}
				{:else if conditionalQ.type === 'file_upload'}
					{@render fileUploadQuestion(conditionalQ, true)}
				{/if}
			{/each}

			{#each getSectionsForOption(flattened, optionId).sort((a, b) => a.order - b.order) as conditionalSection (conditionalSection.id)}
				<div class="ml-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
					<h4 class="mb-2 text-lg font-semibold">{conditionalSection.name}</h4>
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
