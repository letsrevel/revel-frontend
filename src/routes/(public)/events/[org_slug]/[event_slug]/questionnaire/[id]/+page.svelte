<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import { createMutation } from '@tanstack/svelte-query';
	import { eventSubmitQuestionnaire } from '$lib/api/client';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { RadioGroup, RadioGroupItem } from '$lib/components/ui/radio-group';
	import { ArrowLeft, Check, Loader2, AlertCircle } from 'lucide-svelte';
	import { cn } from '$lib/utils/cn';
	import * as m from '$lib/paraglide/messages.js';
	import { toast } from 'svelte-sonner';
	import { SvelteMap } from 'svelte/reactivity';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	// Form state - using SvelteMap for fine-grained reactivity
	let multipleChoiceAnswers = new SvelteMap<string, string[]>();
	let freeTextAnswers = new SvelteMap<string, string>();
	let validationErrors = new SvelteMap<string, string>();

	// Flatten all questions from sections and root level
	let allMultipleChoiceQuestions = $derived.by(() => {
		const questions = [...(data.questionnaire.multiple_choice_questions || [])];
		data.questionnaire.sections?.forEach((section) => {
			questions.push(...(section.multiple_choice_questions || []));
		});
		return questions.sort((a, b) => a.order - b.order);
	});

	let allFreeTextQuestions = $derived.by(() => {
		const questions = [...(data.questionnaire.free_text_questions || [])];
		data.questionnaire.sections?.forEach((section) => {
			questions.push(...(section.free_text_questions || []));
		});
		return questions.sort((a, b) => a.order - b.order);
	});

	// Submission mutation
	const submitMutation = createMutation(() => ({
		mutationFn: async () => {
			// Validate mandatory questions
			validationErrors.clear();

			allMultipleChoiceQuestions.forEach((q) => {
				if (q.is_mandatory) {
					const answers = multipleChoiceAnswers.get(q.id);
					if (!answers || answers.length === 0) {
						validationErrors.set(q.id, m['questionnaireSubmissionPage.validation_required']());
					}
				}
			});

			allFreeTextQuestions.forEach((q) => {
				if (q.is_mandatory) {
					const answer = freeTextAnswers.get(q.id);
					if (!answer || answer.trim().length === 0) {
						validationErrors.set(q.id, m['questionnaireSubmissionPage.validation_required']());
					}
				}
			});

			if (validationErrors.size > 0) {
				throw new Error(m['questionnaireSubmissionPage.validation_allRequired']());
			}

			// Build submission
			const submission = {
				questionnaire_id: data.questionnaire.id,
				multiple_choice_answers: Array.from(multipleChoiceAnswers.entries()).map(
					([question_id, options_id]) => ({
						question_id,
						options_id
					})
				),
				free_text_answers: Array.from(freeTextAnswers.entries())
					.filter(([, answer]) => answer.trim().length > 0)
					.map(([question_id, answer]) => ({
						question_id,
						answer: answer.trim()
					})),
				status: 'ready' as const
			};

			const { data: result, error } = await eventSubmitQuestionnaire({
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

	function handleMultipleChoiceChange(questionId: string, optionId: string, checked: boolean) {
		const question = allMultipleChoiceQuestions.find((q) => q.id === questionId);
		if (!question) return;

		const currentAnswers = multipleChoiceAnswers.get(questionId) || [];

		if (question.allow_multiple_answers) {
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

	function handleSubmit(e: Event) {
		e.preventDefault();
		submitMutation.mutate();
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
	</div>

	<!-- Form -->
	<form onsubmit={handleSubmit} class="space-y-8">
		<!-- Sections with questions -->
		{#if data.questionnaire.sections && data.questionnaire.sections.length > 0}
			{#each data.questionnaire.sections.sort((a, b) => a.order - b.order) as section (section.id)}
				<div class="rounded-lg border bg-card p-6">
					<h2 class="mb-6 text-xl font-semibold">{section.name}</h2>

					<div class="space-y-6">
						<!-- Multiple choice questions in section -->
						{#each (section.multiple_choice_questions || []).sort((a, b) => a.order - b.order) as question (question.id)}
							<div class="space-y-3">
								<Label class="text-base">
									{question.question}
									{#if question.is_mandatory}
										<span class="text-destructive">*</span>
									{/if}
								</Label>

								{#if question.allow_multiple_answers}
									<!-- Checkboxes for multiple answers -->
									<div class="space-y-2">
										{#each question.options || [] as option (option.id)}
											<div class="flex items-center space-x-2">
												<Checkbox
													id="{question.id}-{option.id}"
													checked={multipleChoiceAnswers.get(question.id)?.includes(option.id) ||
														false}
													onCheckedChange={(checked) =>
														handleMultipleChoiceChange(question.id, option.id, !!checked)}
												/>
												<label
													for="{question.id}-{option.id}"
													class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
												>
													{option.option}
												</label>
											</div>
										{/each}
									</div>
								{:else}
									<!-- Radio buttons for single answer -->
									<RadioGroup
										value={multipleChoiceAnswers.get(question.id)?.[0] || ''}
										onValueChange={(value: string) =>
											handleMultipleChoiceChange(question.id, value, true)}
									>
										{#each question.options || [] as option (option.id)}
											<div class="flex items-center space-x-2">
												<RadioGroupItem value={option.id} id="{question.id}-{option.id}" />
												<Label for="{question.id}-{option.id}">{option.option}</Label>
											</div>
										{/each}
									</RadioGroup>
								{/if}

								{#if validationErrors.has(question.id)}
									<p class="text-sm text-destructive">{validationErrors.get(question.id)}</p>
								{/if}
							</div>
						{/each}

						<!-- Free text questions in section -->
						{#each (section.free_text_questions || []).sort((a, b) => a.order - b.order) as question (question.id)}
							<div class="space-y-2">
								<Label for={question.id} class="text-base">
									{question.question}
									{#if question.is_mandatory}
										<span class="text-destructive">*</span>
									{/if}
								</Label>

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
						{/each}
					</div>
				</div>
			{/each}
		{/if}

		<!-- Root-level questions (no section) -->
		{#if (data.questionnaire.multiple_choice_questions && data.questionnaire.multiple_choice_questions.length > 0) || (data.questionnaire.free_text_questions && data.questionnaire.free_text_questions.length > 0)}
			<div class="space-y-6">
				<!-- Root multiple choice questions -->
				{#each (data.questionnaire.multiple_choice_questions || []).sort((a, b) => a.order - b.order) as question (question.id)}
					<div class="space-y-3 rounded-lg border bg-card p-6">
						<Label class="text-base">
							{question.question}
							{#if question.is_mandatory}
								<span class="text-destructive">*</span>
							{/if}
						</Label>

						{#if question.allow_multiple_answers}
							<div class="space-y-2">
								{#each question.options || [] as option (option.id)}
									<div class="flex items-center space-x-2">
										<Checkbox
											id="{question.id}-{option.id}"
											checked={multipleChoiceAnswers.get(question.id)?.includes(option.id) || false}
											onCheckedChange={(checked) =>
												handleMultipleChoiceChange(question.id, option.id, !!checked)}
										/>
										<label
											for="{question.id}-{option.id}"
											class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
										>
											{option.option}
										</label>
									</div>
								{/each}
							</div>
						{:else}
							<RadioGroup
								value={multipleChoiceAnswers.get(question.id)?.[0] || ''}
								onValueChange={(value: string) =>
									handleMultipleChoiceChange(question.id, value, true)}
							>
								{#each question.options || [] as option (option.id)}
									<div class="flex items-center space-x-2">
										<RadioGroupItem value={option.id} id="{question.id}-{option.id}" />
										<Label for="{question.id}-{option.id}">{option.option}</Label>
									</div>
								{/each}
							</RadioGroup>
						{/if}

						{#if validationErrors.has(question.id)}
							<p class="text-sm text-destructive">{validationErrors.get(question.id)}</p>
						{/if}
					</div>
				{/each}

				<!-- Root free text questions -->
				{#each (data.questionnaire.free_text_questions || []).sort((a, b) => a.order - b.order) as question (question.id)}
					<div class="space-y-2 rounded-lg border bg-card p-6">
						<Label for={question.id} class="text-base">
							{question.question}
							{#if question.is_mandatory}
								<span class="text-destructive">*</span>
							{/if}
						</Label>

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
