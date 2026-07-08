<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/ui/button';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import { Plus, FolderPlus, Upload } from '@lucide/svelte';
	import QuestionEditor from '$lib/components/questionnaires/QuestionEditor.svelte';
	import SectionEditor from '$lib/components/questionnaires/SectionEditor.svelte';
	import QuestionnaireReadOnlyView from '$lib/components/questionnaires/QuestionnaireReadOnlyView.svelte';
	import type { QuestionnaireBuilder } from '$lib/utils/questionnaire-builder.svelte';

	interface Props {
		builder: QuestionnaireBuilder;
		canEdit: boolean;
		showLlmGuidelines: boolean;
		questionsError?: string;
	}

	let { builder, canEdit, showLlmGuidelines, questionsError }: Props = $props();
</script>

<!-- Questions & Sections -->
<Card>
	<CardHeader>
		<div class="flex items-center justify-between">
			<div>
				<CardTitle
					>{m['questionnaireEditPage.questions.title']()} ({builder.totalQuestionCount})</CardTitle
				>
				<CardDescription>{m['questionnaireEditPage.questions.description']()}</CardDescription>
			</div>
			{#if canEdit}
				<div class="flex flex-wrap gap-2">
					<Button
						variant="outline"
						size="sm"
						onclick={() => builder.addTopLevelQuestion('multiple_choice')}
						class="gap-2"
					>
						<Plus class="h-4 w-4" />
						{m['questionnaireEditPage.addMultipleChoice']()}
					</Button>
					<Button
						variant="outline"
						size="sm"
						onclick={() => builder.addTopLevelQuestion('free_text')}
						class="gap-2"
					>
						<Plus class="h-4 w-4" />
						{m['questionnaireEditPage.addFreeText']()}
					</Button>
					<Button
						variant="outline"
						size="sm"
						onclick={() => builder.addTopLevelQuestion('file_upload')}
						class="gap-2"
					>
						<Upload class="h-4 w-4" />
						{m['questionnaireEditPage.addFileUpload']()}
					</Button>
					<Button variant="secondary" size="sm" onclick={() => builder.addSection()} class="gap-2">
						<FolderPlus class="h-4 w-4" />
						{m['questionnaireEditPage.addSection']()}
					</Button>
				</div>
			{/if}
		</div>
	</CardHeader>
	<CardContent class="space-y-6">
		{#if builder.totalQuestionCount === 0 && builder.sections.length === 0}
			<div class="rounded-lg border border-dashed p-8 text-center">
				<p class="text-sm text-muted-foreground">
					{m['questionnaireEditPage.questions.empty']()}
				</p>
				{#if canEdit}
					<p class="mt-2 text-sm text-muted-foreground">
						{m['questionnaireEditPage.clickButtonsHint']()}
					</p>
				{/if}
			</div>
		{:else if canEdit}
			<!-- Editable mode - same as create page -->
			<div class="space-y-4">
				<h3 class="text-sm font-medium text-muted-foreground">
					{m['questionnaireEditPage.topLevelQuestionsHeading']({
						count: builder.topLevelQuestions.length
					})}
				</h3>
				<p class="text-xs text-muted-foreground">
					{m['questionnaireEditPage.reorderQuestionsHint']()}
				</p>
				<div class="space-y-4">
					{#each builder.topLevelQuestions as question, index (question.id)}
						<QuestionEditor
							{question}
							onUpdate={(updates) => builder.updateTopLevelQuestion(question.id, updates)}
							onRemove={() => builder.removeTopLevelQuestion(question.id)}
							onMoveUp={() => builder.moveTopLevelQuestion(index, 'up')}
							onMoveDown={() => builder.moveTopLevelQuestion(index, 'down')}
							isFirst={index === 0}
							isLast={index === builder.topLevelQuestions.length - 1}
							{showLlmGuidelines}
						/>
					{/each}
				</div>

				{#if builder.topLevelQuestions.length === 0}
					<div class="rounded-lg border border-dashed p-4 text-center">
						<p class="text-sm text-muted-foreground">
							{m['questionnaireEditPage.noTopLevelQuestions']()}
						</p>
					</div>
				{/if}

				{#if builder.topLevelQuestions.length > 0}
					<div class="flex justify-center gap-2 border-t pt-4">
						<Button
							variant="outline"
							size="sm"
							onclick={() => builder.addTopLevelQuestion('multiple_choice')}
							class="gap-2"
						>
							<Plus class="h-4 w-4" />
							{m['questionnaireEditPage.addMultipleChoice']()}
						</Button>
						<Button
							variant="outline"
							size="sm"
							onclick={() => builder.addTopLevelQuestion('free_text')}
							class="gap-2"
						>
							<Plus class="h-4 w-4" />
							{m['questionnaireEditPage.addFreeText']()}
						</Button>
					</div>
				{/if}
			</div>

			<!-- Sections -->
			{#if builder.sections.length > 0 || builder.topLevelQuestions.length > 0}
				<div class="space-y-4">
					<div class="border-t pt-4">
						<h3 class="mb-2 text-sm font-medium text-muted-foreground">
							{m['questionnaireEditPage.sectionsHeading']({ count: builder.sections.length })}
						</h3>
						<p class="text-xs text-muted-foreground">
							{m['questionnaireEditPage.reorderSectionsHint']()}
						</p>
					</div>
					<div class="space-y-4">
						{#each builder.sections as section, index (section.id)}
							<SectionEditor
								{section}
								onUpdate={(updates) => builder.updateSection(section.id, updates)}
								onRemove={() => builder.removeSection(section.id)}
								onMoveUp={() => builder.moveSection(index, 'up')}
								onMoveDown={() => builder.moveSection(index, 'down')}
								isFirst={index === 0}
								isLast={index === builder.sections.length - 1}
								onAddQuestion={(type) => builder.addQuestionToSection(section.id, type)}
								onUpdateQuestion={(questionId, updates) =>
									builder.updateQuestionInSection(section.id, questionId, updates)}
								onRemoveQuestion={(questionId) =>
									builder.removeQuestionFromSection(section.id, questionId)}
								onMoveQuestionUp={(qIndex) =>
									builder.moveQuestionInSection(section.id, qIndex, 'up')}
								onMoveQuestionDown={(qIndex) =>
									builder.moveQuestionInSection(section.id, qIndex, 'down')}
								{showLlmGuidelines}
							/>
						{/each}
					</div>
				</div>
			{/if}
		{:else}
			<!-- Read-only mode -->
			<QuestionnaireReadOnlyView
				topLevelQuestions={builder.topLevelQuestions}
				sections={builder.sections}
			/>
		{/if}

		{#if questionsError}
			<p class="mt-4 text-sm text-destructive">{questionsError}</p>
		{/if}

		<!-- Bottom action bar (only in edit mode) -->
		{#if canEdit && (builder.totalQuestionCount > 0 || builder.sections.length > 0)}
			<div class="flex justify-center gap-2 border-t pt-4">
				<Button
					variant="outline"
					size="sm"
					onclick={() => builder.addTopLevelQuestion('multiple_choice')}
					class="gap-2"
				>
					<Plus class="h-4 w-4" />
					{m['questionnaireEditPage.addMultipleChoice']()}
				</Button>
				<Button
					variant="outline"
					size="sm"
					onclick={() => builder.addTopLevelQuestion('free_text')}
					class="gap-2"
				>
					<Plus class="h-4 w-4" />
					{m['questionnaireEditPage.addFreeText']()}
				</Button>
				<Button
					variant="outline"
					size="sm"
					onclick={() => builder.addTopLevelQuestion('file_upload')}
					class="gap-2"
				>
					<Upload class="h-4 w-4" />
					{m['questionnaireEditPage.addFileUpload']()}
				</Button>
				<Button variant="secondary" size="sm" onclick={() => builder.addSection()} class="gap-2">
					<FolderPlus class="h-4 w-4" />
					{m['questionnaireEditPage.addSection']()}
				</Button>
			</div>
		{/if}
	</CardContent>
</Card>
