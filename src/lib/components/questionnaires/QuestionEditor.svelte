<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Card, CardContent } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { GripVertical, Trash2, Plus, X } from 'lucide-svelte';
	import { Badge } from '$lib/components/ui/badge';

	interface Question {
		id: string;
		type: 'multiple_choice' | 'free_text';
		text: string;
		required: boolean;
		order: number;
		positiveWeight: number;
		negativeWeight: number;
		isFatal: boolean;
		// For multiple choice
		options?: Array<{ text: string; isCorrect: boolean }>;
		allowMultipleAnswers?: boolean;
		shuffleOptions?: boolean;
		// For free text
		llmGuidelines?: string;
	}

	interface Props {
		question: Question;
		onUpdate: (updates: Partial<Question>) => void;
		onRemove: () => void;
	}

	let { question, onUpdate, onRemove }: Props = $props();

	// Add option to multiple choice
	function addOption() {
		if (question.type === 'multiple_choice') {
			const newOptions = [...(question.options || []), { text: '', isCorrect: false }];
			onUpdate({ options: newOptions });
		}
	}

	// Remove option from multiple choice
	function removeOption(index: number) {
		if (question.type === 'multiple_choice' && question.options) {
			const newOptions = question.options.filter((_, i) => i !== index);
			onUpdate({ options: newOptions });
		}
	}

	// Update option text
	function updateOption(index: number, text: string) {
		if (question.type === 'multiple_choice' && question.options) {
			const newOptions = [...question.options];
			newOptions[index] = { ...newOptions[index], text };
			onUpdate({ options: newOptions });
		}
	}

	// Update option isCorrect
	function updateOptionCorrect(index: number, isCorrect: boolean) {
		if (question.type === 'multiple_choice' && question.options) {
			const newOptions = [...question.options];
			newOptions[index] = { ...newOptions[index], isCorrect };
			onUpdate({ options: newOptions });
		}
	}
</script>

<Card>
	<CardContent class="pt-6">
		<div class="space-y-4">
			<!-- Header -->
			<div class="flex items-start gap-3">
				<div class="cursor-grab pt-2">
					<GripVertical class="h-5 w-5 text-muted-foreground" aria-hidden="true" />
				</div>

				<div class="flex-1 space-y-4">
					<!-- Question type badge -->
					<div class="flex items-center justify-between">
						<Badge variant="outline">
							{question.type === 'multiple_choice' ? 'Multiple Choice' : 'Free Text'}
						</Badge>
						<Button
							variant="ghost"
							size="sm"
							onclick={onRemove}
							class="gap-2 text-destructive hover:text-destructive"
						>
							<Trash2 class="h-4 w-4" />
							Remove
						</Button>
					</div>

					<!-- Question text -->
					<div class="space-y-2">
						<Label for="question-{question.id}">
							Question Text
							{#if question.required}
								<span class="text-destructive">*</span>
							{/if}
						</Label>
						<Textarea
							id="question-{question.id}"
							value={question.text}
							oninput={(e) => onUpdate({ text: e.currentTarget.value })}
							placeholder="Enter your question here..."
							rows={2}
						/>
					</div>

					<!-- Required toggle -->
					<div class="flex items-center space-x-2">
						<Checkbox
							id="required-{question.id}"
							checked={question.required}
							onCheckedChange={(checked) => onUpdate({ required: checked === true })}
						/>
						<Label
							for="required-{question.id}"
							class="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
						>
							Required question
						</Label>
					</div>

					<!-- Multiple Choice Options -->
					{#if question.type === 'multiple_choice'}
						<div class="space-y-2">
							<div class="flex items-center justify-between">
								<Label>{m['questionEditor.answerOptions']()}</Label>
								<p class="text-xs text-muted-foreground">{m['questionEditor.checkBoxes']()}</p>
							</div>
							<div class="space-y-2">
								{#each question.options || [] as option, index (index)}
									<div class="flex items-center gap-2">
										<Checkbox
											checked={option.isCorrect}
											onCheckedChange={(checked) => updateOptionCorrect(index, checked === true)}
											title="Mark as correct answer"
										/>
										<Input
											value={option.text}
											oninput={(e) => updateOption(index, e.currentTarget.value)}
											placeholder="Option {index + 1}"
											class="flex-1"
										/>
										{#if (question.options?.length || 0) > 2}
											<Button
												variant="ghost"
												size="icon"
												onclick={() => removeOption(index)}
												class="flex-shrink-0"
											>
												<X class="h-4 w-4" />
												<span class="sr-only">{m['questionEditor.removeOption']()} {index + 1}</span
												>
											</Button>
										{/if}
									</div>
								{/each}
							</div>
							<Button variant="outline" size="sm" onclick={addOption} class="gap-2">
								<Plus class="h-4 w-4" />
								Add Option
							</Button>
						</div>

						<!-- Multiple Choice Settings -->
						<div class="space-y-2">
							<Label>{m['questionEditor.questionSettings']()}</Label>
							<div class="space-y-2">
								<div class="flex items-center space-x-2">
									<Checkbox
										id="multiple-{question.id}"
										checked={question.allowMultipleAnswers}
										onCheckedChange={(checked) =>
											onUpdate({ allowMultipleAnswers: checked === true })}
									/>
									<Label
										for="multiple-{question.id}"
										class="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
									>
										Allow multiple answers
									</Label>
								</div>
								<div class="flex items-center space-x-2">
									<Checkbox
										id="shuffle-{question.id}"
										checked={question.shuffleOptions}
										onCheckedChange={(checked) => onUpdate({ shuffleOptions: checked === true })}
									/>
									<Label
										for="shuffle-{question.id}"
										class="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
									>
										Shuffle answer options for each user
									</Label>
								</div>
							</div>
						</div>
					{/if}

					<!-- Free Text Settings -->
					{#if question.type === 'free_text'}
						<div class="space-y-2">
							<Label for="llm-guidelines-{question.id}">{m['questionEditor.llmGuidelines']()}</Label
							>
							<Textarea
								id="llm-guidelines-{question.id}"
								value={question.llmGuidelines || ''}
								oninput={(e) => onUpdate({ llmGuidelines: e.currentTarget.value })}
								placeholder="Specific instructions for AI evaluation of this question..."
								rows={3}
							/>
							<p class="text-xs text-muted-foreground">
								Optional question-specific guidelines for AI evaluation
							</p>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</CardContent>
</Card>
