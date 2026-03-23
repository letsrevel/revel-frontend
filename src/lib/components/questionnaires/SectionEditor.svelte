<script lang="ts">
	import { Card, CardContent, CardHeader } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { ArrowUp, ArrowDown, Trash2, Plus, ChevronDown, ChevronUp, Upload } from 'lucide-svelte';
	import MarkdownEditor from '$lib/components/forms/MarkdownEditor.svelte';
	import QuestionEditor from './QuestionEditor.svelte';

	interface Question {
		id: string;
		type: 'multiple_choice' | 'free_text' | 'file_upload';
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
		// For file upload
		allowedMimeTypes?: string[];
		maxFileSize?: number;
		maxFiles?: number;
	}

	interface Section {
		id: string;
		name: string;
		description?: string;
		order: number;
		questions: Question[];
	}

	interface Props {
		section: Section;
		onUpdate: (updates: Partial<Section>) => void;
		onRemove: () => void;
		onMoveUp?: () => void;
		onMoveDown?: () => void;
		isFirst?: boolean;
		isLast?: boolean;
		onAddQuestion: (type: 'multiple_choice' | 'free_text' | 'file_upload') => void;
		onUpdateQuestion: (questionId: string, updates: Partial<Question>) => void;
		onRemoveQuestion: (questionId: string) => void;
		onMoveQuestionUp: (index: number) => void;
		onMoveQuestionDown: (index: number) => void;
		showLlmGuidelines?: boolean;
	}

	const {
		section,
		onUpdate,
		onRemove,
		onMoveUp,
		onMoveDown,
		isFirst = false,
		isLast = false,
		onAddQuestion,
		onUpdateQuestion,
		onRemoveQuestion,
		onMoveQuestionUp,
		onMoveQuestionDown,
		showLlmGuidelines = true
	}: Props = $props();

	// Collapsible state
	let isExpanded = $state(true);
</script>

<Card class="border-2 border-dashed border-primary/30">
	<CardHeader class="pb-3">
		<div class="flex items-start gap-3">
			<!-- Move section up/down -->
			<div class="flex flex-col gap-0.5 pt-1">
				<button
					type="button"
					onclick={onMoveUp}
					disabled={isFirst}
					class="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
					aria-label="Move section up"
				>
					<ArrowUp class="h-4 w-4" aria-hidden="true" />
				</button>
				<button
					type="button"
					onclick={onMoveDown}
					disabled={isLast}
					class="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
					aria-label="Move section down"
				>
					<ArrowDown class="h-4 w-4" aria-hidden="true" />
				</button>
			</div>

			<div class="flex-1 space-y-3">
				<!-- Section header row -->
				<div class="flex items-center gap-3">
					<div class="flex-1">
						<Input
							value={section.name}
							oninput={(e) => onUpdate({ name: e.currentTarget.value })}
							placeholder="Section name..."
							class="text-lg font-semibold"
						/>
					</div>

					<Button
						variant="ghost"
						size="sm"
						onclick={() => (isExpanded = !isExpanded)}
						class="gap-1"
					>
						{#if isExpanded}
							<ChevronUp class="h-4 w-4" />
							Collapse
						{:else}
							<ChevronDown class="h-4 w-4" />
							Expand ({section.questions.length})
						{/if}
					</Button>

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
			</div>
		</div>
	</CardHeader>

	{#if isExpanded}
		<CardContent class="space-y-4">
			<!-- Section description (markdown) -->
			<MarkdownEditor
				id="section-desc-{section.id}"
				label="Section Description (optional)"
				value={section.description || ''}
				onValueChange={(v) => onUpdate({ description: v || undefined })}
				placeholder="Instructions or context shown to users at the start of this section..."
				rows={2}
			/>

			<!-- Questions in this section -->
			<div class="space-y-4">
				<div class="flex items-center justify-between border-t pt-4">
					<Label class="text-base font-medium">
						Questions ({section.questions.length})
					</Label>
					<div class="flex gap-2">
						<Button
							variant="outline"
							size="sm"
							onclick={() => onAddQuestion('multiple_choice')}
							class="gap-2"
						>
							<Plus class="h-4 w-4" />
							Multiple Choice
						</Button>
						<Button
							variant="outline"
							size="sm"
							onclick={() => onAddQuestion('free_text')}
							class="gap-2"
						>
							<Plus class="h-4 w-4" />
							Free Text
						</Button>
						<Button
							variant="outline"
							size="sm"
							onclick={() => onAddQuestion('file_upload')}
							class="gap-2"
						>
							<Upload class="h-4 w-4" />
							File Upload
						</Button>
					</div>
				</div>

				<!-- Questions list -->
				<div class="space-y-4 pl-4">
					{#each section.questions as question, index (question.id)}
						<QuestionEditor
							{question}
							onUpdate={(updates) => onUpdateQuestion(question.id, updates)}
							onRemove={() => onRemoveQuestion(question.id)}
							onMoveUp={() => onMoveQuestionUp?.(index)}
							onMoveDown={() => onMoveQuestionDown?.(index)}
							isFirst={index === 0}
							isLast={index === section.questions.length - 1}
							{showLlmGuidelines}
						/>
					{/each}
				</div>

				{#if section.questions.length === 0}
					<div class="rounded-lg border border-dashed p-6 text-center">
						<p class="text-sm text-muted-foreground">
							No questions yet. Add questions using the buttons above.
						</p>
					</div>
				{/if}

				<!-- Bottom add buttons -->
				{#if section.questions.length > 0}
					<div class="flex justify-center gap-2 border-t pt-4">
						<Button
							variant="outline"
							size="sm"
							onclick={() => onAddQuestion('multiple_choice')}
							class="gap-2"
						>
							<Plus class="h-4 w-4" />
							Multiple Choice
						</Button>
						<Button
							variant="outline"
							size="sm"
							onclick={() => onAddQuestion('free_text')}
							class="gap-2"
						>
							<Plus class="h-4 w-4" />
							Free Text
						</Button>
						<Button
							variant="outline"
							size="sm"
							onclick={() => onAddQuestion('file_upload')}
							class="gap-2"
						>
							<Upload class="h-4 w-4" />
							File Upload
						</Button>
					</div>
				{/if}
			</div>
		</CardContent>
	{/if}
</Card>
