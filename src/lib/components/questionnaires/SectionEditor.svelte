<script lang="ts">
	import { Card, CardContent, CardHeader } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { GripVertical, Trash2, Plus, ChevronDown, ChevronUp } from 'lucide-svelte';
	import MarkdownEditor from '$lib/components/forms/MarkdownEditor.svelte';
	import QuestionEditor from './QuestionEditor.svelte';
	import { dndzone, SHADOW_PLACEHOLDER_ITEM_ID } from 'svelte-dnd-action';
	import { flip } from 'svelte/animate';

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
		onAddQuestion: (type: 'multiple_choice' | 'free_text') => void;
		onUpdateQuestion: (questionId: string, updates: Partial<Question>) => void;
		onRemoveQuestion: (questionId: string) => void;
		onQuestionsReorder: (questions: Question[]) => void;
		dropTargetStyle?: Record<string, string>;
	}

	let {
		section,
		onUpdate,
		onRemove,
		onAddQuestion,
		onUpdateQuestion,
		onRemoveQuestion,
		onQuestionsReorder,
		dropTargetStyle = { outline: '2px dashed hsl(var(--primary))', borderRadius: '8px' }
	}: Props = $props();

	// Collapsible state
	let isExpanded = $state(true);

	// DnD flip duration
	const flipDurationMs = 200;

	// Handle drag and drop for questions
	function handleDndConsider(e: CustomEvent<{ items: Question[] }>) {
		// Update the section's questions during drag
		onQuestionsReorder(e.detail.items);
	}

	function handleDndFinalize(e: CustomEvent<{ items: Question[] }>) {
		// Finalize the reorder and update order values
		const reorderedQuestions = e.detail.items
			.filter((q) => q.id !== SHADOW_PLACEHOLDER_ITEM_ID)
			.map((q, index) => ({ ...q, order: index }));
		onQuestionsReorder(reorderedQuestions);
	}
</script>

<Card class="border-2 border-dashed border-primary/30">
	<CardHeader class="pb-3">
		<div class="flex items-start gap-3">
			<!-- Drag handle for section -->
			<div class="section-drag-handle cursor-grab pt-2" aria-label="Drag to reorder section">
				<GripVertical class="h-5 w-5 text-muted-foreground" aria-hidden="true" />
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
					</div>
				</div>

				<!-- Drag and drop zone for questions -->
				<div
					class="min-h-[80px] space-y-4 rounded-lg pl-4"
					use:dndzone={{
						items: section.questions,
						flipDurationMs,
						dropTargetStyle,
						type: 'questions'
					}}
					onconsider={handleDndConsider}
					onfinalize={handleDndFinalize}
				>
					{#each section.questions.filter((q) => q.id !== SHADOW_PLACEHOLDER_ITEM_ID) as question (question.id)}
						<div animate:flip={{ duration: flipDurationMs }}>
							<QuestionEditor
								{question}
								onUpdate={(updates) => onUpdateQuestion(question.id, updates)}
								onRemove={() => onRemoveQuestion(question.id)}
							/>
						</div>
					{/each}
				</div>

				{#if section.questions.length === 0}
					<div class="rounded-lg border border-dashed p-6 text-center">
						<p class="text-sm text-muted-foreground">
							No questions yet. Add questions or drag them here from another section.
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
					</div>
				{/if}
			</div>
		</CardContent>
	{/if}
</Card>
