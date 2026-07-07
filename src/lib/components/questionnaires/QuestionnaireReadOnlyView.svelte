<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type {
		QuestionnaireQuestion as Question,
		QuestionnaireSection as Section
	} from '$lib/utils/questionnaire-form-types';

	interface Props {
		topLevelQuestions: Question[];
		sections: Section[];
	}

	const { topLevelQuestions, sections }: Props = $props();
</script>

<!--
	Shared snippet: renders a question's options including conditional questions and sections.
	Used for both top-level and section-level questions.
-->
{#snippet questionOptions(question: Question)}
	{#if question.type === 'multiple_choice' && question.options}
		<div class="mt-2 space-y-1">
			{#each question.options as option (option.id)}
				<div class="flex items-center gap-2 text-sm">
					<span class={option.isCorrect ? 'font-medium text-green-600' : 'text-muted-foreground'}>
						{option.isCorrect ? '\u2713' : '\u25CB'}
					</span>
					<span class={option.isCorrect ? 'font-medium' : ''}>{option.text}</span>
				</div>
				<!-- Display conditional questions for this option -->
				{#if option.conditionalQuestions && option.conditionalQuestions.length > 0}
					<div class="ml-6 mt-2 space-y-2 border-l-2 border-primary/30 pl-4">
						<p class="text-xs font-medium text-muted-foreground">
							&#8627; {m['questionnaireReadOnlyView.ifSelectedShow']()}
						</p>
						{#each option.conditionalQuestions as condQ (condQ.id)}
							<div class="rounded border bg-muted/50 p-3">
								<div class="mb-1 flex items-center gap-2">
									<span
										class="rounded px-2 py-0.5 text-xs font-medium {condQ.type === 'multiple_choice'
											? 'bg-blue-100 text-blue-700'
											: 'bg-purple-100 text-purple-700'}"
									>
										{condQ.type === 'multiple_choice' ? 'MC' : 'FT'}
									</span>
									{#if condQ.required}
										<span class="text-xs text-destructive"
											>{m['questionnaireReadOnlyView.required']()}</span
										>
									{/if}
								</div>
								<p class="text-sm">{condQ.text}</p>
								{#if condQ.type === 'multiple_choice' && condQ.options}
									<div class="mt-1 space-y-0.5">
										{#each condQ.options as condOpt (condOpt.id)}
											<div class="flex items-center gap-1 text-xs text-muted-foreground">
												<span>{condOpt.isCorrect ? '\u2713' : '\u25CB'}</span>
												<span>{condOpt.text}</span>
											</div>
										{/each}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
				<!-- Display conditional sections for this option -->
				{#if option.conditionalSections && option.conditionalSections.length > 0}
					<div class="ml-6 mt-2 space-y-2 border-l-2 border-green-500/30 pl-4">
						<p class="text-xs font-medium text-muted-foreground">
							&#8627; {m['questionnaireReadOnlyView.ifSelectedShowSection']()}
						</p>
						{#each option.conditionalSections as condSection (condSection.id)}
							<div class="rounded border border-green-500/50 bg-green-50/50 p-3">
								<p class="mb-2 text-sm font-medium">{condSection.name}</p>
								{#if condSection.description}
									<p class="mb-2 text-xs text-muted-foreground">
										{condSection.description}
									</p>
								{/if}
								{#each condSection.questions as condQ (condQ.id)}
									<div class="mt-2 rounded border bg-background p-2">
										<div class="mb-1 flex items-center gap-2">
											<span
												class="rounded px-2 py-0.5 text-xs font-medium {condQ.type ===
												'multiple_choice'
													? 'bg-blue-100 text-blue-700'
													: 'bg-purple-100 text-purple-700'}"
											>
												{condQ.type === 'multiple_choice' ? 'MC' : 'FT'}
											</span>
										</div>
										<p class="text-sm">{condQ.text}</p>
									</div>
								{/each}
							</div>
						{/each}
					</div>
				{/if}
			{/each}
		</div>
	{/if}
{/snippet}

{#snippet questionBadge(question: Question)}
	<div class="mb-2 flex items-center gap-2">
		<span
			class="rounded px-2 py-1 text-xs font-medium {question.type === 'multiple_choice'
				? 'bg-blue-100 text-blue-700'
				: question.type === 'file_upload'
					? 'bg-green-100 text-green-700'
					: 'bg-purple-100 text-purple-700'}"
		>
			{question.type === 'multiple_choice'
				? 'Multiple Choice'
				: question.type === 'file_upload'
					? 'File Upload'
					: 'Free Text'}
		</span>
		{#if question.required}
			<span class="text-xs text-destructive">{m['questionnaireReadOnlyView.required']()}</span>
		{/if}
	</div>
{/snippet}

<div class="space-y-4">
	{#if topLevelQuestions.length > 0}
		<div class="space-y-3">
			<h3 class="text-sm font-medium text-muted-foreground">
				{m['questionnaireReadOnlyView.topLevelQuestions']()}
			</h3>
			{#each topLevelQuestions as question (question.id)}
				<div class="rounded-lg border p-4">
					{@render questionBadge(question)}
					<p class="font-medium">{question.text}</p>
					{@render questionOptions(question)}
				</div>
			{/each}
		</div>
	{/if}

	{#each sections as section (section.id)}
		<div class="space-y-3 rounded-lg border-2 border-dashed border-muted p-4">
			<div class="flex items-center justify-between border-b pb-2">
				<h3 class="font-semibold">{section.name}</h3>
				<span class="text-sm text-muted-foreground">
					{m['questionnaireReadOnlyView.questionCount']({ count: section.questions.length })}
				</span>
			</div>
			{#if section.description}
				<p class="text-sm text-muted-foreground">{section.description}</p>
			{/if}
			{#each section.questions as question (question.id)}
				<div class="rounded-lg border bg-background p-4">
					{@render questionBadge(question)}
					<p class="font-medium">{question.text}</p>
					{@render questionOptions(question)}
				</div>
			{/each}
			{#if section.questions.length === 0}
				<div class="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
					{m['questionnaireReadOnlyView.noQuestionsInSection']()}
				</div>
			{/if}
		</div>
	{/each}
</div>
