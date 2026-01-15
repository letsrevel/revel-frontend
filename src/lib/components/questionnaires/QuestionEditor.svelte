<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Card, CardContent } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import {
		GripVertical,
		Trash2,
		Plus,
		X,
		ChevronDown,
		ChevronUp,
		CornerDownRight,
		FileText,
		ListChecks,
		FolderPlus
	} from 'lucide-svelte';
	import { Badge } from '$lib/components/ui/badge';
	import MarkdownEditor from '$lib/components/forms/MarkdownEditor.svelte';
	import { slide } from 'svelte/transition';

	// Conditional section type (shown when option is selected)
	interface ConditionalSection {
		id: string;
		name: string;
		description?: string;
		order: number;
		questions: Question[];
	}

	interface Option {
		text: string;
		isCorrect: boolean;
		// Conditional questions attached to this option
		conditionalQuestions?: Question[];
		// Conditional sections attached to this option
		conditionalSections?: ConditionalSection[];
	}

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
		options?: Option[];
		allowMultipleAnswers?: boolean;
		shuffleOptions?: boolean;
		// For free text
		llmGuidelines?: string;
	}

	interface Props {
		question: Question;
		onUpdate: (updates: Partial<Question>) => void;
		onRemove: () => void;
		isNested?: boolean;
	}

	let { question, onUpdate, onRemove, isNested = false }: Props = $props();

	// Collapsible sections state
	let showAdvanced = $state(false);
	let expandedOptions = $state<Set<number>>(new Set());
	let hasAutoExpandedOnce = $state(false);

	// Auto-expand options that have conditional content on initial load
	$effect(() => {
		if (!hasAutoExpandedOnce && question.options && question.options.length > 0) {
			const optionsWithContent = new Set<number>();
			question.options.forEach((opt, index) => {
				if (
					(opt.conditionalQuestions?.length || 0) > 0 ||
					(opt.conditionalSections?.length || 0) > 0
				) {
					optionsWithContent.add(index);
				}
			});
			if (optionsWithContent.size > 0) {
				expandedOptions = optionsWithContent;
			}
			hasAutoExpandedOnce = true;
		}
	});

	// Toggle option expansion for conditional questions
	function toggleOptionExpanded(index: number) {
		const newExpanded = new Set(expandedOptions);
		if (newExpanded.has(index)) {
			newExpanded.delete(index);
		} else {
			newExpanded.add(index);
		}
		expandedOptions = newExpanded;
	}

	// Add option to multiple choice
	function addOption() {
		if (question.type === 'multiple_choice') {
			const newOptions = [
				...(question.options || []),
				{ text: '', isCorrect: false, conditionalQuestions: [], conditionalSections: [] }
			];
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

	// Update option isCorrect - with validation for single correct answer
	function updateOptionCorrect(index: number, isCorrect: boolean) {
		if (question.type === 'multiple_choice' && question.options) {
			const newOptions = [...question.options];

			// If allowMultipleAnswers is false and we're setting this option as correct,
			// uncheck all other options first
			if (isCorrect && !question.allowMultipleAnswers) {
				newOptions.forEach((opt, i) => {
					if (i !== index && opt.isCorrect) {
						newOptions[i] = { ...opt, isCorrect: false };
					}
				});
			}

			newOptions[index] = { ...newOptions[index], isCorrect };
			onUpdate({ options: newOptions });
		}
	}

	// Create a new question object
	function createQuestion(type: 'multiple_choice' | 'free_text', order: number): Question {
		return {
			id: crypto.randomUUID(),
			type,
			text: '',
			required: true,
			order,
			positiveWeight: 1.0,
			negativeWeight: 0.0,
			isFatal: false,
			...(type === 'multiple_choice'
				? {
						options: [
							{ text: '', isCorrect: false },
							{ text: '', isCorrect: false }
						],
						allowMultipleAnswers: false,
						shuffleOptions: true
					}
				: { llmGuidelines: '' })
		};
	}

	// Add conditional question to an option
	function addConditionalQuestion(optionIndex: number, type: 'multiple_choice' | 'free_text') {
		if (question.type === 'multiple_choice' && question.options) {
			const newOptions = [...question.options];
			const currentConditionals = newOptions[optionIndex].conditionalQuestions || [];
			const newQuestion = createQuestion(type, currentConditionals.length);
			newOptions[optionIndex] = {
				...newOptions[optionIndex],
				conditionalQuestions: [...currentConditionals, newQuestion]
			};
			onUpdate({ options: newOptions });

			// Auto-expand the option
			const newExpanded = new Set(expandedOptions);
			newExpanded.add(optionIndex);
			expandedOptions = newExpanded;
		}
	}

	// Update conditional question
	function updateConditionalQuestion(
		optionIndex: number,
		questionIndex: number,
		updates: Partial<Question>
	) {
		if (question.type === 'multiple_choice' && question.options) {
			const newOptions = [...question.options];
			const conditionals = [...(newOptions[optionIndex].conditionalQuestions || [])];
			conditionals[questionIndex] = { ...conditionals[questionIndex], ...updates };
			newOptions[optionIndex] = { ...newOptions[optionIndex], conditionalQuestions: conditionals };
			onUpdate({ options: newOptions });
		}
	}

	// Remove conditional question
	function removeConditionalQuestion(optionIndex: number, questionIndex: number) {
		if (question.type === 'multiple_choice' && question.options) {
			const newOptions = [...question.options];
			const conditionals = (newOptions[optionIndex].conditionalQuestions || []).filter(
				(_, i) => i !== questionIndex
			);
			// Re-order remaining questions
			conditionals.forEach((q, i) => (q.order = i));
			newOptions[optionIndex] = { ...newOptions[optionIndex], conditionalQuestions: conditionals };
			onUpdate({ options: newOptions });
		}
	}

	// Check if option has conditional content (questions or sections)
	function optionHasConditionals(index: number): boolean {
		const opt = question.options?.[index];
		return (
			(opt?.conditionalQuestions?.length || 0) > 0 || (opt?.conditionalSections?.length || 0) > 0
		);
	}

	// Get total count of conditional items for an option
	function getConditionalsCount(index: number): number {
		const opt = question.options?.[index];
		return (opt?.conditionalQuestions?.length || 0) + (opt?.conditionalSections?.length || 0);
	}

	// Add conditional section to an option
	function addConditionalSection(optionIndex: number) {
		if (question.type === 'multiple_choice' && question.options) {
			const newOptions = [...question.options];
			const currentSections = newOptions[optionIndex].conditionalSections || [];
			const newSection: ConditionalSection = {
				id: crypto.randomUUID(),
				name: `Section ${currentSections.length + 1}`,
				description: '',
				order: currentSections.length,
				questions: []
			};
			newOptions[optionIndex] = {
				...newOptions[optionIndex],
				conditionalSections: [...currentSections, newSection]
			};
			onUpdate({ options: newOptions });

			// Auto-expand the option
			const newExpanded = new Set(expandedOptions);
			newExpanded.add(optionIndex);
			expandedOptions = newExpanded;
		}
	}

	// Update conditional section
	function updateConditionalSection(
		optionIndex: number,
		sectionIndex: number,
		updates: Partial<ConditionalSection>
	) {
		if (question.type === 'multiple_choice' && question.options) {
			const newOptions = [...question.options];
			const sections = [...(newOptions[optionIndex].conditionalSections || [])];
			sections[sectionIndex] = { ...sections[sectionIndex], ...updates };
			newOptions[optionIndex] = { ...newOptions[optionIndex], conditionalSections: sections };
			onUpdate({ options: newOptions });
		}
	}

	// Remove conditional section
	function removeConditionalSection(optionIndex: number, sectionIndex: number) {
		if (question.type === 'multiple_choice' && question.options) {
			const newOptions = [...question.options];
			const sections = (newOptions[optionIndex].conditionalSections || []).filter(
				(_, i) => i !== sectionIndex
			);
			// Re-order remaining sections
			sections.forEach((s, i) => (s.order = i));
			newOptions[optionIndex] = { ...newOptions[optionIndex], conditionalSections: sections };
			onUpdate({ options: newOptions });
		}
	}

	// Add question to conditional section
	function addQuestionToConditionalSection(
		optionIndex: number,
		sectionIndex: number,
		type: 'multiple_choice' | 'free_text'
	) {
		if (question.type === 'multiple_choice' && question.options) {
			const newOptions = [...question.options];
			const sections = [...(newOptions[optionIndex].conditionalSections || [])];
			const section = sections[sectionIndex];
			const newQuestion = createQuestion(type, section.questions.length);
			sections[sectionIndex] = {
				...section,
				questions: [...section.questions, newQuestion]
			};
			newOptions[optionIndex] = { ...newOptions[optionIndex], conditionalSections: sections };
			onUpdate({ options: newOptions });
		}
	}

	// Update question in conditional section
	function updateQuestionInConditionalSection(
		optionIndex: number,
		sectionIndex: number,
		questionIndex: number,
		updates: Partial<Question>
	) {
		if (question.type === 'multiple_choice' && question.options) {
			const newOptions = [...question.options];
			const sections = [...(newOptions[optionIndex].conditionalSections || [])];
			const section = sections[sectionIndex];
			const questions = [...section.questions];
			questions[questionIndex] = { ...questions[questionIndex], ...updates };
			sections[sectionIndex] = { ...section, questions };
			newOptions[optionIndex] = { ...newOptions[optionIndex], conditionalSections: sections };
			onUpdate({ options: newOptions });
		}
	}

	// Remove question from conditional section
	function removeQuestionFromConditionalSection(
		optionIndex: number,
		sectionIndex: number,
		questionIndex: number
	) {
		if (question.type === 'multiple_choice' && question.options) {
			const newOptions = [...question.options];
			const sections = [...(newOptions[optionIndex].conditionalSections || [])];
			const section = sections[sectionIndex];
			const questions = section.questions.filter((_, i) => i !== questionIndex);
			// Re-order remaining questions
			questions.forEach((q, i) => (q.order = i));
			sections[sectionIndex] = { ...section, questions };
			newOptions[optionIndex] = { ...newOptions[optionIndex], conditionalSections: sections };
			onUpdate({ options: newOptions });
		}
	}
</script>

<Card class={isNested ? 'border-primary/30 bg-primary/5' : ''}>
	<CardContent class="pt-6">
		<div class="space-y-4">
			<!-- Header -->
			<div class="flex items-start gap-3">
				{#if !isNested}
					<div class="cursor-grab pt-2">
						<GripVertical class="h-5 w-5 text-muted-foreground" aria-hidden="true" />
					</div>
				{:else}
					<div class="pt-2">
						<CornerDownRight class="h-5 w-5 text-primary/60" aria-hidden="true" />
					</div>
				{/if}

				<div class="flex-1 space-y-4">
					<!-- Question type badge -->
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<Badge variant={isNested ? 'secondary' : 'outline'}>
								{question.type === 'multiple_choice' ? 'Multiple Choice' : 'Free Text'}
							</Badge>
							{#if isNested}
								<Badge variant="outline" class="text-xs">Conditional</Badge>
							{/if}
						</div>
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
							<div class="space-y-3">
								{#each question.options || [] as option, index (index)}
									<div class="space-y-2 rounded-md border p-3">
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
											{#if !isNested}
												<Button
													variant="ghost"
													size="sm"
													onclick={() => toggleOptionExpanded(index)}
													class="gap-1 text-xs"
													title="Add conditional questions"
												>
													{#if expandedOptions.has(index)}
														<ChevronUp class="h-4 w-4" />
													{:else}
														<ChevronDown class="h-4 w-4" />
													{/if}
													{#if optionHasConditionals(index)}
														<Badge variant="secondary" class="text-xs">
															{getConditionalsCount(index)}
														</Badge>
													{/if}
												</Button>
											{/if}
											{#if (question.options?.length || 0) > 2}
												<Button
													variant="ghost"
													size="icon"
													onclick={() => removeOption(index)}
													class="flex-shrink-0"
												>
													<X class="h-4 w-4" />
													<span class="sr-only"
														>{m['questionEditor.removeOption']()} {index + 1}</span
													>
												</Button>
											{/if}
										</div>

										<!-- Conditional content for this option (only for non-nested questions) -->
										{#if !isNested && expandedOptions.has(index)}
											<div
												transition:slide={{ duration: 200 }}
												class="mt-3 space-y-4 border-t pt-3"
											>
												<div class="flex items-center justify-between">
													<Label class="text-sm text-muted-foreground">
														Conditional content (shown when this option is selected)
													</Label>
													<div class="flex gap-1">
														<Button
															variant="outline"
															size="sm"
															onclick={() => addConditionalQuestion(index, 'multiple_choice')}
															class="gap-1 text-xs"
															title="Add multiple choice question"
														>
															<ListChecks class="h-3 w-3" />
															MC
														</Button>
														<Button
															variant="outline"
															size="sm"
															onclick={() => addConditionalQuestion(index, 'free_text')}
															class="gap-1 text-xs"
															title="Add free text question"
														>
															<FileText class="h-3 w-3" />
															FT
														</Button>
														<Button
															variant="outline"
															size="sm"
															onclick={() => addConditionalSection(index)}
															class="gap-1 text-xs"
															title="Add section with multiple questions"
														>
															<FolderPlus class="h-3 w-3" />
															Section
														</Button>
													</div>
												</div>

												<!-- Conditional Questions - use svelte:self for recursion -->
												{#if option.conditionalQuestions && option.conditionalQuestions.length > 0}
													<div class="space-y-3 pl-4">
														<Label class="text-xs font-medium text-muted-foreground">
															Questions ({option.conditionalQuestions.length})
														</Label>
														{#each option.conditionalQuestions as condQ, condIndex (condQ.id)}
															<svelte:self
																question={condQ}
																onUpdate={(updates) =>
																	updateConditionalQuestion(index, condIndex, updates)}
																onRemove={() => removeConditionalQuestion(index, condIndex)}
																isNested={true}
															/>
														{/each}
													</div>
												{/if}

												<!-- Conditional Sections -->
												{#if option.conditionalSections && option.conditionalSections.length > 0}
													<div class="space-y-3 pl-4">
														<Label class="text-xs font-medium text-muted-foreground">
															Sections ({option.conditionalSections.length})
														</Label>
														{#each option.conditionalSections as condSection, sectionIndex (condSection.id)}
															<div
																class="rounded-md border-2 border-dashed border-primary/40 bg-primary/5 p-4"
															>
																<div class="space-y-4">
																	<!-- Section header -->
																	<div class="flex items-center justify-between">
																		<div class="flex items-center gap-2">
																			<FolderPlus
																				class="h-4 w-4 text-primary/60"
																				aria-hidden="true"
																			/>
																			<Badge variant="outline" class="text-xs">Section</Badge>
																		</div>
																		<Button
																			variant="ghost"
																			size="sm"
																			onclick={() => removeConditionalSection(index, sectionIndex)}
																			class="h-6 w-6 p-0 text-destructive hover:text-destructive"
																		>
																			<X class="h-4 w-4" />
																		</Button>
																	</div>

																	<!-- Section name -->
																	<div class="space-y-2">
																		<Label class="text-sm">Section Name</Label>
																		<Input
																			value={condSection.name}
																			oninput={(e) =>
																				updateConditionalSection(index, sectionIndex, {
																					name: e.currentTarget.value
																				})}
																			placeholder="Enter section name..."
																		/>
																	</div>

																	<!-- Section description -->
																	<div class="space-y-2">
																		<Label class="text-sm">Description (optional)</Label>
																		<Input
																			value={condSection.description || ''}
																			oninput={(e) =>
																				updateConditionalSection(index, sectionIndex, {
																					description: e.currentTarget.value || undefined
																				})}
																			placeholder="Brief description of this section..."
																		/>
																	</div>

																	<!-- Section questions - use svelte:self for recursion -->
																	<div class="space-y-3">
																		<div class="flex items-center justify-between">
																			<Label class="text-sm">
																				Questions ({condSection.questions.length})
																			</Label>
																			<div class="flex gap-1">
																				<Button
																					variant="outline"
																					size="sm"
																					onclick={() =>
																						addQuestionToConditionalSection(
																							index,
																							sectionIndex,
																							'multiple_choice'
																						)}
																					class="gap-1 text-xs"
																				>
																					<ListChecks class="h-3 w-3" />
																					MC
																				</Button>
																				<Button
																					variant="outline"
																					size="sm"
																					onclick={() =>
																						addQuestionToConditionalSection(
																							index,
																							sectionIndex,
																							'free_text'
																						)}
																					class="gap-1 text-xs"
																				>
																					<FileText class="h-3 w-3" />
																					FT
																				</Button>
																			</div>
																		</div>

																		{#if condSection.questions.length > 0}
																			<div class="space-y-2">
																				{#each condSection.questions as sectionQ, questionIndex (sectionQ.id)}
																					<svelte:self
																						question={sectionQ}
																						onUpdate={(updates) =>
																							updateQuestionInConditionalSection(
																								index,
																								sectionIndex,
																								questionIndex,
																								updates
																							)}
																						onRemove={() =>
																							removeQuestionFromConditionalSection(
																								index,
																								sectionIndex,
																								questionIndex
																							)}
																						isNested={true}
																					/>
																				{/each}
																			</div>
																		{:else}
																			<p class="pl-4 text-xs text-muted-foreground">
																				No questions in this section yet.
																			</p>
																		{/if}
																	</div>
																</div>
															</div>
														{/each}
													</div>
												{/if}

												<!-- Empty state -->
												{#if !optionHasConditionals(index)}
													<p class="pl-4 text-xs text-muted-foreground">
														No conditional content. Add questions or sections that will appear when
														this option is selected.
													</p>
												{/if}
											</div>
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

					<!-- Advanced Settings (collapsible) - only for top-level questions -->
					{#if !isNested}
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
					{/if}
				</div>
			</div>
		</div>
	</CardContent>
</Card>
