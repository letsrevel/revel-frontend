<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
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
	import {
		ArrowLeft,
		AlertTriangle,
		FileCheck,
		FileEdit,
		Send,
		CalendarCheck,
		Calendar
	} from 'lucide-svelte';
	import QuestionnaireAssignmentModal from '$lib/components/questionnaires/QuestionnaireAssignmentModal.svelte';
	import {
		questionnaireUpdateOrgQuestionnaire,
		questionnaireUpdateQuestionnaireStatus
	} from '$lib/api/generated/sdk.gen';
	import type { PageData } from './$types';
	import type { EvaluationMode, Status } from '$lib/api/generated';
	import { Badge } from '$lib/components/ui/badge';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	// Initialize form state from existing questionnaire (reactive)
	const questionnaire = $derived(data.questionnaire!);
	let name = $state(questionnaire.questionnaire.name);
	let questionnaireType = $state(questionnaire.questionnaire_type);
	let minScore = $state(Number(questionnaire.questionnaire.min_score));
	let evaluationMode = $state<EvaluationMode>(questionnaire.questionnaire.evaluation_mode);
	let shuffleQuestions = $state(questionnaire.questionnaire.shuffle_questions);
	let shuffleSections = $state(questionnaire.questionnaire.shuffle_sections);
	let llmGuidelines = $state(questionnaire.questionnaire.llm_guidelines || '');

	// Convert seconds to appropriate units for display
	let maxSubmissionAge = $state<number | null>(
		questionnaire.max_submission_age && typeof questionnaire.max_submission_age === 'number'
			? Math.round(questionnaire.max_submission_age / 86400)
			: null
	); // Convert seconds to days
	let canRetakeAfter = $state<number | null>(
		questionnaire.questionnaire.can_retake_after &&
			typeof questionnaire.questionnaire.can_retake_after === 'number'
			? Math.round(questionnaire.questionnaire.can_retake_after / 3600)
			: null
	); // Convert seconds to hours
	let maxAttempts = $state<number>(0); // 0 = unlimited

	// Questions (read-only display)
	const sections = $derived(questionnaire.questionnaire.sections || []);
	const topLevelMCQuestions = $derived(
		questionnaire.questionnaire.multiplechoicequestion_questions || []
	);
	const topLevelFTQuestions = $derived(
		questionnaire.questionnaire.freetextquestion_questions || []
	);

	// Count total questions
	const totalQuestions = $derived(() => {
		let count = topLevelMCQuestions.length + topLevelFTQuestions.length;
		sections.forEach((section) => {
			count +=
				(section.multiplechoicequestion_questions?.length || 0) +
				(section.freetextquestion_questions?.length || 0);
		});
		return count;
	});

	// Form validation
	let errors = $state<{
		name?: string;
	}>({});

	// Saving state
	let isSaving = $state(false);

	// Status change state
	let isChangingStatus = $state(false);

	// Assignment modal state
	let isAssignmentModalOpen = $state(false);

	// Current status
	const currentStatus: Status = $derived(questionnaire.questionnaire.status as Status);

	// Status labels, variants, and descriptions
	const statusInfo: Record<
		Status,
		{ label: string; variant: 'outline' | 'secondary' | 'default'; description: string }
	> = {
		draft: {
			label: 'Draft',
			variant: 'outline',
			description: 'Questionnaire is being created and not yet ready for use'
		},
		ready: {
			label: 'Ready',
			variant: 'secondary',
			description: 'Questionnaire is complete and ready to be published'
		},
		published: {
			label: 'Published',
			variant: 'default',
			description: 'Questionnaire is live and can be assigned to events'
		}
	};

	const currentStatusInfo = $derived(statusInfo[currentStatus]);

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

	// Validate form
	function validate(): boolean {
		errors = {};

		if (!name.trim()) {
			errors.name = 'Questionnaire name is required';
		}

		return Object.keys(errors).length === 0;
	}

	// Save questionnaire updates
	async function saveQuestionnaire() {
		if (!validate()) {
			return;
		}

		isSaving = true;

		try {
			const user = data.auth;
			if (!user.accessToken) {
				throw new Error('Not authenticated');
			}

			// Build update payload (metadata only)
			const response = await questionnaireUpdateOrgQuestionnaire({
				path: { org_questionnaire_id: questionnaire.id },
				body: {
					name,
					min_score: minScore,
					evaluation_mode: evaluationMode,
					questionnaire_type: questionnaireType,
					max_submission_age: maxSubmissionAge ? (maxSubmissionAge * 86400).toString() : null, // Convert days to seconds
					shuffle_questions: shuffleQuestions,
					shuffle_sections: shuffleSections,
					llm_guidelines: llmGuidelines || null,
					can_retake_after: canRetakeAfter ? (canRetakeAfter * 3600).toString() : null, // Convert hours to seconds
					max_attempts: maxAttempts
				},
				headers: { Authorization: `Bearer ${user.accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to update questionnaire');
			}

			// Refresh data and redirect to questionnaire list
			await invalidateAll();
			await goto(`/org/${data.organizationSlug}/admin/questionnaires`);
		} catch (err) {
			console.error('Failed to save questionnaire:', err);
			alert('Failed to save questionnaire. Please try again.');
		} finally {
			isSaving = false;
		}
	}

	// Change questionnaire status
	async function changeStatus(newStatus: Status) {
		const statusAction = newStatus === 'published' ? 'publish' : `mark as ${newStatus}`;
		const confirmed = confirm(
			`Are you sure you want to ${statusAction} this questionnaire?\n\n${statusInfo[newStatus].description}`
		);

		if (!confirmed) return;

		isChangingStatus = true;

		try {
			const user = data.auth;
			if (!user.accessToken) {
				throw new Error('Not authenticated');
			}

			const response = await questionnaireUpdateQuestionnaireStatus({
				path: {
					org_questionnaire_id: questionnaire.id,
					status: newStatus
				},
				headers: { Authorization: `Bearer ${user.accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to change status');
			}

			// Refresh data
			await invalidateAll();
		} catch (err) {
			console.error('Failed to change status:', err);
			alert('Failed to change status. Please try again.');
		} finally {
			isChangingStatus = false;
		}
	}
</script>

<svelte:head>
	<title>Edit Questionnaire - {questionnaire.questionnaire.name}</title>
</svelte:head>

<!-- Header -->
<div class="mb-6">
	<Button
		href="/org/{data.organizationSlug}/admin/questionnaires"
		variant="ghost"
		size="sm"
		class="mb-4 gap-2"
	>
		<ArrowLeft class="h-4 w-4" />
		Back to Questionnaires
	</Button>

	<h1 class="text-3xl font-bold tracking-tight">Edit Questionnaire</h1>
	<p class="mt-2 text-sm text-muted-foreground">Update questionnaire settings and metadata</p>
</div>

<!-- Status Management -->
<Card class="mb-6">
	<CardHeader>
		<div class="flex items-center justify-between">
			<div>
				<CardTitle>Status</CardTitle>
				<CardDescription>Manage questionnaire publication status</CardDescription>
			</div>
			<Badge variant={currentStatusInfo.variant} class="text-sm">
				{currentStatusInfo.label}
			</Badge>
		</div>
	</CardHeader>
	<CardContent>
		<div class="space-y-4">
			<p class="text-sm text-muted-foreground">
				{currentStatusInfo.description}
			</p>

			<!-- Status Actions -->
			<div class="flex flex-wrap gap-2">
				{#if currentStatus !== 'draft'}
					<Button
						variant="outline"
						size="sm"
						onclick={() => changeStatus('draft')}
						disabled={isChangingStatus}
						class="gap-2"
					>
						<FileEdit class="h-4 w-4" />
						Mark as Draft
					</Button>
				{/if}

				{#if currentStatus !== 'ready' && currentStatus !== 'published'}
					<Button
						variant="outline"
						size="sm"
						onclick={() => changeStatus('ready')}
						disabled={isChangingStatus}
						class="gap-2"
					>
						<FileCheck class="h-4 w-4" />
						Mark as Ready
					</Button>
				{/if}

				{#if currentStatus === 'published'}
					<Button
						variant="outline"
						size="sm"
						onclick={() => changeStatus('ready')}
						disabled={isChangingStatus}
						class="gap-2"
					>
						<FileCheck class="h-4 w-4" />
						Unpublish
					</Button>
				{/if}

				{#if currentStatus !== 'published'}
					<Button
						variant="default"
						size="sm"
						onclick={() => changeStatus('published')}
						disabled={isChangingStatus}
						class="gap-2"
					>
						<Send class="h-4 w-4" />
						Publish
					</Button>
				{/if}
			</div>
		</div>
	</CardContent>
</Card>

<!-- Warning Banner -->
<div
	class="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900 dark:bg-yellow-950"
>
	<div class="flex gap-3">
		<AlertTriangle class="h-5 w-5 flex-shrink-0 text-yellow-600 dark:text-yellow-500" />
		<div class="text-sm">
			<p class="font-medium text-yellow-800 dark:text-yellow-200">
				Questions cannot be edited after creation
			</p>
			<p class="mt-1 text-yellow-700 dark:text-yellow-300">
				To preserve submission integrity, you can only edit the questionnaire name, type, and
				settings. Questions and their structure are read-only. If you need to change questions,
				create a new questionnaire.
			</p>
		</div>
	</div>
</div>

<!-- Form -->
<div class="mx-auto max-w-4xl space-y-6">
	<!-- Basic Information -->
	<Card>
		<CardHeader>
			<CardTitle>Basic Information</CardTitle>
			<CardDescription>Edit questionnaire name and type</CardDescription>
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
						if (v) {
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
				<Label for="llm-guidelines">LLM Guidelines</Label>
				<Textarea
					id="llm-guidelines"
					bind:value={llmGuidelines}
					placeholder="Instructions for the AI when evaluating free-text answers..."
					rows={4}
				/>
				<p class="text-xs text-muted-foreground">
					Guidelines for AI evaluation (only needed for free-text questions with automatic/hybrid
					mode)
				</p>
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

			<!-- Max Attempts -->
			<div class="space-y-2">
				<Label for="max-attempts">
					Maximum Attempts
					<span class="text-destructive">*</span>
				</Label>
				<Input id="max-attempts" type="number" bind:value={maxAttempts} min="0" step="1" required />
				<p class="text-xs text-muted-foreground">
					Maximum number of attempts allowed (0 = unlimited)
				</p>
			</div>
		</CardContent>
	</Card>

	<!-- Event Assignments -->
	<Card>
		<CardHeader>
			<div class="flex items-center justify-between">
				<div>
					<CardTitle>Event Assignments</CardTitle>
					<CardDescription>Events that require this questionnaire</CardDescription>
				</div>
				<Button
					variant="outline"
					size="sm"
					onclick={() => (isAssignmentModalOpen = true)}
					class="gap-2"
				>
					<CalendarCheck class="h-4 w-4" />
					Manage Assignments
				</Button>
			</div>
		</CardHeader>
		<CardContent>
			{#if (questionnaire.events?.length || 0) === 0 && (questionnaire.event_series?.length || 0) === 0}
				<div class="rounded-lg border border-dashed p-8 text-center">
					<Calendar class="mx-auto mb-2 h-8 w-8 text-muted-foreground" aria-hidden="true" />
					<p class="text-sm font-medium">Not assigned to any events</p>
					<p class="mt-1 text-xs text-muted-foreground">
						Click "Manage Assignments" to assign this questionnaire to events
					</p>
				</div>
			{:else}
				<div class="space-y-4">
					<!-- Individual Events -->
					{#if questionnaire.events && questionnaire.events.length > 0}
						<div>
							<h4 class="mb-2 text-sm font-medium">Individual Events</h4>
							<div class="space-y-2">
								{#each questionnaire.events as event}
									<div class="flex items-center justify-between rounded-lg border p-3">
										<div>
											<p class="font-medium">{event.name}</p>
											{#if event.next_occurrence}
												<p class="text-sm text-muted-foreground">
													{new Date(event.next_occurrence.start_datetime).toLocaleDateString(
														'en-US',
														{
															month: 'short',
															day: 'numeric',
															year: 'numeric'
														}
													)}
												</p>
											{/if}
										</div>
										<Badge variant="outline">{event.event_type}</Badge>
									</div>
								{/each}
							</div>
						</div>
					{/if}

					<!-- Event Series -->
					{#if questionnaire.event_series && questionnaire.event_series.length > 0}
						<div>
							<h4 class="mb-2 text-sm font-medium">Event Series</h4>
							<div class="space-y-2">
								{#each questionnaire.event_series as series}
									<div class="flex items-center justify-between rounded-lg border p-3">
										<div>
											<p class="font-medium">{series.name}</p>
											<p class="text-sm text-muted-foreground">
												{series.event_count || 0}
												{series.event_count === 1 ? 'event' : 'events'}
											</p>
										</div>
										<Badge variant="secondary">Series</Badge>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			{/if}
		</CardContent>
	</Card>

	<!-- Questions (Read-Only Display) -->
	<Card>
		<CardHeader>
			<CardTitle>Questions ({totalQuestions()})</CardTitle>
			<CardDescription>Questions are read-only after creation</CardDescription>
		</CardHeader>
		<CardContent>
			{#if totalQuestions() === 0}
				<div class="rounded-lg border border-dashed p-8 text-center">
					<p class="text-sm text-muted-foreground">No questions in this questionnaire</p>
				</div>
			{:else}
				<div class="space-y-6">
					<!-- Top-level questions (no section) -->
					{#if topLevelMCQuestions.length > 0 || topLevelFTQuestions.length > 0}
						<div class="space-y-3">
							{#each topLevelMCQuestions as question}
								<div class="rounded-lg border p-4">
									<div class="flex items-start gap-3">
										<div class="flex-1">
											<div class="mb-2 flex items-center gap-2">
												<span
													class="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700"
												>
													Multiple Choice
												</span>
												{#if question.is_mandatory}
													<span class="text-xs text-destructive">Required</span>
												{/if}
											</div>
											<p class="font-medium">{question.question}</p>
											<div class="mt-2 space-y-1">
												{#each question.options as option}
													<div class="flex items-center gap-2 text-sm">
														<span
															class={option.is_correct
																? 'font-medium text-green-600'
																: 'text-muted-foreground'}
														>
															{option.is_correct ? '✓' : '○'}
														</span>
														<span class={option.is_correct ? 'font-medium' : ''}>
															{option.option}
														</span>
													</div>
												{/each}
											</div>
										</div>
									</div>
								</div>
							{/each}
							{#each topLevelFTQuestions as question}
								<div class="rounded-lg border p-4">
									<div class="flex items-start gap-3">
										<div class="flex-1">
											<div class="mb-2 flex items-center gap-2">
												<span
													class="rounded bg-purple-100 px-2 py-1 text-xs font-medium text-purple-700"
												>
													Free Text
												</span>
												{#if question.is_mandatory}
													<span class="text-xs text-destructive">Required</span>
												{/if}
											</div>
											<p class="font-medium">{question.question}</p>
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}

					<!-- Sectioned questions -->
					{#each sections as section}
						<div class="space-y-3">
							<div class="flex items-center gap-2 border-b pb-2">
								<h3 class="font-semibold">{section.name}</h3>
								<span class="text-sm text-muted-foreground">
									({(section.multiplechoicequestion_questions?.length || 0) +
										(section.freetextquestion_questions?.length || 0)} questions)
								</span>
							</div>
							{#each section.multiplechoicequestion_questions || [] as question}
								<div class="rounded-lg border p-4">
									<div class="flex items-start gap-3">
										<div class="flex-1">
											<div class="mb-2 flex items-center gap-2">
												<span
													class="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700"
												>
													Multiple Choice
												</span>
												{#if question.is_mandatory}
													<span class="text-xs text-destructive">Required</span>
												{/if}
											</div>
											<p class="font-medium">{question.question}</p>
											<div class="mt-2 space-y-1">
												{#each question.options as option}
													<div class="flex items-center gap-2 text-sm">
														<span
															class={option.is_correct
																? 'font-medium text-green-600'
																: 'text-muted-foreground'}
														>
															{option.is_correct ? '✓' : '○'}
														</span>
														<span class={option.is_correct ? 'font-medium' : ''}>
															{option.option}
														</span>
													</div>
												{/each}
											</div>
										</div>
									</div>
								</div>
							{/each}
							{#each section.freetextquestion_questions || [] as question}
								<div class="rounded-lg border p-4">
									<div class="flex items-start gap-3">
										<div class="flex-1">
											<div class="mb-2 flex items-center gap-2">
												<span
													class="rounded bg-purple-100 px-2 py-1 text-xs font-medium text-purple-700"
												>
													Free Text
												</span>
												{#if question.is_mandatory}
													<span class="text-xs text-destructive">Required</span>
												{/if}
											</div>
											<p class="font-medium">{question.question}</p>
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/each}
				</div>
			{/if}
		</CardContent>
	</Card>

	<!-- Actions -->
	<div class="flex justify-end gap-3">
		<Button href="/org/{data.organizationSlug}/admin/questionnaires" variant="outline">
			Cancel
		</Button>
		<Button onclick={saveQuestionnaire} disabled={isSaving}>
			{isSaving ? 'Saving...' : 'Save Changes'}
		</Button>
	</div>
</div>

<!-- Assignment Modal -->
{#if isAssignmentModalOpen}
	<QuestionnaireAssignmentModal
		bind:open={isAssignmentModalOpen}
		{questionnaire}
		organizationId={data.organization.id}
		accessToken={data.auth.accessToken}
		onClose={() => (isAssignmentModalOpen = false)}
	/>
{/if}
