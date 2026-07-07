<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import {
		X,
		ChevronDown,
		ChevronUp,
		FileText,
		ListChecks,
		FolderPlus,
		Upload
	} from '@lucide/svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { slide } from 'svelte/transition';
	import QuestionEditor from './QuestionEditor.svelte';

	// Conditional section type (shown when option is selected)
	interface ConditionalSection {
		id: string;
		name: string;
		description?: string;
		order: number;
		questions: Question[];
	}

	interface Option {
		id: string;
		text: string;
		isCorrect: boolean;
		conditionalQuestions?: Question[];
		conditionalSections?: ConditionalSection[];
	}

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
		options?: Option[];
		allowMultipleAnswers?: boolean;
		shuffleOptions?: boolean;
		llmGuidelines?: string;
		allowedMimeTypes?: string[];
		maxFileSize?: number;
		maxFiles?: number;
	}

	interface Props {
		option: Option;
		index: number;
		isNested: boolean;
		isExpanded: boolean;
		canRemove: boolean;
		showLlmGuidelines?: boolean;
		onUpdateText: (text: string) => void;
		onUpdateCorrect: (isCorrect: boolean) => void;
		onRemove: () => void;
		onToggleExpanded: () => void;
		onAddConditionalQuestion: (type: 'multiple_choice' | 'free_text' | 'file_upload') => void;
		onUpdateConditionalQuestion: (questionIndex: number, updates: Partial<Question>) => void;
		onRemoveConditionalQuestion: (questionIndex: number) => void;
		onAddConditionalSection: () => void;
		onUpdateConditionalSection: (
			sectionIndex: number,
			updates: Partial<ConditionalSection>
		) => void;
		onRemoveConditionalSection: (sectionIndex: number) => void;
		onAddQuestionToSection: (
			sectionIndex: number,
			type: 'multiple_choice' | 'free_text' | 'file_upload'
		) => void;
		onUpdateQuestionInSection: (
			sectionIndex: number,
			questionIndex: number,
			updates: Partial<Question>
		) => void;
		onRemoveQuestionFromSection: (sectionIndex: number, questionIndex: number) => void;
	}

	const {
		option,
		index,
		isNested,
		isExpanded,
		canRemove,
		showLlmGuidelines = true,
		onUpdateText,
		onUpdateCorrect,
		onRemove,
		onToggleExpanded,
		onAddConditionalQuestion,
		onUpdateConditionalQuestion,
		onRemoveConditionalQuestion,
		onAddConditionalSection,
		onUpdateConditionalSection,
		onRemoveConditionalSection,
		onAddQuestionToSection,
		onUpdateQuestionInSection,
		onRemoveQuestionFromSection
	}: Props = $props();

	// Check if option has conditional content (questions or sections)
	const hasConditionals = $derived(
		(option.conditionalQuestions?.length || 0) > 0 || (option.conditionalSections?.length || 0) > 0
	);

	// Get total count of conditional items for an option
	const conditionalsCount = $derived(
		(option.conditionalQuestions?.length || 0) + (option.conditionalSections?.length || 0)
	);
</script>

<div class="space-y-2 rounded-md border p-3">
	<div class="flex items-center gap-2">
		<Checkbox
			checked={option.isCorrect}
			onCheckedChange={(checked) => onUpdateCorrect(checked === true)}
			title={m['optionEditor.markAsCorrect']()}
		/>
		<Input
			value={option.text}
			oninput={(e) => onUpdateText(e.currentTarget.value)}
			placeholder={m['optionEditor.optionPlaceholder']({ number: index + 1 })}
			class="flex-1"
		/>
		{#if !isNested}
			<Button
				variant="ghost"
				size="sm"
				onclick={onToggleExpanded}
				class="gap-1 text-xs"
				title={m['optionEditor.addConditionalQuestions']()}
			>
				{#if isExpanded}
					<ChevronUp class="h-4 w-4" />
				{:else}
					<ChevronDown class="h-4 w-4" />
				{/if}
				{#if hasConditionals}
					<Badge variant="secondary" class="text-xs">
						{conditionalsCount}
					</Badge>
				{/if}
			</Button>
		{/if}
		{#if canRemove}
			<Button variant="ghost" size="icon" onclick={onRemove} class="flex-shrink-0">
				<X class="h-4 w-4" />
				<span class="sr-only">{m['questionEditor.removeOption']()} {index + 1}</span>
			</Button>
		{/if}
	</div>

	<!-- Conditional content for this option (only for non-nested questions) -->
	{#if !isNested && isExpanded}
		<div transition:slide={{ duration: 200 }} class="mt-3 space-y-4 border-t pt-3">
			<div class="flex items-center justify-between">
				<Label class="text-sm text-muted-foreground">
					{m['optionEditor.conditionalContentLabel']()}
				</Label>
				<div class="flex gap-1">
					<Button
						variant="outline"
						size="sm"
						onclick={() => onAddConditionalQuestion('multiple_choice')}
						class="gap-1 text-xs"
						title={m['optionEditor.addMultipleChoiceQuestion']()}
					>
						<ListChecks class="h-3 w-3" />
						{m['optionEditor.mcAbbrev']()}
					</Button>
					<Button
						variant="outline"
						size="sm"
						onclick={() => onAddConditionalQuestion('free_text')}
						class="gap-1 text-xs"
						title={m['optionEditor.addFreeTextQuestion']()}
					>
						<FileText class="h-3 w-3" />
						{m['optionEditor.ftAbbrev']()}
					</Button>
					<Button
						variant="outline"
						size="sm"
						onclick={() => onAddConditionalQuestion('file_upload')}
						class="gap-1 text-xs"
						title={m['optionEditor.addFileUploadQuestion']()}
					>
						<Upload class="h-3 w-3" />
						{m['optionEditor.fuAbbrev']()}
					</Button>
					<Button
						variant="outline"
						size="sm"
						onclick={onAddConditionalSection}
						class="gap-1 text-xs"
						title={m['optionEditor.addSectionWithQuestions']()}
					>
						<FolderPlus class="h-3 w-3" />
						{m['optionEditor.section']()}
					</Button>
				</div>
			</div>

			<!-- Conditional Questions -->
			{#if option.conditionalQuestions && option.conditionalQuestions.length > 0}
				<div class="space-y-3 pl-4">
					<Label class="text-xs font-medium text-muted-foreground">
						{m['optionEditor.questionsCount']({ count: option.conditionalQuestions.length })}
					</Label>
					{#each option.conditionalQuestions as condQ, condIndex (condQ.id)}
						<QuestionEditor
							question={condQ}
							onUpdate={(updates) => onUpdateConditionalQuestion(condIndex, updates)}
							onRemove={() => onRemoveConditionalQuestion(condIndex)}
							isNested={true}
							{showLlmGuidelines}
						/>
					{/each}
				</div>
			{/if}

			<!-- Conditional Sections -->
			{#if option.conditionalSections && option.conditionalSections.length > 0}
				<div class="space-y-3 pl-4">
					<Label class="text-xs font-medium text-muted-foreground">
						{m['optionEditor.sectionsCount']({ count: option.conditionalSections.length })}
					</Label>
					{#each option.conditionalSections as condSection, sectionIndex (condSection.id)}
						<div class="rounded-md border-2 border-dashed border-primary/40 bg-primary/5 p-4">
							<div class="space-y-4">
								<!-- Section header -->
								<div class="flex items-center justify-between">
									<div class="flex items-center gap-2">
										<FolderPlus class="h-4 w-4 text-primary/60" aria-hidden="true" />
										<Badge variant="outline" class="text-xs">{m['optionEditor.section']()}</Badge>
									</div>
									<Button
										variant="ghost"
										size="sm"
										onclick={() => onRemoveConditionalSection(sectionIndex)}
										class="h-6 w-6 p-0 text-destructive hover:text-destructive"
									>
										<X class="h-4 w-4" />
									</Button>
								</div>

								<!-- Section name -->
								<div class="space-y-2">
									<Label class="text-sm">{m['optionEditor.sectionName']()}</Label>
									<Input
										value={condSection.name}
										oninput={(e) =>
											onUpdateConditionalSection(sectionIndex, {
												name: e.currentTarget.value
											})}
										placeholder={m['optionEditor.sectionNamePlaceholder']()}
									/>
								</div>

								<!-- Section description -->
								<div class="space-y-2">
									<Label class="text-sm">{m['optionEditor.descriptionOptional']()}</Label>
									<Input
										value={condSection.description || ''}
										oninput={(e) =>
											onUpdateConditionalSection(sectionIndex, {
												description: e.currentTarget.value || undefined
											})}
										placeholder={m['optionEditor.sectionDescriptionPlaceholder']()}
									/>
								</div>

								<!-- Section questions -->
								<div class="space-y-3">
									<div class="flex items-center justify-between">
										<Label class="text-sm">
											{m['optionEditor.questionsCount']({ count: condSection.questions.length })}
										</Label>
										<div class="flex gap-1">
											<Button
												variant="outline"
												size="sm"
												onclick={() => onAddQuestionToSection(sectionIndex, 'multiple_choice')}
												class="gap-1 text-xs"
												title={m['optionEditor.addMultipleChoiceQuestion']()}
											>
												<ListChecks class="h-3 w-3" />
												{m['optionEditor.mcAbbrev']()}
											</Button>
											<Button
												variant="outline"
												size="sm"
												onclick={() => onAddQuestionToSection(sectionIndex, 'free_text')}
												class="gap-1 text-xs"
												title={m['optionEditor.addFreeTextQuestion']()}
											>
												<FileText class="h-3 w-3" />
												{m['optionEditor.ftAbbrev']()}
											</Button>
											<Button
												variant="outline"
												size="sm"
												onclick={() => onAddQuestionToSection(sectionIndex, 'file_upload')}
												class="gap-1 text-xs"
												title={m['optionEditor.addFileUploadQuestion']()}
											>
												<Upload class="h-3 w-3" />
												{m['optionEditor.fuAbbrev']()}
											</Button>
										</div>
									</div>

									{#if condSection.questions.length > 0}
										<div class="space-y-2">
											{#each condSection.questions as sectionQ, questionIndex (sectionQ.id)}
												<QuestionEditor
													question={sectionQ}
													onUpdate={(updates) =>
														onUpdateQuestionInSection(sectionIndex, questionIndex, updates)}
													onRemove={() => onRemoveQuestionFromSection(sectionIndex, questionIndex)}
													isNested={true}
													{showLlmGuidelines}
												/>
											{/each}
										</div>
									{:else}
										<p class="pl-4 text-xs text-muted-foreground">
											{m['optionEditor.noQuestionsInSection']()}
										</p>
									{/if}
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}

			<!-- Empty state -->
			{#if !hasConditionals}
				<p class="pl-4 text-xs text-muted-foreground">
					{m['optionEditor.noConditionalContent']()}
				</p>
			{/if}
		</div>
	{/if}
</div>
