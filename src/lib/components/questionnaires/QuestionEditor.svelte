<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Card, CardContent } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { GripVertical, Trash2, Plus, X, ChevronDown, ChevronUp } from 'lucide-svelte';
	import { Badge } from '$lib/components/ui/badge';
	import MarkdownEditor from '$lib/components/forms/MarkdownEditor.svelte';

	interface Question {
		id: string;
		type: 'multiple_choice' | 'free_text';
		text: string;
		hint?: string;
		reviewerNotes?: string;
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

	// Collapsible sections state
	let showAdvanced = $state(false);

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

					<!-- Question text (markdown) -->
					<MarkdownEditor
						id="question-{question.id}"
						label="Question Text (Markdown)"
						value={question.text}
						onValueChange={(v) => onUpdate({ text: v })}
						placeholder="Enter your question here... Supports **bold**, *italic*, [links](url), and lists."
						rows={3}
						required={true}
					/>

					<!-- Hint (markdown) - optional help text shown to users -->
					<MarkdownEditor
						id="hint-{question.id}"
						label="Hint (optional)"
						value={question.hint || ''}
						onValueChange={(v) => onUpdate({ hint: v || undefined })}
						placeholder="Additional context or help shown to users below the question..."
						rows={2}
					/>

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

					<!-- Advanced Settings (collapsible) -->
					<div class="border-t pt-4">
						<button
							type="button"
							class="flex w-full items-center justify-between text-sm font-medium text-muted-foreground hover:text-foreground"
							onclick={() => (showAdvanced = !showAdvanced)}
						>
							<span>Advanced Settings</span>
							{#if showAdvanced}
								<ChevronUp class="h-4 w-4" />
							{:else}
								<ChevronDown class="h-4 w-4" />
							{/if}
						</button>

						{#if showAdvanced}
							<div class="mt-4 space-y-4">
								<!-- Reviewer Notes (markdown) - not shown to users -->
								<MarkdownEditor
									id="reviewer-notes-{question.id}"
									label="Reviewer Notes (internal)"
									value={question.reviewerNotes || ''}
									onValueChange={(v) => onUpdate({ reviewerNotes: v || undefined })}
									placeholder="Internal notes for staff reviewing submissions. Not shown to users."
									rows={2}
								/>

								<!-- Scoring weights -->
								<div class="grid gap-4 sm:grid-cols-2">
									<div class="space-y-2">
										<Label for="positive-weight-{question.id}">Positive Weight</Label>
										<Input
											id="positive-weight-{question.id}"
											type="number"
											value={question.positiveWeight}
											oninput={(e) =>
												onUpdate({ positiveWeight: parseFloat(e.currentTarget.value) || 0 })}
											min="0"
											max="100"
											step="0.1"
										/>
										<p class="text-xs text-muted-foreground">Points added for correct answer</p>
									</div>
									<div class="space-y-2">
										<Label for="negative-weight-{question.id}">Negative Weight</Label>
										<Input
											id="negative-weight-{question.id}"
											type="number"
											value={question.negativeWeight}
											oninput={(e) =>
												onUpdate({ negativeWeight: parseFloat(e.currentTarget.value) || 0 })}
											min="0"
											max="100"
											step="0.1"
										/>
										<p class="text-xs text-muted-foreground">Points deducted for wrong answer</p>
									</div>
								</div>

								<!-- Fatal question toggle -->
								<div class="flex items-center space-x-2">
									<Checkbox
										id="fatal-{question.id}"
										checked={question.isFatal}
										onCheckedChange={(checked) => onUpdate({ isFatal: checked === true })}
									/>
									<Label
										for="fatal-{question.id}"
										class="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
									>
										Fatal question (wrong answer = automatic rejection)
									</Label>
								</div>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</CardContent>
</Card>
