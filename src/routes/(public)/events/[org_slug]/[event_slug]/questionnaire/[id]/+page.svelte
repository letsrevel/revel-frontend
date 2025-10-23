<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import { createMutation } from '@tanstack/svelte-query';
	import { eventSubmitQuestionnaire } from '$lib/api/generated';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { RadioGroup, RadioGroupItem } from '$lib/components/ui/radio-group';
	import { ArrowLeft, Check, Loader2, AlertCircle } from 'lucide-svelte';
	import { cn } from '$lib/utils/cn';
	import { toast } from 'svelte-sonner';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	// Form state
	let multipleChoiceAnswers = $state<Map<string, string[]>>(new Map());
	let freeTextAnswers = $state<Map<string, string>>(new Map());
	let validationErrors = $state<Map<string, string>>(new Map());

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
			const errors = new Map<string, string>();

			allMultipleChoiceQuestions.forEach((q) => {
				if (q.is_mandatory) {
					const answers = multipleChoiceAnswers.get(q.id);
					if (!answers || answers.length === 0) {
						errors.set(q.id, 'This question is required');
					}
				}
			});

			allFreeTextQuestions.forEach((q) => {
				if (q.is_mandatory) {
					const answer = freeTextAnswers.get(q.id);
					if (!answer || answer.trim().length === 0) {
						errors.set(q.id, 'This question is required');
					}
				}
			});

			if (errors.size > 0) {
				validationErrors = errors;
				throw new Error('Please answer all required questions');
			}

			validationErrors = new Map();

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
				throw new Error('Failed to submit questionnaire. Please try again.');
			}

			return result;
		},
		onSuccess: (result) => {
			// Check if it's an evaluation response (has status field)
			if ('status' in result) {
				if (result.status === 'approved') {
					toast.success('Questionnaire Approved!', {
						description: 'Your submission has been approved. You can now RSVP to the event.'
					});
				} else if (result.status === 'pending review') {
					toast.info('Submission Under Review', {
						description: 'Your responses are being reviewed by the organizers.'
					});
				} else if (result.status === 'rejected') {
					toast.error('Submission Not Approved', {
						description:
							'Your submission did not meet the requirements. You may be able to try again later.'
					});
				}
			} else {
				// Simple submission response
				toast.success('Questionnaire Submitted!', {
					description: 'Your responses have been submitted successfully.'
				});
			}

			// Redirect back to event page
			setTimeout(() => {
				goto(`/events/${data.event.organization.slug}/${data.event.slug}`);
			}, 2000);
		},
		onError: (error: Error) => {
			toast.error('Submission Failed', {
				description: error.message || 'An error occurred while submitting the questionnaire.'
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
		if (validationErrors.has(questionId)) {
			const newErrors = new Map(validationErrors);
			newErrors.delete(questionId);
			validationErrors = newErrors;
		}
	}

	function handleFreeTextChange(questionId: string, value: string) {
		freeTextAnswers.set(questionId, value);

		// Clear validation error
		if (validationErrors.has(questionId)) {
			const newErrors = new Map(validationErrors);
			newErrors.delete(questionId);
			validationErrors = newErrors;
		}
	}

	function handleSubmit(e: Event) {
		e.preventDefault();
		submitMutation.mutate();
	}
</script>

<svelte:head>
	<title>{data.questionnaire.name} - {data.event.name}</title>
</svelte:head>

<div class="container mx-auto max-w-3xl px-4 py-8">
	<!-- Header -->
	<div class="mb-8">
		<a
			href="/events/{data.event.organization.slug}/{data.event.slug}"
			class="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
		>
			<ArrowLeft class="h-4 w-4" />
			Back to Event
		</a>
		<h1 class="text-3xl font-bold">{data.questionnaire.name}</h1>
		<p class="mt-2 text-muted-foreground">
			Complete this questionnaire to RSVP to <span class="font-semibold">{data.event.name}</span>
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
										onValueChange={(value) => handleMultipleChoiceChange(question.id, value, true)}
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
								<Textarea
									id={question.id}
									value={freeTextAnswers.get(question.id) || ''}
									oninput={(e) => handleFreeTextChange(question.id, e.currentTarget.value)}
									placeholder="Type your answer here..."
									class={cn(validationErrors.has(question.id) && 'border-destructive')}
									rows={4}
									maxlength={500}
								/>
								<p class="text-xs text-muted-foreground">
									{(freeTextAnswers.get(question.id) || '').length}/500 characters
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
								onValueChange={(value) => handleMultipleChoiceChange(question.id, value, true)}
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
						<Textarea
							id={question.id}
							value={freeTextAnswers.get(question.id) || ''}
							oninput={(e) => handleFreeTextChange(question.id, e.currentTarget.value)}
							placeholder="Type your answer here..."
							class={cn(validationErrors.has(question.id) && 'border-destructive')}
							rows={4}
							maxlength={500}
						/>
						<p class="text-xs text-muted-foreground">
							{(freeTextAnswers.get(question.id) || '').length}/500 characters
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
				Cancel
			</Button>
			<Button type="submit" disabled={submitMutation.isPending}>
				{#if submitMutation.isPending}
					<Loader2 class="h-5 w-5 animate-spin" />
					Submitting...
				{:else if submitMutation.isSuccess}
					<Check class="h-5 w-5" />
					Submitted
				{:else}
					Submit Questionnaire
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
					<p class="font-semibold">Submission Failed</p>
					<p class="mt-1 text-sm">
						{submitMutation.error?.message || 'An error occurred. Please try again.'}
					</p>
				</div>
			</div>
		{/if}
	</form>
</div>
