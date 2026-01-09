<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Card } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Check, CornerDownRight } from 'lucide-svelte';
	import type { QuestionAnswerDetailSchema } from '$lib/api/generated';
	import MarkdownContent from '$lib/components/common/MarkdownContent.svelte';

	interface MultipleChoiceAnswerContent {
		option_id: string;
		option_text: string;
		is_correct?: boolean;
	}

	interface FreeTextAnswerContent {
		answer: string;
	}

	interface Props {
		answers: QuestionAnswerDetailSchema[];
	}

	let { answers }: Props = $props();

	// Check if a question is conditional (has depends_on_option_id)
	function isConditionalQuestion(answer: QuestionAnswerDetailSchema): boolean {
		// The answer schema should include depends_on_option_id if the question is conditional
		return !!(answer as { depends_on_option_id?: string | null }).depends_on_option_id;
	}

	function formatAnswer(answer: QuestionAnswerDetailSchema): string {
		const content = answer.answer_content;

		if (!Array.isArray(content) || content.length === 0) {
			return 'No answer provided';
		}

		if (answer.question_type === 'free_text') {
			const freeTextContent = content[0] as unknown as FreeTextAnswerContent;
			return freeTextContent.answer || 'No answer provided';
		}

		if (answer.question_type === 'multiple_choice') {
			const options = content as unknown as MultipleChoiceAnswerContent[];
			const optionTexts = options.map((opt) => opt.option_text).filter(Boolean);
			return optionTexts.length > 0
				? optionTexts.join(', ')
				: m['questionAnswerDisplay.noOptionSelected']();
		}

		return m['questionAnswerDisplay.unknownAnswerFormat']();
	}

	function getSelectedOptions(answer: QuestionAnswerDetailSchema): MultipleChoiceAnswerContent[] {
		if (
			answer.question_type === 'multiple_choice' &&
			Array.isArray(answer.answer_content) &&
			answer.answer_content.length > 0
		) {
			return answer.answer_content as unknown as MultipleChoiceAnswerContent[];
		}
		return [];
	}
</script>

<!--
  Question Answer Display Component

  Displays a question and its corresponding answer from a questionnaire submission.
  Handles both free text and multiple choice question types.

  @component
  @example
  <QuestionAnswerDisplay answers={submissionAnswers} />
-->
<div class="space-y-4">
	{#each answers as answer (answer.question_id)}
		{@const isConditional = isConditionalQuestion(answer)}
		<Card class="p-4 {isConditional ? 'border-l-2 border-l-primary/50 bg-primary/5' : ''}">
			<div class="space-y-3">
				<!-- Question Text -->
				<div class="flex items-start gap-2">
					{#if isConditional}
						<CornerDownRight class="mt-0.5 h-4 w-4 shrink-0 text-primary/60" aria-hidden="true" />
					{/if}
					<Badge variant={isConditional ? 'secondary' : 'outline'} class="shrink-0">
						{answer.question_type === 'multiple_choice' ? 'Multiple Choice' : 'Free Text'}
					</Badge>
					{#if isConditional}
						<Badge variant="outline" class="shrink-0 text-xs">Conditional</Badge>
					{/if}
					<div class="flex-1">
						<MarkdownContent
							content={answer.question_text}
							class="text-base font-medium leading-tight"
						/>
					</div>
				</div>

				<!-- Answer Content -->
				<div class="pl-0 md:pl-4">
					{#if answer.question_type === 'free_text'}
						<div class="rounded-md bg-muted/50 p-3">
							<p class="whitespace-pre-wrap text-sm">{formatAnswer(answer)}</p>
						</div>
					{:else if answer.question_type === 'multiple_choice'}
						{@const selectedOptions = getSelectedOptions(answer)}
						{#if selectedOptions.length > 0}
							<div class="space-y-2">
								{#each selectedOptions as option (option.option_id)}
									<div class="flex items-center gap-2 text-sm">
										<div
											class="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10"
										>
											<Check class="h-3 w-3 text-primary" aria-hidden="true" />
										</div>
										<span>{option.option_text}</span>
										{#if option.is_correct !== undefined}
											<Badge variant={option.is_correct ? 'default' : 'secondary'} class="ml-2">
												{option.is_correct ? 'Correct' : 'Incorrect'}
											</Badge>
										{/if}
									</div>
								{/each}
							</div>
						{:else}
							<p class="text-sm italic text-muted-foreground">
								{m['questionAnswerDisplay.noOptionSelected']()}
							</p>
						{/if}
					{:else}
						<p class="text-sm italic text-muted-foreground">
							{m['questionAnswerDisplay.unknownAnswerFormat']()}
						</p>
					{/if}
				</div>
			</div>
		</Card>
	{/each}
</div>
