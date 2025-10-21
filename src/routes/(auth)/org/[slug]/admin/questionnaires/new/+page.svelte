<script lang="ts">
	import { goto } from '$app/navigation';
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
	import { Plus, ArrowLeft } from 'lucide-svelte';
	import QuestionEditor from '$lib/components/questionnaires/QuestionEditor.svelte';
	import { questionnaireCreateOrgQuestionnaire } from '$lib/api/generated/sdk.gen';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	// Form state
	let name = $state('');
	let questionnaireType = $state<'admission' | 'membership' | 'feedback' | 'generic'>('generic');
	let minScore = $state(0);
	let evaluationMode = $state<'automatic' | 'manual' | 'hybrid'>('automatic');
	let shuffleQuestions = $state(false);
	let shuffleSections = $state(false);
	let llmGuidelines = $state('');
	let maxSubmissionAge = $state<number | null>(null); // Duration in seconds
	let canRetakeAfter = $state<number | null>(null); // Duration in seconds

	let questions = $state<
		Array<{
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
		}>
	>([]);

	// Check if LLM guidelines are needed
	const hasFreeTextQuestions = $derived(questions.some((q) => q.type === 'free_text'));
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

	// DEBUG: Log state changes
	$effect(() => {
		console.log('[QuestionnaireType] Current state:', {
			questionnaireType,
			selectedTypeLabel,
			selectedTypeDescription
		});
	});

	// Add a new question
	function addQuestion(type: 'multiple_choice' | 'free_text') {
		const newQuestion = {
			id: crypto.randomUUID(),
			type,
			text: '',
			required: true,
			order: questions.length,
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
		questions = [...questions, newQuestion];
	}

	// Remove a question
	function removeQuestion(id: string) {
		questions = questions.filter((q) => q.id !== id);
		// Re-order remaining questions
		questions = questions.map((q, index) => ({ ...q, order: index }));
	}

	// Update a question
	function updateQuestion(id: string, updates: Partial<(typeof questions)[0]>) {
		questions = questions.map((q) => (q.id === id ? { ...q, ...updates } : q));
	}

	// Validate form
	function validate(): boolean {
		errors = {};

		if (!name.trim()) {
			errors.name = 'Questionnaire name is required';
		}

		if (questions.length === 0) {
			errors.questions = 'Add at least one question';
		}

		// Validate each question has text
		const invalidQuestions = questions.filter((q) => !q.text.trim());
		if (invalidQuestions.length > 0) {
			errors.questions = 'All questions must have text';
		}

		// Validate multiple choice questions have at least 2 options
		const invalidMC = questions.filter(
			(q) =>
				q.type === 'multiple_choice' &&
				(!q.options || q.options.filter((o) => o.text.trim()).length < 2)
		);
		if (invalidMC.length > 0) {
			errors.questions = 'Multiple choice questions must have at least 2 options';
		}

		return Object.keys(errors).length === 0;
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

			// Build sections array with questions
			const sections = [
				{
					name: 'Questions',
					order: 0,
					multiplechoicequestion_questions: questions
						.filter((q) => q.type === 'multiple_choice')
						.map((q, index) => ({
							question: q.text,
							is_mandatory: q.required,
							order: index,
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
						})),
					freetextquestion_questions: questions
						.filter((q) => q.type === 'free_text')
						.map((q, index) => ({
							question: q.text,
							is_mandatory: q.required,
							order: index,
							positive_weight: q.positiveWeight,
							negative_weight: q.negativeWeight,
							is_fatal: q.isFatal,
							llm_guidelines: q.llmGuidelines || null
						}))
				}
			];

			// Create questionnaire
			const response = await questionnaireCreateOrgQuestionnaire({
				path: { organization_id: data.organization.id },
				body: {
					name,
					min_score: minScore,
					evaluation_mode: evaluationMode,
					questionnaire_type: questionnaireType,
					max_submission_age: maxSubmissionAge,
					shuffle_questions: shuffleQuestions,
					shuffle_sections: shuffleSections,
					llm_guidelines: llmGuidelines || null,
					can_retake_after: canRetakeAfter,
					sections
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
	<title>Create Questionnaire - {data.organization.name} Admin</title>
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

	<h1 class="text-3xl font-bold tracking-tight">Create Questionnaire</h1>
	<p class="mt-2 text-sm text-muted-foreground">
		Create an admission form, membership application, or survey for your events
	</p>
</div>

<!-- Form -->
<div class="mx-auto max-w-4xl space-y-6">
	<!-- Basic Information -->
	<Card>
		<CardHeader>
			<CardTitle>Basic Information</CardTitle>
			<CardDescription>Set up the questionnaire name and type</CardDescription>
		</CardHeader>
		<CardContent class="space-y-4">
			<!-- Name -->
			<div class="space-y-2">
				<Label for="name">
					Questionnaire Name
					<span class="text-destructive">*</span>
				</Label>
				<Input
					id="name"
					bind:value={name}
					placeholder="e.g., Membership Application 2025"
					class={errors.name ? 'border-destructive' : ''}
				/>
				{#if errors.name}
					<p class="text-sm text-destructive">{errors.name}</p>
				{/if}
			</div>

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
					Evaluation Mode
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
						{evaluationMode === 'automatic'
							? 'Automatic'
							: evaluationMode === 'manual'
								? 'Manual'
								: 'Hybrid'}
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
			</div>
		</CardContent>
	</Card>

	<!-- Advanced Settings -->
	<Card>
		<CardHeader>
			<CardTitle>Advanced Settings</CardTitle>
			<CardDescription>Optional settings for questionnaire behavior</CardDescription>
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
					<Label for="shuffle-questions" class="font-normal">Shuffle questions for each user</Label>
				</div>
				<div class="flex items-center space-x-2">
					<input
						id="shuffle-sections"
						type="checkbox"
						bind:checked={shuffleSections}
						class="h-4 w-4 rounded border-gray-300"
					/>
					<Label for="shuffle-sections" class="font-normal">Shuffle sections for each user</Label>
				</div>
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

	<!-- Questions -->
	<Card>
		<CardHeader>
			<div class="flex items-center justify-between">
				<div>
					<CardTitle>Questions ({questions.length})</CardTitle>
					<CardDescription>Add questions for users to answer</CardDescription>
				</div>
				<div class="flex gap-2">
					<Button
						variant="outline"
						size="sm"
						onclick={() => addQuestion('multiple_choice')}
						class="gap-2"
					>
						<Plus class="h-4 w-4" />
						Multiple Choice
					</Button>
					<Button
						variant="outline"
						size="sm"
						onclick={() => addQuestion('free_text')}
						class="gap-2"
					>
						<Plus class="h-4 w-4" />
						Free Text
					</Button>
				</div>
			</div>
		</CardHeader>
		<CardContent>
			{#if questions.length === 0}
				<div class="rounded-lg border border-dashed p-8 text-center">
					<p class="text-sm text-muted-foreground">
						No questions yet. Click "Multiple Choice" or "Free Text" to add your first question.
					</p>
				</div>
			{:else}
				<div class="space-y-4">
					{#each questions as question (question.id)}
						<QuestionEditor
							{question}
							onUpdate={(updates) => updateQuestion(question.id, updates)}
							onRemove={() => removeQuestion(question.id)}
						/>
					{/each}
				</div>
			{/if}

			{#if errors.questions}
				<p class="mt-4 text-sm text-destructive">{errors.questions}</p>
			{/if}
		</CardContent>
	</Card>

	<!-- Actions -->
	<div class="flex justify-end gap-3">
		<Button href="/org/{data.organization.slug}/admin/questionnaires" variant="outline">
			Cancel
		</Button>
		<Button onclick={saveQuestionnaire} disabled={isSaving}>
			{isSaving ? 'Saving...' : 'Save Questionnaire'}
		</Button>
	</div>
</div>
