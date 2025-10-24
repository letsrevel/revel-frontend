<script lang="ts">
	import { Card } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Check } from 'lucide-svelte';

	interface MultipleChoiceAnswerContent {
		option_id: string;
		option_text: string;
		is_correct?: boolean;
	}

	interface FreeTextAnswerContent {
		answer: string;
	}

	interface Answer {
		question_id: string;
		question_text: string;
		question_type: string;
		answer_content: (MultipleChoiceAnswerContent | FreeTextAnswerContent)[];
	}

	interface Props {
		answers: Answer[];
	}

	let { answers }: Props = $props();

	function formatAnswer(answer: Answer): string {
		const content = answer.answer_content;

		if (!Array.isArray(content) || content.length === 0) {
			return 'No answer provided';
		}

		if (answer.question_type === 'free_text') {
			const freeTextContent = content[0] as FreeTextAnswerContent;
			return freeTextContent.answer || 'No answer provided';
		}

		if (answer.question_type === 'multiple_choice') {
			const options = content as MultipleChoiceAnswerContent[];
			const optionTexts = options.map((opt) => opt.option_text).filter(Boolean);
			return optionTexts.length > 0 ? optionTexts.join(', ') : 'No option selected';
		}

		return 'Unknown answer format';
	}

	function getSelectedOptions(answer: Answer): MultipleChoiceAnswerContent[] {
		if (
			answer.question_type === 'multiple_choice' &&
			Array.isArray(answer.answer_content) &&
			answer.answer_content.length > 0
		) {
			return answer.answer_content as MultipleChoiceAnswerContent[];
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
		<Card class="p-4">
			<div class="space-y-3">
				<!-- Question Text -->
				<div class="flex items-start gap-2">
					<Badge variant="outline" class="shrink-0">
						{answer.question_type === 'multiple_choice' ? 'Multiple Choice' : 'Free Text'}
					</Badge>
					<h3 class="text-base font-medium leading-tight">{answer.question_text}</h3>
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
							<p class="text-sm italic text-muted-foreground">No option selected</p>
						{/if}
					{:else}
						<p class="text-sm italic text-muted-foreground">Unknown answer format</p>
					{/if}
				</div>
			</div>
		</Card>
	{/each}
</div>
