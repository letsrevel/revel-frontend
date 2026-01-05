<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { goto } from '$app/navigation';
	import { flip } from 'svelte/animate';
	import { dndzone, SHADOW_PLACEHOLDER_ITEM_ID } from 'svelte-dnd-action';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import { Plus, ArrowLeft, FolderPlus } from 'lucide-svelte';
	import QuestionEditor from '$lib/components/questionnaires/QuestionEditor.svelte';
	import SectionEditor from '$lib/components/questionnaires/SectionEditor.svelte';
	import MarkdownEditor from '$lib/components/forms/MarkdownEditor.svelte';
	import { questionnaireCreateOrgQuestionnaire } from '$lib/api/generated/sdk.gen';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	// Question type definition
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

	// Section type definition
	interface Section {
		id: string;
		name: string;
		description?: string;
		order: number;
		questions: Question[];
	}

	// Form state
	let name = $state('');
	let description = $state(''); // Questionnaire description (markdown)
	let questionnaireType = $state<'admission' | 'membership' | 'feedback' | 'generic'>('generic');
	let minScore = $state(0);
	let evaluationMode = $state<'automatic' | 'manual' | 'hybrid'>('manual');
	let shuffleQuestions = $state(false);
	let shuffleSections = $state(false);
	let llmGuidelines = $state('');
	let maxSubmissionAge = $state<number | null>(null); // Duration in days
	let canRetakeAfter = $state<number | null>(null); // Duration in hours
	let membersExempt = $state(false); // Exempt members from questionnaire

	// Top-level questions (not in any section)
	let topLevelQuestions = $state<Question[]>([]);

	// Sections with their questions
	let sections = $state<Section[]>([]);

	// Total question count
	const totalQuestionCount = $derived(
		topLevelQuestions.length + sections.reduce((sum, s) => sum + s.questions.length, 0)
	);

	// Check if LLM guidelines are needed
	const allQuestions = $derived([...topLevelQuestions, ...sections.flatMap((s) => s.questions)]);
	const hasFreeTextQuestions = $derived(allQuestions.some((q) => q.type === 'free_text'));
	const needsLlmGuidelines = $derived(
		hasFreeTextQuestions && (evaluationMode === 'automatic' || evaluationMode === 'hybrid')
	);
	const showLlmWarning = $derived(needsLlmGuidelines && !llmGuidelines.trim());

	// Form validation
	let errors = $state<{
		name?: string;
		questions?: string;
	}>({});

	// Saving state
	let isSaving = $state(false);

	// Questionnaire type labels and descriptions
	const questionnaireTypes = {
		admission: {
			label: 'Admission',
			description: 'Gate event attendance - attendees must complete this to RSVP'
		},
		membership: {
			label: 'Membership',
			description: 'Gate organization membership - required for joining the organization'
		},
		feedback: {
			label: 'Feedback',
			description: 'Collect post-event feedback from attendees'
		},
		generic: {
			label: 'Generic',
			description: 'General purpose questionnaire for any use case'
		}
	};

	// Get display label for current type
	const selectedTypeLabel = $derived(questionnaireTypes[questionnaireType]?.label ?? 'Generic');

	// Get current description safely
	const selectedTypeDescription = $derived(
		questionnaireTypes[questionnaireType]?.description ??
			'General purpose questionnaire for any use case'
	);

	// Evaluation mode descriptions
	const evaluationModes = {
		automatic: {
			label: 'Automatic',
			description: 'AI evaluates all responses automatically - fastest approval process'
		},
		manual: {
			label: 'Manual',
			description: 'Staff manually reviews all submissions - complete control over decisions'
		},
		hybrid: {
			label: 'Hybrid',
			description: 'AI pre-scores responses, staff makes final approval decision'
		}
	};

	const selectedEvaluationDescription = $derived(
		evaluationModes[evaluationMode]?.description ??
			'AI evaluates all responses automatically - fastest approval process'
	);

	// Helper to create a new question
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

	// Add a new top-level question (not in any section)
	function addTopLevelQuestion(type: 'multiple_choice' | 'free_text') {
		const newQuestion = createQuestion(type, topLevelQuestions.length);
		topLevelQuestions = [...topLevelQuestions, newQuestion];
	}

	// Remove a top-level question
	function removeTopLevelQuestion(id: string) {
		topLevelQuestions = topLevelQuestions.filter((q) => q.id !== id);
		// Re-order remaining questions
		topLevelQuestions = topLevelQuestions.map((q, index) => ({ ...q, order: index }));
	}

	// Update a top-level question
	function updateTopLevelQuestion(id: string, updates: Partial<Question>) {
		topLevelQuestions = topLevelQuestions.map((q) => (q.id === id ? { ...q, ...updates } : q));
	}

	// Add a new section
	function addSection() {
		const newSection: Section = {
			id: crypto.randomUUID(),
			name: `Section ${sections.length + 1}`,
			description: '',
			order: sections.length,
			questions: []
		};
		sections = [...sections, newSection];
	}

	// Remove a section
	function removeSection(id: string) {
		sections = sections.filter((s) => s.id !== id);
		// Re-order remaining sections
		sections = sections.map((s, index) => ({ ...s, order: index }));
	}

	// Update a section
	function updateSection(id: string, updates: Partial<Section>) {
		sections = sections.map((s) => (s.id === id ? { ...s, ...updates } : s));
	}

	// Add a question to a section
	function addQuestionToSection(sectionId: string, type: 'multiple_choice' | 'free_text') {
		sections = sections.map((s) => {
			if (s.id === sectionId) {
				const newQuestion = createQuestion(type, s.questions.length);
				return { ...s, questions: [...s.questions, newQuestion] };
			}
			return s;
		});
	}

	// Remove a question from a section
	function removeQuestionFromSection(sectionId: string, questionId: string) {
		sections = sections.map((s) => {
			if (s.id === sectionId) {
				const newQuestions = s.questions
					.filter((q) => q.id !== questionId)
					.map((q, index) => ({ ...q, order: index }));
				return { ...s, questions: newQuestions };
			}
			return s;
		});
	}

	// Update a question in a section
	function updateQuestionInSection(
		sectionId: string,
		questionId: string,
		updates: Partial<Question>
	) {
		sections = sections.map((s) => {
			if (s.id === sectionId) {
				return {
					...s,
					questions: s.questions.map((q) => (q.id === questionId ? { ...q, ...updates } : q))
				};
			}
			return s;
		});
	}

	// Reorder questions in a section (from drag-and-drop)
	function reorderQuestionsInSection(sectionId: string, newQuestions: Question[]) {
		sections = sections.map((s) => {
			if (s.id === sectionId) {
				return { ...s, questions: newQuestions };
			}
			return s;
		});
	}

	// DnD flip duration
	const flipDurationMs = 200;

	// DnD drop target style
	const dropTargetStyle = {
		outline: '2px dashed hsl(var(--primary))',
		borderRadius: '8px'
	};

	// Handle drag and drop for top-level questions
	function handleTopLevelQuestionsDndConsider(e: CustomEvent<{ items: Question[] }>) {
		topLevelQuestions = e.detail.items;
	}

	function handleTopLevelQuestionsDndFinalize(e: CustomEvent<{ items: Question[] }>) {
		topLevelQuestions = e.detail.items
			.filter((q) => q.id !== SHADOW_PLACEHOLDER_ITEM_ID)
			.map((q, index) => ({ ...q, order: index }));
	}

	// Handle drag and drop for sections
	function handleSectionsDndConsider(e: CustomEvent<{ items: Section[] }>) {
		sections = e.detail.items;
	}

	function handleSectionsDndFinalize(e: CustomEvent<{ items: Section[] }>) {
		sections = e.detail.items
			.filter((s) => s.id !== SHADOW_PLACEHOLDER_ITEM_ID)
			.map((s, index) => ({ ...s, order: index }));
	}

	// Validate form
	function validate(): boolean {
		errors = {};

		if (!name.trim()) {
			errors.name = m['questionnaireNewPage.error_nameRequired']();
		}

		if (totalQuestionCount === 0) {
			errors.questions = m['questionnaireNewPage.error_noQuestions']();
		}

		// Validate each question has text
		const invalidQuestions = allQuestions.filter((q) => !q.text.trim());
		if (invalidQuestions.length > 0) {
			errors.questions = m['questionnaireNewPage.error_questionsNeedText']();
		}

		return Object.keys(errors).length === 0;
	}

	// Helper to convert a MC question to API format
	function mcQuestionToApiFormat(q: Question) {
		return {
			question: q.text,
			hint: q.hint || null,
			reviewer_notes: q.reviewerNotes || null,
			is_mandatory: q.required,
			order: q.order,
			positive_weight: q.positiveWeight,
			negative_weight: q.negativeWeight,
			is_fatal: q.isFatal,
			allow_multiple_answers: q.allowMultipleAnswers || false,
			shuffle_options: q.shuffleOptions ?? true,
			options:
				q.options
					?.filter((o) => o.text.trim())
					.map((o, i) => ({
						option: o.text,
						is_correct: o.isCorrect,
						order: i
					})) || []
		};
	}

	// Helper to convert a FT question to API format
	function ftQuestionToApiFormat(q: Question) {
		return {
			question: q.text,
			hint: q.hint || null,
			reviewer_notes: q.reviewerNotes || null,
			is_mandatory: q.required,
			order: q.order,
			positive_weight: q.positiveWeight,
			negative_weight: q.negativeWeight,
			is_fatal: q.isFatal,
			llm_guidelines: q.llmGuidelines || null
		};
	}

	// Save questionnaire
	async function saveQuestionnaire() {
		if (!validate()) {
			return;
		}

		isSaving = true;

		try {
			const user = data.user;
			if (!user) {
				throw new Error('Not authenticated');
			}

			// Build sections array for API
			const apiSections = sections.map((s) => ({
				name: s.name,
				description: s.description || null,
				order: s.order,
				multiplechoicequestion_questions: s.questions
					.filter((q) => q.type === 'multiple_choice')
					.map((q) => mcQuestionToApiFormat(q)),
				freetextquestion_questions: s.questions
					.filter((q) => q.type === 'free_text')
					.map((q) => ftQuestionToApiFormat(q))
			}));

			// Top-level questions (not in any section)
			const topLevelMC = topLevelQuestions
				.filter((q) => q.type === 'multiple_choice')
				.map((q) => mcQuestionToApiFormat(q));
			const topLevelFT = topLevelQuestions
				.filter((q) => q.type === 'free_text')
				.map((q) => ftQuestionToApiFormat(q));

			// Create questionnaire
			const response = await questionnaireCreateOrgQuestionnaire({
				path: { organization_id: data.organization.id },
				body: {
					name,
					description: description || null,
					min_score: minScore,
					evaluation_mode: evaluationMode,
					questionnaire_type: questionnaireType,
					max_submission_age:
						maxSubmissionAge !== null ? String(maxSubmissionAge * 86400) : undefined, // Convert days to seconds
					shuffle_questions: shuffleQuestions,
					shuffle_sections: shuffleSections,
					llm_guidelines: llmGuidelines || null,
					can_retake_after: canRetakeAfter !== null ? String(canRetakeAfter * 3600) : undefined, // Convert hours to seconds
					members_exempt: membersExempt,
					sections: apiSections,
					multiplechoicequestion_questions: topLevelMC,
					freetextquestion_questions: topLevelFT
				},
				headers: { Authorization: `Bearer ${user.accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to create questionnaire');
			}

			// Redirect to questionnaire list
			await goto(`/org/${data.organization.slug}/admin/questionnaires`);
		} catch (err) {
			console.error('Failed to save questionnaire:', err);
			alert('Failed to save questionnaire. Please try again.');
		} finally {
			isSaving = false;
		}
	}
</script>

<svelte:head>
	<title>{m['questionnaireNewPage.pageTitle']()} - {data.organization.name} Admin</title>
</svelte:head>

<!-- Header -->
<div class="mb-6">
	<Button
		href="/org/{data.organization.slug}/admin/questionnaires"
		variant="ghost"
		size="sm"
		class="mb-4 gap-2"
	>
		<ArrowLeft class="h-4 w-4" />
		Back to Questionnaires
	</Button>

	<h1 class="text-3xl font-bold tracking-tight">{m['questionnaireNewPage.title']()}</h1>
	<p class="mt-2 text-sm text-muted-foreground">
		Create an admission form, membership application, or survey for your events
	</p>
</div>

<!-- Form -->
<div class="mx-auto max-w-4xl space-y-6">
	<!-- Basic Information -->
	<Card>
		<CardHeader>
			<CardTitle>{m['questionnaireNewPage.basicInfoTitle']()}</CardTitle>
			<CardDescription>{m['questionnaireNewPage.basicInfoDescription']()}</CardDescription>
		</CardHeader>
		<CardContent class="space-y-4">
			<!-- Name -->
			<div class="space-y-2">
				<Label for="name">
					{m['questionnaireNewPage.nameLabel']()}
					<span class="text-destructive">*</span>
				</Label>
				<Input
					id="name"
					bind:value={name}
					placeholder={m['questionnaireNewPage.namePlaceholder']()}
					class={errors.name ? 'border-destructive' : ''}
				/>
				{#if errors.name}
					<p class="text-sm text-destructive">{errors.name}</p>
				{/if}
			</div>

			<!-- Description (markdown) -->
			<MarkdownEditor
				id="questionnaire-description"
				label="Description (optional)"
				bind:value={description}
				placeholder="Instructions or introduction shown to users before they start the questionnaire..."
				rows={3}
			/>

			<!-- Type -->
			<div class="space-y-2">
				<Label for="type">
					Questionnaire Type
					<span class="text-destructive">*</span>
				</Label>
				<Select
					type="single"
					value={questionnaireType}
					onValueChange={(v) => {
						console.log('[Select] onValueChange called with:', v);
						if (v) {
							console.log('[Select] Setting questionnaireType to:', v);
							questionnaireType = v as typeof questionnaireType;
						}
					}}
				>
					<SelectTrigger id="type">
						{selectedTypeLabel}
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="admission" label="Admission">
							<div class="flex flex-col gap-0.5">
								<div class="font-medium">Admission</div>
								<div class="text-xs text-muted-foreground">
									Gate event attendance - attendees must complete this to RSVP
								</div>
							</div>
						</SelectItem>
						<SelectItem value="membership" label="Membership">
							<div class="flex flex-col gap-0.5">
								<div class="font-medium">Membership</div>
								<div class="text-xs text-muted-foreground">
									Gate organization membership - required for joining
								</div>
							</div>
						</SelectItem>
						<SelectItem value="feedback" label="Feedback">
							<div class="flex flex-col gap-0.5">
								<div class="font-medium">Feedback</div>
								<div class="text-xs text-muted-foreground">
									Collect post-event feedback from attendees
								</div>
							</div>
						</SelectItem>
						<SelectItem value="generic" label="Generic">
							<div class="flex flex-col gap-0.5">
								<div class="font-medium">Generic</div>
								<div class="text-xs text-muted-foreground">
									General purpose questionnaire for any use case
								</div>
							</div>
						</SelectItem>
					</SelectContent>
				</Select>
				<p class="text-xs text-muted-foreground">
					{selectedTypeDescription}
				</p>
			</div>

			<!-- Minimum Score -->
			<div class="space-y-2">
				<Label for="min-score">
					Minimum Score (%)
					<span class="text-destructive">*</span>
				</Label>
				<Input
					id="min-score"
					type="number"
					bind:value={minScore}
					min="0"
					max="100"
					step="1"
					placeholder="0"
				/>
				<p class="text-xs text-muted-foreground">
					Minimum score required to pass the questionnaire (0-100)
				</p>
			</div>

			<!-- Evaluation Mode -->
			<div class="space-y-2">
				<Label for="evaluation-mode">
					{m['questionnaireNewPage.evaluationModeLabel']()}
					<span class="text-destructive">*</span>
				</Label>
				<Select
					type="single"
					value={evaluationMode}
					onValueChange={(v) => {
						if (v) {
							evaluationMode = v as typeof evaluationMode;
						}
					}}
				>
					<SelectTrigger id="evaluation-mode">
						{evaluationModes[evaluationMode]?.label ?? 'Automatic'}
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="automatic" label="Automatic">
							<div class="flex flex-col gap-0.5">
								<div class="font-medium">Automatic</div>
								<div class="text-xs text-muted-foreground">
									AI evaluates all responses automatically
								</div>
							</div>
						</SelectItem>
						<SelectItem value="manual" label="Manual">
							<div class="flex flex-col gap-0.5">
								<div class="font-medium">Manual</div>
								<div class="text-xs text-muted-foreground">
									Staff manually reviews all submissions
								</div>
							</div>
						</SelectItem>
						<SelectItem value="hybrid" label="Hybrid">
							<div class="flex flex-col gap-0.5">
								<div class="font-medium">Hybrid</div>
								<div class="text-xs text-muted-foreground">
									AI pre-scores, staff reviews final decision
								</div>
							</div>
						</SelectItem>
					</SelectContent>
				</Select>
				<p class="text-xs text-muted-foreground">
					{selectedEvaluationDescription}
				</p>
			</div>
		</CardContent>
	</Card>

	<!-- Advanced Settings -->
	<Card>
		<CardHeader>
			<CardTitle>{m['questionnaireNewPage.advancedSettingsTitle']()}</CardTitle>
			<CardDescription>{m['questionnaireNewPage.advancedSettingsDescription']()}</CardDescription>
		</CardHeader>
		<CardContent class="space-y-4">
			<!-- Shuffle Options -->
			<div class="space-y-3">
				<div class="flex items-center space-x-2">
					<input
						id="shuffle-questions"
						type="checkbox"
						bind:checked={shuffleQuestions}
						class="h-4 w-4 rounded border-gray-300"
					/>
					<Label for="shuffle-questions" class="font-normal"
						>{m['questionnaireNewPage.shuffleQuestionsLabel']()}</Label
					>
				</div>
				<div class="flex items-center space-x-2">
					<input
						id="shuffle-sections"
						type="checkbox"
						bind:checked={shuffleSections}
						class="h-4 w-4 rounded border-gray-300"
					/>
					<Label for="shuffle-sections" class="font-normal"
						>{m['questionnaireNewPage.shuffleSectionsLabel']()}</Label
					>
				</div>
			</div>

			<!-- Members Exempt -->
			<div class="space-y-2">
				<div class="flex items-center space-x-2">
					<input
						id="members-exempt"
						type="checkbox"
						bind:checked={membersExempt}
						class="h-4 w-4 rounded border-gray-300"
					/>
					<Label for="members-exempt" class="font-normal"
						>{m['questionnaireNewPage.membersExemptLabel']()}</Label
					>
				</div>
				<p class="text-xs text-muted-foreground">
					{m['questionnaireNewPage.membersExemptDescription']()}
				</p>
			</div>

			<!-- LLM Guidelines -->
			<div class="space-y-2">
				<Label for="llm-guidelines">
					LLM Guidelines
					{#if needsLlmGuidelines}
						<span class="text-destructive">*</span>
					{/if}
				</Label>
				<Textarea
					id="llm-guidelines"
					bind:value={llmGuidelines}
					placeholder="Instructions for the AI when evaluating free-text answers..."
					rows={4}
					class={showLlmWarning ? 'border-destructive' : ''}
				/>
				{#if showLlmWarning}
					<p class="text-sm text-destructive">
						⚠️ LLM guidelines are required when using automatic/hybrid evaluation with free text
						questions
					</p>
				{:else}
					<p class="text-xs text-muted-foreground">
						{#if needsLlmGuidelines}
							Required for automatic/hybrid evaluation of free-text questions
						{:else}
							Optional guidelines for AI evaluation (only needed for free-text questions with
							automatic/hybrid mode)
						{/if}
					</p>
				{/if}
			</div>

			<!-- Duration Settings -->
			<div class="grid gap-4 sm:grid-cols-2">
				<!-- Max Submission Age -->
				<div class="space-y-2">
					<Label for="max-submission-age">Submission Validity (days)</Label>
					<Input
						id="max-submission-age"
						type="number"
						bind:value={maxSubmissionAge}
						min="0"
						step="1"
						placeholder="Leave empty for no expiry"
					/>
					<p class="text-xs text-muted-foreground">
						How long a completed submission remains valid before user must retake (in days)
					</p>
				</div>

				<!-- Can Retake After -->
				<div class="space-y-2">
					<Label for="can-retake-after">Retake Cooldown (hours)</Label>
					<Input
						id="can-retake-after"
						type="number"
						bind:value={canRetakeAfter}
						min="0"
						step="1"
						placeholder="Leave empty to prevent retakes"
					/>
					<p class="text-xs text-muted-foreground">
						How long users must wait before retaking (in hours)
					</p>
				</div>
			</div>
		</CardContent>
	</Card>

	<!-- Questions & Sections -->
	<Card>
		<CardHeader>
			<div class="flex items-center justify-between">
				<div>
					<CardTitle>Questions ({totalQuestionCount})</CardTitle>
					<CardDescription>
						Add questions directly or organize them into sections. Sections help group related
						questions together.
					</CardDescription>
				</div>
				<div class="flex flex-wrap gap-2">
					<Button
						variant="outline"
						size="sm"
						onclick={() => addTopLevelQuestion('multiple_choice')}
						class="gap-2"
					>
						<Plus class="h-4 w-4" />
						Multiple Choice
					</Button>
					<Button
						variant="outline"
						size="sm"
						onclick={() => addTopLevelQuestion('free_text')}
						class="gap-2"
					>
						<Plus class="h-4 w-4" />
						Free Text
					</Button>
					<Button variant="secondary" size="sm" onclick={addSection} class="gap-2">
						<FolderPlus class="h-4 w-4" />
						Add Section
					</Button>
				</div>
			</div>
		</CardHeader>
		<CardContent class="space-y-6">
			{#if totalQuestionCount === 0 && sections.length === 0}
				<div class="rounded-lg border border-dashed p-8 text-center">
					<p class="text-sm text-muted-foreground">
						No questions yet. Add questions directly or create a section to organize them.
					</p>
				</div>
			{:else}
				<!-- Top-level questions (not in any section) - drag and drop zone -->
				<div class="space-y-4">
					<h3 class="text-sm font-medium text-muted-foreground">
						Top-level Questions ({topLevelQuestions.length})
					</h3>
					<p class="text-xs text-muted-foreground">
						Drag questions to reorder, or drag them into a section below.
					</p>
					<div
						class="min-h-[60px] space-y-4 rounded-lg"
						use:dndzone={{
							items: topLevelQuestions,
							flipDurationMs,
							dropTargetStyle,
							type: 'questions'
						}}
						onconsider={handleTopLevelQuestionsDndConsider}
						onfinalize={handleTopLevelQuestionsDndFinalize}
					>
						{#each topLevelQuestions.filter((q) => q.id !== SHADOW_PLACEHOLDER_ITEM_ID) as question (question.id)}
							<div animate:flip={{ duration: flipDurationMs }}>
								<QuestionEditor
									{question}
									onUpdate={(updates) => updateTopLevelQuestion(question.id, updates)}
									onRemove={() => removeTopLevelQuestion(question.id)}
								/>
							</div>
						{/each}
					</div>

					{#if topLevelQuestions.length === 0}
						<div class="rounded-lg border border-dashed p-4 text-center">
							<p class="text-sm text-muted-foreground">
								No top-level questions. Add questions here or drag them from a section.
							</p>
						</div>
					{/if}

					<!-- Bottom buttons for adding more top-level questions -->
					{#if topLevelQuestions.length > 0}
						<div class="flex justify-center gap-2 border-t pt-4">
							<Button
								variant="outline"
								size="sm"
								onclick={() => addTopLevelQuestion('multiple_choice')}
								class="gap-2"
							>
								<Plus class="h-4 w-4" />
								Multiple Choice
							</Button>
							<Button
								variant="outline"
								size="sm"
								onclick={() => addTopLevelQuestion('free_text')}
								class="gap-2"
							>
								<Plus class="h-4 w-4" />
								Free Text
							</Button>
						</div>
					{/if}
				</div>

				<!-- Sections - drag and drop zone -->
				{#if sections.length > 0 || topLevelQuestions.length > 0}
					<div class="space-y-4">
						<div class="border-t pt-4">
							<h3 class="mb-2 text-sm font-medium text-muted-foreground">
								Sections ({sections.length})
							</h3>
							<p class="text-xs text-muted-foreground">
								Drag sections to reorder. Drag questions between sections.
							</p>
						</div>
						<div
							class="min-h-[60px] space-y-4 rounded-lg"
							use:dndzone={{
								items: sections,
								flipDurationMs,
								dropTargetStyle,
								type: 'sections',
								dragDisabled: false
							}}
							onconsider={handleSectionsDndConsider}
							onfinalize={handleSectionsDndFinalize}
						>
							{#each sections.filter((s) => s.id !== SHADOW_PLACEHOLDER_ITEM_ID) as section (section.id)}
								<div animate:flip={{ duration: flipDurationMs }}>
									<SectionEditor
										{section}
										onUpdate={(updates) => updateSection(section.id, updates)}
										onRemove={() => removeSection(section.id)}
										onAddQuestion={(type) => addQuestionToSection(section.id, type)}
										onUpdateQuestion={(questionId, updates) =>
											updateQuestionInSection(section.id, questionId, updates)}
										onRemoveQuestion={(questionId) =>
											removeQuestionFromSection(section.id, questionId)}
										onQuestionsReorder={(questions) =>
											reorderQuestionsInSection(section.id, questions)}
										{dropTargetStyle}
									/>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			{/if}

			{#if errors.questions}
				<p class="mt-4 text-sm text-destructive">{errors.questions}</p>
			{/if}

			<!-- Bottom action bar -->
			{#if totalQuestionCount > 0 || sections.length > 0}
				<div class="flex justify-center gap-2 border-t pt-4">
					<Button
						variant="outline"
						size="sm"
						onclick={() => addTopLevelQuestion('multiple_choice')}
						class="gap-2"
					>
						<Plus class="h-4 w-4" />
						Multiple Choice
					</Button>
					<Button
						variant="outline"
						size="sm"
						onclick={() => addTopLevelQuestion('free_text')}
						class="gap-2"
					>
						<Plus class="h-4 w-4" />
						Free Text
					</Button>
					<Button variant="secondary" size="sm" onclick={addSection} class="gap-2">
						<FolderPlus class="h-4 w-4" />
						Add Section
					</Button>
				</div>
			{/if}
		</CardContent>
	</Card>

	<!-- Actions -->
	<div class="flex justify-end gap-3">
		<Button href="/org/{data.organization.slug}/admin/questionnaires" variant="outline">
			{m['questionnaireNewPage.cancelButton']()}
		</Button>
		<Button onclick={saveQuestionnaire} disabled={isSaving}>
			{isSaving ? 'Saving...' : 'Save Questionnaire'}
		</Button>
	</div>
</div>
