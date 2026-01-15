<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import * as m from '$lib/paraglide/messages.js';
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
		Calendar,
		Plus,
		Trash2,
		Pencil,
		Check,
		X,
		GripVertical,
		FolderPlus
	} from 'lucide-svelte';
	import QuestionnaireAssignmentModal from '$lib/components/questionnaires/QuestionnaireAssignmentModal.svelte';
	import {
		questionnaireUpdateOrgQuestionnaire,
		questionnaireUpdateQuestionnaireStatus,
		questionnaireCreateSection,
		questionnaireUpdateSection,
		questionnaireDeleteSection,
		questionnaireCreateMcQuestion,
		questionnaireUpdateMcQuestion,
		questionnaireDeleteMcQuestion,
		questionnaireCreateMcOption,
		questionnaireUpdateMcOption,
		questionnaireDeleteMcOption,
		questionnaireCreateFtQuestion,
		questionnaireUpdateFtQuestion,
		questionnaireDeleteFtQuestion
	} from '$lib/api/generated/sdk.gen';
	import type { PageData } from './$types';
	import type {
		QuestionnaireEvaluationMode,
		QuestionnaireStatus
	} from '$lib/api/generated/types.gen';
	import { Badge } from '$lib/components/ui/badge';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	// Initialize form state from existing questionnaire (reactive)
	const questionnaire = $derived(data.questionnaire);

	// Early return if questionnaire is not loaded
	const isLoaded = $derived(!!questionnaire?.questionnaire);

	// Safe access to nested questionnaire
	const q = $derived(questionnaire?.questionnaire);

	let name = $state(q?.name ?? '');
	let questionnaireType = $state(questionnaire?.questionnaire_type ?? 'admission');
	let minScore = $state(Number(q?.min_score ?? 0));
	let evaluationMode = $state<QuestionnaireEvaluationMode>(
		(q?.evaluation_mode as QuestionnaireEvaluationMode) ?? 'automatic'
	);
	let shuffleQuestions = $state(q?.shuffle_questions ?? false);
	let shuffleSections = $state(q?.shuffle_sections ?? false);
	let llmGuidelines = $state(q?.llm_guidelines || '');
	let membersExempt = $state(questionnaire?.members_exempt ?? false);

	// Convert seconds to appropriate units for display
	let maxSubmissionAge = $state<number | null>(
		questionnaire?.max_submission_age && typeof questionnaire.max_submission_age === 'number'
			? Math.round(questionnaire.max_submission_age / 86400)
			: null
	); // Convert seconds to days
	let canRetakeAfter = $state<number | null>(
		q?.can_retake_after && typeof q.can_retake_after === 'number'
			? Math.round(q.can_retake_after / 3600)
			: null
	); // Convert seconds to hours
	let maxAttempts = $state<number>(0); // 0 = unlimited

	// Questions (read-only display)
	const sections = $derived(q?.sections ?? []);
	const topLevelMCQuestions = $derived(q?.multiplechoicequestion_questions ?? []);
	const topLevelFTQuestions = $derived(q?.freetextquestion_questions ?? []);

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

	// Editing state - enabled when questionnaire is in draft status
	let editingQuestionId = $state<string | null>(null);
	let editingQuestionText = $state('');
	let editingSectionId = $state<string | null>(null);
	let editingSectionName = $state('');
	let editingOptionId = $state<string | null>(null);
	let editingOptionText = $state('');
	let isAddingSection = $state(false);
	let isAddingQuestion = $state<{ sectionId: string | null; type: 'mc' | 'ft' } | null>(null);
	let operationInProgress = $state(false);

	// Helper to start editing a question
	function startEditingQuestion(questionId: string, currentText: string) {
		if (!canEdit) return;
		editingQuestionId = questionId;
		editingQuestionText = currentText;
	}

	// Helper to start editing a section
	function startEditingSection(sectionId: string, currentName: string) {
		if (!canEdit) return;
		editingSectionId = sectionId;
		editingSectionName = currentName;
	}

	// Helper to start editing an option
	function startEditingOption(optionId: string, currentText: string) {
		if (!canEdit) return;
		editingOptionId = optionId;
		editingOptionText = currentText;
	}

	// Cancel all editing
	function cancelEditing() {
		editingQuestionId = null;
		editingQuestionText = '';
		editingSectionId = null;
		editingSectionName = '';
		editingOptionId = null;
		editingOptionText = '';
	}

	// Check if editing is allowed (only in draft status)
	const canEdit = $derived(q?.status === 'draft');

	// Current status
	const currentStatus = $derived<QuestionnaireStatus>(
		(q?.status as QuestionnaireStatus) ?? 'draft'
	);

	// Status labels, variants, and descriptions
	const statusInfo: Record<
		QuestionnaireStatus,
		{ label: string; variant: 'outline' | 'secondary' | 'default'; description: string }
	> = {
		draft: {
			label: m['questionnaireEditPage.status.draft_label'](),
			variant: 'outline',
			description: m['questionnaireEditPage.status.draft_description']()
		},
		ready: {
			label: m['questionnaireEditPage.status.ready_label'](),
			variant: 'secondary',
			description: m['questionnaireEditPage.status.ready_description']()
		},
		published: {
			label: m['questionnaireEditPage.status.published_label'](),
			variant: 'default',
			description: m['questionnaireEditPage.status.published_description']()
		}
	};

	const currentStatusInfo = $derived(statusInfo[currentStatus]);

	// Questionnaire type labels and descriptions
	const questionnaireTypes = {
		admission: {
			label: m['questionnaireEditPage.types.admission_label'](),
			description: m['questionnaireEditPage.types.admission_description']()
		},
		membership: {
			label: m['questionnaireEditPage.types.membership_label'](),
			description: m['questionnaireEditPage.types.membership_description']()
		},
		feedback: {
			label: m['questionnaireEditPage.types.feedback_label'](),
			description: m['questionnaireEditPage.types.feedback_description']()
		},
		generic: {
			label: m['questionnaireEditPage.types.generic_label'](),
			description: m['questionnaireEditPage.types.generic_description']()
		}
	};

	// Get display label for current type
	const selectedTypeLabel = $derived(questionnaireTypes[questionnaireType]?.label ?? 'Generic');

	// Get current description safely
	const selectedTypeDescription = $derived(
		questionnaireTypes[questionnaireType]?.description ??
			m['questionnaireEditPage.types.generic_description']()
	);

	// Evaluation mode descriptions
	const evaluationModes: Record<
		QuestionnaireEvaluationMode,
		{ label: string; description: string }
	> = {
		automatic: {
			label: m['questionnaireEditPage.evaluation.automatic_label'](),
			description: m['questionnaireEditPage.evaluation.automatic_description']()
		},
		manual: {
			label: m['questionnaireEditPage.evaluation.manual_label'](),
			description: m['questionnaireEditPage.evaluation.manual_description']()
		},
		hybrid: {
			label: m['questionnaireEditPage.evaluation.hybrid_label'](),
			description: m['questionnaireEditPage.evaluation.hybrid_description']()
		}
	};

	const selectedEvaluationDescription = $derived(
		evaluationModes[evaluationMode]?.description ??
			m['questionnaireEditPage.evaluation.automatic_description']()
	);

	// Validate form
	function validate(): boolean {
		errors = {};

		if (!name.trim()) {
			errors.name = m['questionnaireEditPage.basicInfo.nameRequired']();
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
				throw new Error(m['questionnaireEditPage.error_notAuthenticated']());
			}

			// Build update payload (metadata only)
			const response = await questionnaireUpdateOrgQuestionnaire({
				path: { org_questionnaire_id: getOrgQuestionnaireId() },
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
					max_attempts: maxAttempts,
					members_exempt: membersExempt
				},
				headers: { Authorization: `Bearer ${user.accessToken}` }
			});

			if (response.error) {
				throw new Error(m['questionnaireEditPage.error_updateFailed']());
			}

			// Refresh data and redirect to questionnaire list
			await invalidateAll();
			await goto(`/org/${data.organizationSlug}/admin/questionnaires`);
		} catch (err) {
			console.error('Failed to save questionnaire:', err);
			alert(m['questionnaireEditPage.error_updateFailedMessage']());
		} finally {
			isSaving = false;
		}
	}

	// Change questionnaire status
	async function changeStatus(newStatus: QuestionnaireStatus) {
		const statusAction = newStatus === 'published' ? 'publish' : `mark as ${newStatus}`;
		const confirmed = confirm(
			`Are you sure you want to ${statusAction} this questionnaire?\n\n${statusInfo[newStatus].description}`
		);

		if (!confirmed) return;

		isChangingStatus = true;

		try {
			const user = data.auth;
			if (!user.accessToken) {
				throw new Error(m['questionnaireEditPage.error_notAuthenticated']());
			}

			const response = await questionnaireUpdateQuestionnaireStatus({
				path: {
					org_questionnaire_id: getOrgQuestionnaireId(),
					status: newStatus
				},
				headers: { Authorization: `Bearer ${user.accessToken}` }
			});

			if (response.error) {
				throw new Error(m['questionnaireEditPage.error_statusChangeFailed']());
			}

			// Refresh data
			await invalidateAll();
		} catch (err) {
			console.error('Failed to change status:', err);
			alert(m['questionnaireEditPage.error_statusChangeFailedMessage']());
		} finally {
			isChangingStatus = false;
		}
	}

	// Helper to get org questionnaire ID safely
	function getOrgQuestionnaireId(): string {
		if (!questionnaire?.id) throw new Error('Questionnaire not loaded');
		return questionnaire.id;
	}

	// ===== SECTION CRUD OPERATIONS =====

	async function addSection() {
		if (!canEdit || operationInProgress) return;

		const sectionName = prompt('Enter section name:', `Section ${(sections?.length || 0) + 1}`);
		if (!sectionName?.trim()) return;

		operationInProgress = true;

		try {
			const user = data.auth;
			if (!user.accessToken) throw new Error('Not authenticated');

			const response = await questionnaireCreateSection({
				path: { org_questionnaire_id: getOrgQuestionnaireId() },
				body: {
					name: sectionName.trim(),
					description: null,
					order: sections?.length || 0
				},
				headers: { Authorization: `Bearer ${user.accessToken}` }
			});

			if (response.error) throw new Error('Failed to create section');
			await invalidateAll();
		} catch (err) {
			console.error('Failed to add section:', err);
			alert('Failed to add section. Please try again.');
		} finally {
			operationInProgress = false;
			isAddingSection = false;
		}
	}

	async function updateSection(sectionId: string, updates: { name?: string; description?: string | null; order?: number }) {
		if (!canEdit || operationInProgress) return;
		operationInProgress = true;

		try {
			const user = data.auth;
			if (!user.accessToken) throw new Error('Not authenticated');

			const section = sections.find(s => s.id === sectionId);
			if (!section) throw new Error('Section not found');

			const response = await questionnaireUpdateSection({
				path: { org_questionnaire_id: getOrgQuestionnaireId(), section_id: sectionId },
				body: {
					name: updates.name ?? section.name,
					description: updates.description !== undefined ? updates.description : section.description,
					order: updates.order ?? section.order
				},
				headers: { Authorization: `Bearer ${user.accessToken}` }
			});

			if (response.error) throw new Error('Failed to update section');
			await invalidateAll();
		} catch (err) {
			console.error('Failed to update section:', err);
			alert('Failed to update section. Please try again.');
		} finally {
			operationInProgress = false;
			editingSectionId = null;
		}
	}

	async function deleteSection(sectionId: string) {
		if (!canEdit || operationInProgress) return;

		const confirmed = confirm('Are you sure you want to delete this section? All questions in this section will also be deleted.');
		if (!confirmed) return;

		operationInProgress = true;

		try {
			const user = data.auth;
			if (!user.accessToken) throw new Error('Not authenticated');

			const response = await questionnaireDeleteSection({
				path: { org_questionnaire_id: getOrgQuestionnaireId(), section_id: sectionId },
				headers: { Authorization: `Bearer ${user.accessToken}` }
			});

			if (response.error) throw new Error('Failed to delete section');
			await invalidateAll();
		} catch (err) {
			console.error('Failed to delete section:', err);
			alert('Failed to delete section. Please try again.');
		} finally {
			operationInProgress = false;
		}
	}

	// ===== MC QUESTION CRUD OPERATIONS =====

	async function addMcQuestion(sectionId: string | null) {
		if (!canEdit || operationInProgress) return;

		const questionText = prompt('Enter the question:');
		if (!questionText?.trim()) return;

		const firstOption = prompt('Enter the first (correct) option:');
		if (!firstOption?.trim()) return;

		const secondOption = prompt('Enter the second (incorrect) option:');
		if (!secondOption?.trim()) return;

		operationInProgress = true;

		try {
			const user = data.auth;
			if (!user.accessToken) throw new Error('Not authenticated');

			const response = await questionnaireCreateMcQuestion({
				path: { org_questionnaire_id: getOrgQuestionnaireId() },
				body: {
					section_id: sectionId,
					question: questionText.trim(),
					is_mandatory: true,
					order: 0,
					positive_weight: 1.0,
					negative_weight: 0.0,
					is_fatal: false,
					allow_multiple_answers: false,
					shuffle_options: true,
					options: [
						{ option: firstOption.trim(), is_correct: true, order: 0 },
						{ option: secondOption.trim(), is_correct: false, order: 1 }
					]
				},
				headers: { Authorization: `Bearer ${user.accessToken}` }
			});

			if (response.error) throw new Error('Failed to create question');
			await invalidateAll();
		} catch (err) {
			console.error('Failed to add MC question:', err);
			alert('Failed to add question. Please try again.');
		} finally {
			operationInProgress = false;
			isAddingQuestion = null;
		}
	}

	async function updateMcQuestion(questionId: string | undefined, updates: { question?: string; hint?: string | null; is_mandatory?: boolean; positive_weight?: number; negative_weight?: number; is_fatal?: boolean; allow_multiple_answers?: boolean; shuffle_options?: boolean }) {
		if (!canEdit || operationInProgress || !questionId) return;
		operationInProgress = true;

		try {
			const user = data.auth;
			if (!user.accessToken) throw new Error('Not authenticated');

			// Find the question to get current values
			let currentQuestion = topLevelMCQuestions.find(q => q.id === questionId);
			if (!currentQuestion) {
				for (const section of sections) {
					currentQuestion = section.multiplechoicequestion_questions?.find(q => q.id === questionId);
					if (currentQuestion) break;
				}
			}
			if (!currentQuestion) throw new Error('Question not found');

			const response = await questionnaireUpdateMcQuestion({
				path: { org_questionnaire_id: getOrgQuestionnaireId(), question_id: questionId },
				body: {
					question: updates.question ?? currentQuestion.question,
					hint: updates.hint !== undefined ? updates.hint : currentQuestion.hint,
					is_mandatory: updates.is_mandatory ?? currentQuestion.is_mandatory,
					positive_weight: updates.positive_weight ?? currentQuestion.positive_weight,
					negative_weight: updates.negative_weight ?? currentQuestion.negative_weight,
					is_fatal: updates.is_fatal ?? currentQuestion.is_fatal,
					allow_multiple_answers: updates.allow_multiple_answers ?? currentQuestion.allow_multiple_answers,
					shuffle_options: updates.shuffle_options ?? currentQuestion.shuffle_options
				},
				headers: { Authorization: `Bearer ${user.accessToken}` }
			});

			if (response.error) throw new Error('Failed to update question');
			await invalidateAll();
		} catch (err) {
			console.error('Failed to update MC question:', err);
			alert('Failed to update question. Please try again.');
		} finally {
			operationInProgress = false;
			editingQuestionId = null;
		}
	}

	async function deleteMcQuestion(questionId: string | undefined) {
		if (!canEdit || operationInProgress || !questionId) return;

		const confirmed = confirm('Are you sure you want to delete this question?');
		if (!confirmed) return;

		operationInProgress = true;

		try {
			const user = data.auth;
			if (!user.accessToken) throw new Error('Not authenticated');

			const response = await questionnaireDeleteMcQuestion({
				path: { org_questionnaire_id: getOrgQuestionnaireId(), question_id: questionId },
				headers: { Authorization: `Bearer ${user.accessToken}` }
			});

			if (response.error) throw new Error('Failed to delete question');
			await invalidateAll();
		} catch (err) {
			console.error('Failed to delete MC question:', err);
			alert('Failed to delete question. Please try again.');
		} finally {
			operationInProgress = false;
		}
	}

	// ===== FT QUESTION CRUD OPERATIONS =====

	async function addFtQuestion(sectionId: string | null) {
		if (!canEdit || operationInProgress) return;

		const questionText = prompt('Enter the question:');
		if (!questionText?.trim()) return;

		operationInProgress = true;

		try {
			const user = data.auth;
			if (!user.accessToken) throw new Error('Not authenticated');

			const response = await questionnaireCreateFtQuestion({
				path: { org_questionnaire_id: getOrgQuestionnaireId() },
				body: {
					section_id: sectionId,
					question: questionText.trim(),
					is_mandatory: true,
					order: 0,
					positive_weight: 1.0,
					negative_weight: 0.0,
					is_fatal: false
				},
				headers: { Authorization: `Bearer ${user.accessToken}` }
			});

			if (response.error) throw new Error('Failed to create question');
			await invalidateAll();
		} catch (err) {
			console.error('Failed to add FT question:', err);
			alert('Failed to add question. Please try again.');
		} finally {
			operationInProgress = false;
			isAddingQuestion = null;
		}
	}

	async function updateFtQuestion(questionId: string | undefined, updates: { question?: string; hint?: string | null; is_mandatory?: boolean; positive_weight?: number; negative_weight?: number; is_fatal?: boolean; llm_guidelines?: string | null }) {
		if (!canEdit || operationInProgress || !questionId) return;
		operationInProgress = true;

		try {
			const user = data.auth;
			if (!user.accessToken) throw new Error('Not authenticated');

			// Find the question to get current values
			let currentQuestion = topLevelFTQuestions.find(q => q.id === questionId);
			if (!currentQuestion) {
				for (const section of sections) {
					currentQuestion = section.freetextquestion_questions?.find(q => q.id === questionId);
					if (currentQuestion) break;
				}
			}
			if (!currentQuestion) throw new Error('Question not found');

			const response = await questionnaireUpdateFtQuestion({
				path: { org_questionnaire_id: getOrgQuestionnaireId(), question_id: questionId },
				body: {
					question: updates.question ?? currentQuestion.question,
					hint: updates.hint !== undefined ? updates.hint : currentQuestion.hint,
					is_mandatory: updates.is_mandatory ?? currentQuestion.is_mandatory,
					positive_weight: updates.positive_weight ?? currentQuestion.positive_weight,
					negative_weight: updates.negative_weight ?? currentQuestion.negative_weight,
					is_fatal: updates.is_fatal ?? currentQuestion.is_fatal,
					llm_guidelines: updates.llm_guidelines !== undefined ? updates.llm_guidelines : currentQuestion.llm_guidelines
				},
				headers: { Authorization: `Bearer ${user.accessToken}` }
			});

			if (response.error) throw new Error('Failed to update question');
			await invalidateAll();
		} catch (err) {
			console.error('Failed to update FT question:', err);
			alert('Failed to update question. Please try again.');
		} finally {
			operationInProgress = false;
			editingQuestionId = null;
		}
	}

	async function deleteFtQuestion(questionId: string | undefined) {
		if (!canEdit || operationInProgress || !questionId) return;

		const confirmed = confirm('Are you sure you want to delete this question?');
		if (!confirmed) return;

		operationInProgress = true;

		try {
			const user = data.auth;
			if (!user.accessToken) throw new Error('Not authenticated');

			const response = await questionnaireDeleteFtQuestion({
				path: { org_questionnaire_id: getOrgQuestionnaireId(), question_id: questionId },
				headers: { Authorization: `Bearer ${user.accessToken}` }
			});

			if (response.error) throw new Error('Failed to delete question');
			await invalidateAll();
		} catch (err) {
			console.error('Failed to delete FT question:', err);
			alert('Failed to delete question. Please try again.');
		} finally {
			operationInProgress = false;
		}
	}

	// ===== MC OPTION CRUD OPERATIONS =====

	async function addMcOption(questionId: string | undefined) {
		if (!canEdit || operationInProgress || !questionId) return;

		const optionText = prompt('Enter option text:');
		if (!optionText?.trim()) return;

		operationInProgress = true;

		try {
			const user = data.auth;
			if (!user.accessToken) throw new Error('Not authenticated');

			const response = await questionnaireCreateMcOption({
				path: { org_questionnaire_id: getOrgQuestionnaireId(), question_id: questionId },
				body: {
					option: optionText.trim(),
					is_correct: false,
					order: 0
				},
				headers: { Authorization: `Bearer ${user.accessToken}` }
			});

			if (response.error) throw new Error('Failed to create option');
			await invalidateAll();
		} catch (err) {
			console.error('Failed to add option:', err);
			alert('Failed to add option. Please try again.');
		} finally {
			operationInProgress = false;
		}
	}

	async function updateMcOption(optionId: string | undefined, updates: { option?: string; is_correct?: boolean; order?: number }) {
		if (!canEdit || operationInProgress || !optionId) return;
		operationInProgress = true;

		try {
			const user = data.auth;
			if (!user.accessToken) throw new Error('Not authenticated');

			const response = await questionnaireUpdateMcOption({
				path: { org_questionnaire_id: getOrgQuestionnaireId(), option_id: optionId },
				body: updates,
				headers: { Authorization: `Bearer ${user.accessToken}` }
			});

			if (response.error) throw new Error('Failed to update option');
			await invalidateAll();
		} catch (err) {
			console.error('Failed to update option:', err);
			alert('Failed to update option. Please try again.');
		} finally {
			operationInProgress = false;
		}
	}

	async function deleteMcOption(optionId: string | undefined) {
		if (!canEdit || operationInProgress || !optionId) return;

		const confirmed = confirm('Are you sure you want to delete this option?');
		if (!confirmed) return;

		operationInProgress = true;

		try {
			const user = data.auth;
			if (!user.accessToken) throw new Error('Not authenticated');

			const response = await questionnaireDeleteMcOption({
				path: { org_questionnaire_id: getOrgQuestionnaireId(), option_id: optionId },
				headers: { Authorization: `Bearer ${user.accessToken}` }
			});

			if (response.error) throw new Error('Failed to delete option');
			await invalidateAll();
		} catch (err) {
			console.error('Failed to delete option:', err);
			alert('Failed to delete option. Please try again.');
		} finally {
			operationInProgress = false;
		}
	}
</script>

<svelte:head>
	<title>{m['questionnaireEditPage.pageTitle']()} - {q?.name ?? ''}</title>
</svelte:head>

{#if !isLoaded}
	<div class="flex min-h-[50vh] items-center justify-center">
		<div class="text-center">
			<div class="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
			<p class="mt-4 text-muted-foreground">Loading questionnaire...</p>
		</div>
	</div>
{:else}
<!-- Header -->
<div class="mb-6">
	<Button
		href="/org/{data.organizationSlug}/admin/questionnaires"
		variant="ghost"
		size="sm"
		class="mb-4 gap-2"
	>
		<ArrowLeft class="h-4 w-4" />
		{m['questionnaireEditPage.backButton']()}
	</Button>

	<h1 class="text-3xl font-bold tracking-tight">{m['questionnaireEditPage.title']()}</h1>
	<p class="mt-2 text-sm text-muted-foreground">{m['questionnaireEditPage.subtitle']()}</p>
</div>

<!-- Status Management -->
<Card
	class="mb-6 {currentStatus === 'draft'
		? 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30'
		: ''}"
>
	<CardHeader>
		<div class="flex items-center justify-between">
			<div>
				<CardTitle>{m['questionnaireEditPage.status.title']()}</CardTitle>
				<CardDescription
					class={currentStatus === 'draft' ? 'text-amber-700 dark:text-amber-300' : ''}
					>{m['questionnaireEditPage.status.description']()}</CardDescription
				>
			</div>
			{#if currentStatus === 'draft'}
				<Badge class="bg-amber-500 text-sm text-white hover:bg-amber-600">
					{currentStatusInfo.label}
				</Badge>
			{:else}
				<Badge variant={currentStatusInfo.variant} class="text-sm">
					{currentStatusInfo.label}
				</Badge>
			{/if}
		</div>
	</CardHeader>
	<CardContent>
		<div class="space-y-4">
			<p
				class="text-sm {currentStatus === 'draft'
					? 'text-amber-700 dark:text-amber-300'
					: 'text-muted-foreground'}"
			>
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
						{m['questionnaireEditPage.status.markAsDraftButton']()}
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
						{m['questionnaireEditPage.status.markAsReadyButton']()}
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
						{m['questionnaireEditPage.status.unpublishButton']()}
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
						{m['questionnaireEditPage.status.publishButton']()}
					</Button>
				{/if}
			</div>
		</div>
	</CardContent>
</Card>

<!-- Info Banner -->
{#if canEdit}
	<div
		class="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950"
	>
		<div class="flex gap-3">
			<Pencil class="h-5 w-5 flex-shrink-0 text-green-600 dark:text-green-500" />
			<div class="text-sm">
				<p class="font-medium text-green-800 dark:text-green-200">
					Editing enabled
				</p>
				<p class="mt-1 text-green-700 dark:text-green-300">
					This questionnaire is in draft status. You can edit questions, sections, and options.
					Once published, editing will be restricted to preserve submission integrity.
				</p>
			</div>
		</div>
	</div>
{:else}
	<div
		class="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900 dark:bg-yellow-950"
	>
		<div class="flex gap-3">
			<AlertTriangle class="h-5 w-5 flex-shrink-0 text-yellow-600 dark:text-yellow-500" />
			<div class="text-sm">
				<p class="font-medium text-yellow-800 dark:text-yellow-200">
					Questions cannot be edited
				</p>
				<p class="mt-1 text-yellow-700 dark:text-yellow-300">
					This questionnaire is {currentStatus}. To edit questions, change the status back to draft.
					Note: this may affect existing submissions.
				</p>
			</div>
		</div>
	</div>
{/if}

<!-- Form -->
<div class="mx-auto max-w-4xl space-y-6">
	<!-- Basic Information -->
	<Card>
		<CardHeader>
			<CardTitle>{m['questionnaireEditPage.basicInfo.title']()}</CardTitle>
			<CardDescription>{m['questionnaireEditPage.basicInfo.description']()}</CardDescription>
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
						// Only allow admission for now
						if (v === 'admission') {
							questionnaireType = v;
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
						<SelectItem value="membership" label="Membership" disabled>
							<div class="flex flex-col gap-0.5">
								<div class="flex items-center gap-2 font-medium">
									Membership
									<span
										class="rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground"
										>Coming soon</span
									>
								</div>
								<div class="text-xs text-muted-foreground">
									Gate organization membership - required for joining
								</div>
							</div>
						</SelectItem>
						<SelectItem value="feedback" label="Feedback" disabled>
							<div class="flex flex-col gap-0.5">
								<div class="flex items-center gap-2 font-medium">
									Feedback
									<span
										class="rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground"
										>Coming soon</span
									>
								</div>
								<div class="text-xs text-muted-foreground">
									Collect post-event feedback from attendees
								</div>
							</div>
						</SelectItem>
						<SelectItem value="generic" label="Generic" disabled>
							<div class="flex flex-col gap-0.5">
								<div class="flex items-center gap-2 font-medium">
									Generic
									<span
										class="rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground"
										>Coming soon</span
									>
								</div>
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
					{m['questionnaireEditPage.evaluation.minScoreDescription']()}
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
			<CardTitle>{m['questionnaireEditPage.advanced.title']()}</CardTitle>
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
						>{m['questionnaireEditPage.membersExemptLabel']()}</Label
					>
				</div>
				<p class="text-xs text-muted-foreground">
					{m['questionnaireEditPage.membersExemptDescription']()}
				</p>
			</div>

			<!-- LLM Guidelines -->
			<div class="space-y-2">
				<Label for="llm-guidelines"
					>{m['questionnaireEditPage.advanced.llmGuidelinesLabel']()}</Label
				>
				<Textarea
					id="llm-guidelines"
					bind:value={llmGuidelines}
					placeholder={m['questionnaireEditPage.advanced.llmGuidelinesPlaceholder']()}
					rows={4}
				/>
				<p class="text-xs text-muted-foreground">
					{m['questionnaireEditPage.advanced.llmGuidelinesDescription']()}
				</p>
			</div>

			<!-- Duration Settings -->
			<div class="grid gap-4 sm:grid-cols-2">
				<!-- Max Submission Age -->
				<div class="space-y-2">
					<Label for="max-submission-age"
						>{m['questionnaireEditPage.advanced.submissionValidityLabel']()}</Label
					>
					<Input
						id="max-submission-age"
						type="number"
						bind:value={maxSubmissionAge}
						min="0"
						step="1"
						placeholder={m['questionnaireEditPage.advanced.submissionValidityPlaceholder']()}
					/>
					<p class="text-xs text-muted-foreground">
						{m['questionnaireEditPage.advanced.submissionValidityDescription']()}
					</p>
				</div>

				<!-- Can Retake After -->
				<div class="space-y-2">
					<Label for="can-retake-after"
						>{m['questionnaireEditPage.advanced.retakeCooldownLabel']()}</Label
					>
					<Input
						id="can-retake-after"
						type="number"
						bind:value={canRetakeAfter}
						min="0"
						step="1"
						placeholder={m['questionnaireEditPage.advanced.retakeCooldownPlaceholder']()}
					/>
					<p class="text-xs text-muted-foreground">
						{m['questionnaireEditPage.advanced.retakeCooldownDescription']()}
					</p>
				</div>
			</div>

			<!-- Max Attempts -->
			<div class="space-y-2">
				<Label for="max-attempts">
					{m['questionnaireEditPage.advanced.maxAttemptsLabel']()}
					<span class="text-destructive">*</span>
				</Label>
				<Input id="max-attempts" type="number" bind:value={maxAttempts} min="0" step="1" required />
				<p class="text-xs text-muted-foreground">
					{m['questionnaireEditPage.advanced.maxAttemptsDescription']()}
				</p>
			</div>
		</CardContent>
	</Card>

	<!-- Event Assignments -->
	<Card>
		<CardHeader>
			<div class="flex items-center justify-between">
				<div>
					<CardTitle>{m['questionnaireEditPage.assignments.title']()}</CardTitle>
					<CardDescription>{m['questionnaireEditPage.assignments.description']()}</CardDescription>
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
					<p class="text-sm font-medium">
						{m['questionnaireEditPage.assignments.noAssignments']()}
					</p>
					<p class="mt-1 text-xs text-muted-foreground">
						{m['questionnaireEditPage.assignments.noAssignmentsDescription']()}
					</p>
				</div>
			{:else}
				<div class="space-y-4">
					<!-- Individual Events -->
					{#if questionnaire.events && questionnaire.events.length > 0}
						<div>
							<h4 class="mb-2 text-sm font-medium">
								{m['questionnaireEditPage.assignments.individualEventsTitle']()}
							</h4>
							<div class="space-y-2">
								{#each questionnaire.events as event}
									<div class="flex items-center justify-between rounded-lg border p-3">
										<div>
											<p class="font-medium">{event.name}</p>
											{#if event.start}
												<p class="text-sm text-muted-foreground">
													{new Date(event.start).toLocaleDateString('en-US', {
														month: 'short',
														day: 'numeric',
														year: 'numeric'
													})}
												</p>
											{/if}
										</div>
										<Badge variant="outline">{(event as any).event_type}</Badge>
									</div>
								{/each}
							</div>
						</div>
					{/if}

					<!-- Event Series -->
					{#if questionnaire.event_series && questionnaire.event_series.length > 0}
						<div>
							<h4 class="mb-2 text-sm font-medium">
								{m['questionnaireEditPage.assignments.eventSeriesTitle']()}
							</h4>
							<div class="space-y-2">
								{#each questionnaire.event_series as series}
									<div class="flex items-center justify-between rounded-lg border p-3">
										<div>
											<p class="font-medium">{series.name}</p>
											<p class="text-sm text-muted-foreground">
												{(series as any).event_count || 0}
												{(series as any).event_count === 1 ? 'event' : 'events'}
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

	<!-- Questions Section -->
	<Card>
		<CardHeader>
			<div class="flex items-center justify-between">
				<div>
					<CardTitle>{m['questionnaireEditPage.questions.title']()} ({totalQuestions()})</CardTitle>
					<CardDescription>{m['questionnaireEditPage.questions.description']()}</CardDescription>
				</div>
				{#if canEdit}
					<div class="flex gap-2">
						<Button
							variant="outline"
							size="sm"
							onclick={() => addMcQuestion(null)}
							disabled={operationInProgress}
							class="gap-2"
						>
							<Plus class="h-4 w-4" />
							MC Question
						</Button>
						<Button
							variant="outline"
							size="sm"
							onclick={() => addFtQuestion(null)}
							disabled={operationInProgress}
							class="gap-2"
						>
							<Plus class="h-4 w-4" />
							Text Question
						</Button>
						<Button
							variant="secondary"
							size="sm"
							onclick={addSection}
							disabled={operationInProgress}
							class="gap-2"
						>
							<FolderPlus class="h-4 w-4" />
							Section
						</Button>
					</div>
				{/if}
			</div>
		</CardHeader>
		<CardContent>
			{#if totalQuestions() === 0 && sections.length === 0}
				<div class="rounded-lg border border-dashed p-8 text-center">
					<p class="text-sm text-muted-foreground">
						{m['questionnaireEditPage.questions.empty']()}
					</p>
					{#if canEdit}
						<p class="mt-2 text-sm text-muted-foreground">
							Click the buttons above to add questions or sections.
						</p>
					{/if}
				</div>
			{:else}
				<div class="space-y-6">
					<!-- Top-level questions (no section) -->
					{#if topLevelMCQuestions.length > 0 || topLevelFTQuestions.length > 0}
						<div class="space-y-3">
							<h3 class="text-sm font-medium text-muted-foreground">Top-level Questions</h3>
							{#each topLevelMCQuestions as question, idx (question.id ?? `mc-${idx}`)}
								<div class="rounded-lg border p-4 {canEdit ? 'hover:border-primary/50' : ''}">
									<div class="flex items-start gap-3">
										<div class="flex-1">
											<div class="mb-2 flex items-center justify-between">
												<div class="flex items-center gap-2">
													<span class="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
														{m['questionnaireEditPage.questions.multipleChoiceLabel']()}
													</span>
													{#if question.is_mandatory}
														<span class="text-xs text-destructive">{m['questionnaireEditPage.questions.requiredLabel']()}</span>
													{/if}
												</div>
												{#if canEdit}
													<div class="flex gap-1">
														<Button
															variant="ghost"
															size="sm"
															onclick={() => deleteMcQuestion(question.id)}
															disabled={operationInProgress}
															class="h-8 w-8 p-0 text-destructive hover:text-destructive"
														>
															<Trash2 class="h-4 w-4" />
														</Button>
													</div>
												{/if}
											</div>
											{#if canEdit}
												<button
													type="button"
													class="cursor-pointer text-left font-medium hover:text-primary hover:underline"
													onclick={() => {
														const newText = prompt('Edit question:', question.question);
														if (newText?.trim() && newText !== question.question) {
															updateMcQuestion(question.id, { question: newText.trim() });
														}
													}}
												>
													{question.question}
												</button>
											{:else}
												<p class="font-medium">{question.question}</p>
											{/if}
											<div class="mt-2 space-y-1">
												{#each question.options as option, oIdx (option.id ?? `opt-${oIdx}`)}
													<div class="group flex items-center gap-2 text-sm">
														<button
															type="button"
															class="flex items-center gap-1 {canEdit ? 'cursor-pointer hover:text-primary' : ''}"
															onclick={() => canEdit && updateMcOption(option.id, { is_correct: !option.is_correct })}
															disabled={!canEdit || operationInProgress}
															title="Click to toggle correct/incorrect"
														>
															<span class={option.is_correct ? 'font-medium text-green-600' : 'text-muted-foreground'}>
																{option.is_correct ? '✓' : '○'}
															</span>
														</button>
														{#if canEdit}
															<button
																type="button"
																class="cursor-pointer hover:text-primary hover:underline {option.is_correct ? 'font-medium' : ''}"
																onclick={() => {
																	const newText = prompt('Edit option:', option.option);
																	if (newText?.trim() && newText !== option.option) {
																		updateMcOption(option.id, { option: newText.trim() });
																	}
																}}
															>
																{option.option}
															</button>
														{:else}
															<span class={option.is_correct ? 'font-medium' : ''}>{option.option}</span>
														{/if}
														{#if canEdit}
															<Button
																variant="ghost"
																size="sm"
																onclick={() => deleteMcOption(option.id)}
																disabled={operationInProgress}
																class="invisible h-6 w-6 p-0 text-destructive group-hover:visible"
															>
																<X class="h-3 w-3" />
															</Button>
														{/if}
													</div>
												{/each}
												{#if canEdit}
													<Button
														variant="ghost"
														size="sm"
														onclick={() => addMcOption(question.id)}
														disabled={operationInProgress}
														class="mt-1 h-7 gap-1 text-xs"
													>
														<Plus class="h-3 w-3" />
														Add option
													</Button>
												{/if}
											</div>
										</div>
									</div>
								</div>
							{/each}
							{#each topLevelFTQuestions as question, idx (question.id ?? `ft-${idx}`)}
								<div class="rounded-lg border p-4 {canEdit ? 'hover:border-primary/50' : ''}">
									<div class="flex items-start gap-3">
										<div class="flex-1">
											<div class="mb-2 flex items-center justify-between">
												<div class="flex items-center gap-2">
													<span class="rounded bg-purple-100 px-2 py-1 text-xs font-medium text-purple-700">
														{m['questionnaireEditPage.questions.freeTextLabel']()}
													</span>
													{#if question.is_mandatory}
														<span class="text-xs text-destructive">{m['questionnaireEditPage.questions.requiredLabel']()}</span>
													{/if}
												</div>
												{#if canEdit}
													<div class="flex gap-1">
														<Button
															variant="ghost"
															size="sm"
															onclick={() => deleteFtQuestion(question.id)}
															disabled={operationInProgress}
															class="h-8 w-8 p-0 text-destructive hover:text-destructive"
														>
															<Trash2 class="h-4 w-4" />
														</Button>
													</div>
												{/if}
											</div>
											{#if canEdit}
												<button
													type="button"
													class="cursor-pointer text-left font-medium hover:text-primary hover:underline"
													onclick={() => {
														const newText = prompt('Edit question:', question.question);
														if (newText?.trim() && newText !== question.question) {
															updateFtQuestion(question.id, { question: newText.trim() });
														}
													}}
												>
													{question.question}
												</button>
											{:else}
												<p class="font-medium">{question.question}</p>
											{/if}
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}

					<!-- Sectioned questions -->
					{#each sections as section, sIdx (section.id ?? `section-${sIdx}`)}
						<div class="space-y-3 rounded-lg border-2 border-dashed border-muted p-4">
							<div class="flex items-center justify-between border-b pb-2">
								<div class="flex items-center gap-2">
									{#if canEdit}
										<button
											type="button"
											class="cursor-pointer font-semibold hover:text-primary hover:underline"
											onclick={() => {
												const newName = prompt('Edit section name:', section.name);
												if (newName?.trim() && newName !== section.name && section.id) {
													updateSection(section.id, { name: newName.trim() });
												}
											}}
										>
											{section.name}
										</button>
									{:else}
										<h3 class="font-semibold">{section.name}</h3>
									{/if}
									<span class="text-sm text-muted-foreground">
										({(section.multiplechoicequestion_questions?.length || 0) +
											(section.freetextquestion_questions?.length || 0)} questions)
									</span>
								</div>
								{#if canEdit}
									<div class="flex gap-1">
										<Button
											variant="ghost"
											size="sm"
											onclick={() => addMcQuestion(section.id ?? null)}
											disabled={operationInProgress}
											class="h-8 gap-1 text-xs"
										>
											<Plus class="h-3 w-3" />
											MC
										</Button>
										<Button
											variant="ghost"
											size="sm"
											onclick={() => addFtQuestion(section.id ?? null)}
											disabled={operationInProgress}
											class="h-8 gap-1 text-xs"
										>
											<Plus class="h-3 w-3" />
											Text
										</Button>
										<Button
											variant="ghost"
											size="sm"
											onclick={() => deleteSection(section.id ?? '')}
											disabled={operationInProgress}
											class="h-8 w-8 p-0 text-destructive hover:text-destructive"
										>
											<Trash2 class="h-4 w-4" />
										</Button>
									</div>
								{/if}
							</div>
							{#if section.description}
								<p class="text-sm text-muted-foreground">{section.description}</p>
							{/if}
							{#each section.multiplechoicequestion_questions || [] as question, qIdx (question.id ?? `smc-${qIdx}`)}
								<div class="rounded-lg border bg-background p-4 {canEdit ? 'hover:border-primary/50' : ''}">
									<div class="flex items-start gap-3">
										<div class="flex-1">
											<div class="mb-2 flex items-center justify-between">
												<div class="flex items-center gap-2">
													<span class="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
														{m['questionnaireEditPage.questions.multipleChoiceLabel']()}
													</span>
													{#if question.is_mandatory}
														<span class="text-xs text-destructive">{m['questionnaireEditPage.questions.requiredLabel']()}</span>
													{/if}
												</div>
												{#if canEdit}
													<div class="flex gap-1">
														<Button
															variant="ghost"
															size="sm"
															onclick={() => deleteMcQuestion(question.id)}
															disabled={operationInProgress}
															class="h-8 w-8 p-0 text-destructive hover:text-destructive"
														>
															<Trash2 class="h-4 w-4" />
														</Button>
													</div>
												{/if}
											</div>
											{#if canEdit}
												<button
													type="button"
													class="cursor-pointer text-left font-medium hover:text-primary hover:underline"
													onclick={() => {
														const newText = prompt('Edit question:', question.question);
														if (newText?.trim() && newText !== question.question) {
															updateMcQuestion(question.id, { question: newText.trim() });
														}
													}}
												>
													{question.question}
												</button>
											{:else}
												<p class="font-medium">{question.question}</p>
											{/if}
											<div class="mt-2 space-y-1">
												{#each question.options as option, oIdx (option.id ?? `opt-${oIdx}`)}
													<div class="group flex items-center gap-2 text-sm">
														<button
															type="button"
															class="flex items-center gap-1 {canEdit ? 'cursor-pointer hover:text-primary' : ''}"
															onclick={() => canEdit && updateMcOption(option.id, { is_correct: !option.is_correct })}
															disabled={!canEdit || operationInProgress}
															title="Click to toggle correct/incorrect"
														>
															<span class={option.is_correct ? 'font-medium text-green-600' : 'text-muted-foreground'}>
																{option.is_correct ? '✓' : '○'}
															</span>
														</button>
														{#if canEdit}
															<button
																type="button"
																class="cursor-pointer hover:text-primary hover:underline {option.is_correct ? 'font-medium' : ''}"
																onclick={() => {
																	const newText = prompt('Edit option:', option.option);
																	if (newText?.trim() && newText !== option.option) {
																		updateMcOption(option.id, { option: newText.trim() });
																	}
																}}
															>
																{option.option}
															</button>
														{:else}
															<span class={option.is_correct ? 'font-medium' : ''}>{option.option}</span>
														{/if}
														{#if canEdit}
															<Button
																variant="ghost"
																size="sm"
																onclick={() => deleteMcOption(option.id)}
																disabled={operationInProgress}
																class="invisible h-6 w-6 p-0 text-destructive group-hover:visible"
															>
																<X class="h-3 w-3" />
															</Button>
														{/if}
													</div>
												{/each}
												{#if canEdit}
													<Button
														variant="ghost"
														size="sm"
														onclick={() => addMcOption(question.id)}
														disabled={operationInProgress}
														class="mt-1 h-7 gap-1 text-xs"
													>
														<Plus class="h-3 w-3" />
														Add option
													</Button>
												{/if}
											</div>
										</div>
									</div>
								</div>
							{/each}
							{#each section.freetextquestion_questions || [] as question, qIdx (question.id ?? `sft-${qIdx}`)}
								<div class="rounded-lg border bg-background p-4 {canEdit ? 'hover:border-primary/50' : ''}">
									<div class="flex items-start gap-3">
										<div class="flex-1">
											<div class="mb-2 flex items-center justify-between">
												<div class="flex items-center gap-2">
													<span class="rounded bg-purple-100 px-2 py-1 text-xs font-medium text-purple-700">
														{m['questionnaireEditPage.questions.freeTextLabel']()}
													</span>
													{#if question.is_mandatory}
														<span class="text-xs text-destructive">{m['questionnaireEditPage.questions.requiredLabel']()}</span>
													{/if}
												</div>
												{#if canEdit}
													<div class="flex gap-1">
														<Button
															variant="ghost"
															size="sm"
															onclick={() => deleteFtQuestion(question.id)}
															disabled={operationInProgress}
															class="h-8 w-8 p-0 text-destructive hover:text-destructive"
														>
															<Trash2 class="h-4 w-4" />
														</Button>
													</div>
												{/if}
											</div>
											{#if canEdit}
												<button
													type="button"
													class="cursor-pointer text-left font-medium hover:text-primary hover:underline"
													onclick={() => {
														const newText = prompt('Edit question:', question.question);
														if (newText?.trim() && newText !== question.question) {
															updateFtQuestion(question.id, { question: newText.trim() });
														}
													}}
												>
													{question.question}
												</button>
											{:else}
												<p class="font-medium">{question.question}</p>
											{/if}
										</div>
									</div>
								</div>
							{/each}
							{#if (section.multiplechoicequestion_questions?.length || 0) === 0 && (section.freetextquestion_questions?.length || 0) === 0}
								<div class="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
									No questions in this section yet.
									{#if canEdit}
										Use the buttons above to add questions.
									{/if}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</CardContent>
	</Card>

	<!-- Actions -->
	<div class="flex justify-end gap-3">
		<Button href="/org/{data.organizationSlug}/admin/questionnaires" variant="outline">
			{m['questionnaireEditPage.cancelButton']()}
		</Button>
		<Button onclick={saveQuestionnaire} disabled={isSaving}>
			{isSaving
				? m['questionnaireEditPage.savingButton']()
				: m['questionnaireEditPage.saveButton']()}
		</Button>
	</div>
</div>

<!-- Assignment Modal -->
{#if isAssignmentModalOpen && questionnaire}
	<QuestionnaireAssignmentModal
		bind:open={isAssignmentModalOpen}
		{questionnaire}
		organizationId={data.organization.id}
		accessToken={data.auth.accessToken || ''}
		onClose={() => (isAssignmentModalOpen = false)}
	/>
{/if}
{/if}
