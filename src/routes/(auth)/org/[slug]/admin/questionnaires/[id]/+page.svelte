<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import * as m from '$lib/paraglide/messages.js';
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
	import {
		ArrowLeft,
		AlertTriangle,
		FileCheck,
		FileEdit,
		Send,
		CalendarCheck,
		Calendar,
		Plus,
		FolderPlus,
		Pencil
	} from 'lucide-svelte';
	import QuestionnaireAssignmentModal from '$lib/components/questionnaires/QuestionnaireAssignmentModal.svelte';
	import QuestionEditor from '$lib/components/questionnaires/QuestionEditor.svelte';
	import SectionEditor from '$lib/components/questionnaires/SectionEditor.svelte';
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

	// ===== Type Definitions (same as create page) =====

	interface Option {
		text: string;
		isCorrect: boolean;
		conditionalQuestions?: Question[];
		conditionalSections?: ConditionalSection[];
		// For tracking existing options from API
		_apiId?: string;
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
		// For tracking existing questions from API
		_apiId?: string;
	}

	interface ConditionalSection {
		id: string;
		name: string;
		description?: string;
		order: number;
		questions: Question[];
	}

	interface Section {
		id: string;
		name: string;
		description?: string;
		order: number;
		questions: Question[];
		// For tracking existing sections from API
		_apiId?: string;
	}

	// ===== Load and Convert Data =====

	const questionnaire = $derived(data.questionnaire);
	const isLoaded = $derived(!!questionnaire?.questionnaire);
	const q = $derived(questionnaire?.questionnaire);

	// Convert API option to local format
	function convertApiOption(apiOption: any): Option {
		return {
			text: apiOption.option || '',
			isCorrect: apiOption.is_correct || false,
			_apiId: apiOption.id
			// TODO: Handle conditional questions/sections if needed
		};
	}

	// Convert API MC question to local format
	function convertApiMcQuestion(apiQuestion: any, fallbackOrder: number): Question {
		return {
			id: crypto.randomUUID(),
			type: 'multiple_choice',
			text: apiQuestion.question || '',
			hint: apiQuestion.hint || undefined,
			reviewerNotes: apiQuestion.reviewer_notes || undefined,
			required: apiQuestion.is_mandatory ?? true,
			order: apiQuestion.order ?? fallbackOrder,
			positiveWeight: apiQuestion.positive_weight ?? 1.0,
			negativeWeight: apiQuestion.negative_weight ?? 0.0,
			isFatal: apiQuestion.is_fatal ?? false,
			allowMultipleAnswers: apiQuestion.allow_multiple_answers ?? false,
			shuffleOptions: apiQuestion.shuffle_options ?? true,
			options: (apiQuestion.options || []).map(convertApiOption),
			_apiId: apiQuestion.id
		};
	}

	// Convert API FT question to local format
	function convertApiFtQuestion(apiQuestion: any, fallbackOrder: number): Question {
		return {
			id: crypto.randomUUID(),
			type: 'free_text',
			text: apiQuestion.question || '',
			hint: apiQuestion.hint || undefined,
			reviewerNotes: apiQuestion.reviewer_notes || undefined,
			required: apiQuestion.is_mandatory ?? true,
			order: apiQuestion.order ?? fallbackOrder,
			positiveWeight: apiQuestion.positive_weight ?? 1.0,
			negativeWeight: apiQuestion.negative_weight ?? 0.0,
			isFatal: apiQuestion.is_fatal ?? false,
			llmGuidelines: apiQuestion.llm_guidelines || undefined,
			_apiId: apiQuestion.id
		};
	}

	// Convert API section to local format
	function convertApiSection(apiSection: any): Section {
		const mcQuestions = (apiSection.multiplechoicequestion_questions || []).map(
			(apiQ: any, i: number) => convertApiMcQuestion(apiQ, apiQ.order ?? i)
		);
		const ftQuestions = (apiSection.freetextquestion_questions || []).map((apiQ: any, i: number) =>
			convertApiFtQuestion(apiQ, apiQ.order ?? mcQuestions.length + i)
		);

		return {
			id: crypto.randomUUID(),
			name: apiSection.name || '',
			description: apiSection.description || undefined,
			order: apiSection.order ?? 0,
			questions: [...mcQuestions, ...ftQuestions].sort((a, b) => a.order - b.order),
			_apiId: apiSection.id
		};
	}

	// Initialize local state from API data
	function initializeFromApi() {
		if (!q) return;

		// Basic info
		name = q.name || '';
		minScore = Number(q.min_score ?? 0);
		evaluationMode = (q.evaluation_mode as QuestionnaireEvaluationMode) || 'automatic';
		shuffleQuestions = q.shuffle_questions ?? false;
		shuffleSections = q.shuffle_sections ?? false;
		llmGuidelines = q.llm_guidelines || '';
		canRetakeAfter =
			q.can_retake_after && typeof q.can_retake_after === 'number'
				? Math.round(q.can_retake_after / 3600)
				: null;
		maxAttempts = 0;

		// From org questionnaire
		if (questionnaire) {
			questionnaireType = questionnaire.questionnaire_type || 'admission';
			membersExempt = questionnaire.members_exempt ?? false;
			maxSubmissionAge =
				questionnaire.max_submission_age && typeof questionnaire.max_submission_age === 'number'
					? Math.round(questionnaire.max_submission_age / 86400)
					: null;
		}

		// First, collect all question IDs that belong to sections
		// This prevents duplicates if API returns questions at multiple levels
		const sectionQuestionIds = new Set<string>();
		for (const apiSection of q.sections || []) {
			for (const mcq of apiSection.multiplechoicequestion_questions || []) {
				if (mcq.id) sectionQuestionIds.add(mcq.id);
			}
			for (const ftq of apiSection.freetextquestion_questions || []) {
				if (ftq.id) sectionQuestionIds.add(ftq.id);
			}
		}

		// Convert top-level questions, excluding any that belong to sections
		const topMc = (q.multiplechoicequestion_questions || [])
			.filter((apiQ: any) => !sectionQuestionIds.has(apiQ.id))
			.map((apiQ: any) => convertApiMcQuestion(apiQ, apiQ.order ?? 0));
		const topFt = (q.freetextquestion_questions || [])
			.filter((apiQ: any) => !sectionQuestionIds.has(apiQ.id))
			.map((apiQ: any) => convertApiFtQuestion(apiQ, apiQ.order ?? 0));
		topLevelQuestions = [...topMc, ...topFt].sort((a, b) => a.order - b.order);

		// Convert sections
		sections = (q.sections || [])
			.map(convertApiSection)
			.sort((a: Section, b: Section) => a.order - b.order);

		// Mark as initialized
		isInitialized = true;
	}

	// ===== Form State (local editing) =====

	let isInitialized = $state(false);
	let name = $state('');
	let questionnaireType = $state<'admission' | 'membership' | 'feedback' | 'generic'>('admission');
	let minScore = $state(0);
	let evaluationMode = $state<QuestionnaireEvaluationMode>('automatic');
	let shuffleQuestions = $state(false);
	let shuffleSections = $state(false);
	let llmGuidelines = $state('');
	let maxSubmissionAge = $state<number | null>(null);
	let canRetakeAfter = $state<number | null>(null);
	let maxAttempts = $state(0);
	let membersExempt = $state(false);

	// Local state for questions/sections (same as create page)
	let topLevelQuestions = $state<Question[]>([]);
	let sections = $state<Section[]>([]);

	// Initialize when data loads
	$effect(() => {
		if (isLoaded && !isInitialized) {
			initializeFromApi();
		}
	});

	// Total question count
	const totalQuestionCount = $derived(
		topLevelQuestions.length + sections.reduce((sum, s) => sum + s.questions.length, 0)
	);

	// All questions for validation
	const allQuestions = $derived([...topLevelQuestions, ...sections.flatMap((s) => s.questions)]);

	// Form validation
	let errors = $state<{ name?: string; questions?: string }>({});

	// Saving state
	let isSaving = $state(false);
	let saveError = $state<string | null>(null);

	// Status change state
	let isChangingStatus = $state(false);

	// Assignment modal state
	let isAssignmentModalOpen = $state(false);

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

	// Questionnaire type labels
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

	const selectedTypeLabel = $derived(questionnaireTypes[questionnaireType]?.label ?? 'Generic');
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

	// ===== Question/Section Management Functions (same as create page) =====

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

	// Add a new top-level question
	function addTopLevelQuestion(type: 'multiple_choice' | 'free_text') {
		const newQuestion = createQuestion(type, topLevelQuestions.length);
		topLevelQuestions = [...topLevelQuestions, newQuestion];
	}

	// Remove a top-level question
	function removeTopLevelQuestion(id: string) {
		topLevelQuestions = topLevelQuestions.filter((q) => q.id !== id);
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

	// Reorder questions in a section
	function reorderQuestionsInSection(sectionId: string, newQuestions: Question[]) {
		sections = sections.map((s) => {
			if (s.id === sectionId) {
				return { ...s, questions: newQuestions };
			}
			return s;
		});
	}

	// DnD settings
	const flipDurationMs = 200;
	const dropTargetStyle = {
		outline: '2px dashed hsl(var(--primary))',
		borderRadius: '8px'
	};

	// Handle DnD for top-level questions
	function handleTopLevelQuestionsDndConsider(e: CustomEvent<{ items: Question[] }>) {
		topLevelQuestions = e.detail.items;
	}

	function handleTopLevelQuestionsDndFinalize(e: CustomEvent<{ items: Question[] }>) {
		topLevelQuestions = e.detail.items
			.filter((q) => q.id !== SHADOW_PLACEHOLDER_ITEM_ID)
			.map((q, index) => ({ ...q, order: index }));
	}

	// Handle DnD for sections
	function handleSectionsDndConsider(e: CustomEvent<{ items: Section[] }>) {
		sections = e.detail.items;
	}

	function handleSectionsDndFinalize(e: CustomEvent<{ items: Section[] }>) {
		sections = e.detail.items
			.filter((s) => s.id !== SHADOW_PLACEHOLDER_ITEM_ID)
			.map((s, index) => ({ ...s, order: index }));
	}

	// ===== Validation =====

	function validate(): boolean {
		errors = {};

		if (!name.trim()) {
			errors.name = m['questionnaireEditPage.basicInfo.nameRequired']();
		}

		if (totalQuestionCount === 0) {
			errors.questions = 'At least one question is required';
		}

		const invalidQuestions = allQuestions.filter((q) => !q.text.trim());
		if (invalidQuestions.length > 0) {
			errors.questions = 'All questions must have text';
		}

		return Object.keys(errors).length === 0;
	}

	// ===== Status Management =====

	function getOrgQuestionnaireId(): string {
		if (!questionnaire?.id) throw new Error('Questionnaire not loaded');
		return questionnaire.id;
	}

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

			await invalidateAll();
		} catch (err) {
			console.error('Failed to change status:', err);
			alert(m['questionnaireEditPage.error_statusChangeFailedMessage']());
		} finally {
			isChangingStatus = false;
		}
	}

	// ===== Save Logic =====

	// Helper to convert local MC question to API format
	function mcQuestionToApiFormat(q: Question) {
		return {
			question: q.text,
			hint: q.hint || null,
			reviewer_notes: q.reviewerNotes || null,
			is_mandatory: q.required,
			order: q.order,
			positive_weight: String(q.positiveWeight),
			negative_weight: String(q.negativeWeight),
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

	// Helper to convert local FT question to API format
	function ftQuestionToApiFormat(q: Question) {
		return {
			question: q.text,
			hint: q.hint || null,
			reviewer_notes: q.reviewerNotes || null,
			is_mandatory: q.required,
			order: q.order,
			positive_weight: String(q.positiveWeight),
			negative_weight: String(q.negativeWeight),
			is_fatal: q.isFatal,
			llm_guidelines: q.llmGuidelines || null
		};
	}

	async function saveQuestionnaire() {
		saveError = null;

		if (!validate()) {
			return;
		}

		isSaving = true;

		try {
			const user = data.auth;
			if (!user.accessToken) {
				throw new Error(m['questionnaireEditPage.error_notAuthenticated']());
			}

			const orgQuestionnaireId = getOrgQuestionnaireId();
			const authHeader = { Authorization: `Bearer ${user.accessToken}` };

			// Track what exists in API vs what we have locally
			const existingSectionIds = new Set((q?.sections || []).map((s: any) => s.id).filter(Boolean));
			const existingTopMcIds = new Set(
				(q?.multiplechoicequestion_questions || []).map((q: any) => q.id).filter(Boolean)
			);
			const existingTopFtIds = new Set(
				(q?.freetextquestion_questions || []).map((q: any) => q.id).filter(Boolean)
			);

			// 1. Update metadata
			const metadataResponse = await questionnaireUpdateOrgQuestionnaire({
				path: { org_questionnaire_id: orgQuestionnaireId },
				body: {
					name,
					min_score: minScore,
					evaluation_mode: evaluationMode,
					questionnaire_type: questionnaireType,
					max_submission_age: maxSubmissionAge ? (maxSubmissionAge * 86400).toString() : null,
					shuffle_questions: shuffleQuestions,
					shuffle_sections: shuffleSections,
					llm_guidelines: llmGuidelines || null,
					can_retake_after: canRetakeAfter ? (canRetakeAfter * 3600).toString() : null,
					max_attempts: maxAttempts,
					members_exempt: membersExempt
				},
				headers: authHeader
			});

			if (metadataResponse.error) {
				throw new Error(m['questionnaireEditPage.error_updateFailed']());
			}

			// 2. Sync sections
			const localSectionApiIds = new Set<string>();
			for (const section of sections) {
				if (section._apiId) {
					localSectionApiIds.add(section._apiId);
					// Update existing section
					await questionnaireUpdateSection({
						path: { org_questionnaire_id: orgQuestionnaireId, section_id: section._apiId },
						body: {
							name: section.name,
							description: section.description || null,
							order: section.order
						},
						headers: authHeader
					});

					// Sync questions in this section
					await syncSectionQuestions(section, section._apiId, authHeader, orgQuestionnaireId);
				} else {
					// Create new section
					const sectionResponse = await questionnaireCreateSection({
						path: { org_questionnaire_id: orgQuestionnaireId },
						body: {
							name: section.name,
							description: section.description || null,
							order: section.order
						},
						headers: authHeader
					});

					const sectionData = sectionResponse.data as { id?: string } | undefined;
					if (sectionData?.id) {
						// Create questions in new section
						await createSectionQuestions(section, sectionData.id, authHeader, orgQuestionnaireId);
					}
				}
			}

			// Delete removed sections
			for (const existingId of existingSectionIds) {
				if (!localSectionApiIds.has(existingId)) {
					await questionnaireDeleteSection({
						path: { org_questionnaire_id: orgQuestionnaireId, section_id: existingId },
						headers: authHeader
					});
				}
			}

			// 3. Sync top-level questions
			const localTopMcApiIds = new Set<string>();
			const localTopFtApiIds = new Set<string>();

			for (const question of topLevelQuestions) {
				if (question.type === 'multiple_choice') {
					if (question._apiId) {
						localTopMcApiIds.add(question._apiId);
						await syncMcQuestion(question, authHeader, orgQuestionnaireId);
					} else {
						await createMcQuestion(question, null, authHeader, orgQuestionnaireId);
					}
				} else {
					if (question._apiId) {
						localTopFtApiIds.add(question._apiId);
						await syncFtQuestion(question, authHeader, orgQuestionnaireId);
					} else {
						await createFtQuestion(question, null, authHeader, orgQuestionnaireId);
					}
				}
			}

			// Delete removed top-level questions
			for (const existingId of existingTopMcIds) {
				if (!localTopMcApiIds.has(existingId)) {
					await questionnaireDeleteMcQuestion({
						path: { org_questionnaire_id: orgQuestionnaireId, question_id: existingId },
						headers: authHeader
					});
				}
			}
			for (const existingId of existingTopFtIds) {
				if (!localTopFtApiIds.has(existingId)) {
					await questionnaireDeleteFtQuestion({
						path: { org_questionnaire_id: orgQuestionnaireId, question_id: existingId },
						headers: authHeader
					});
				}
			}

			// Refresh and redirect
			await invalidateAll();
			await goto(`/org/${data.organizationSlug}/admin/questionnaires`);
		} catch (err) {
			console.error('Failed to save questionnaire:', err);
			saveError = 'Failed to save questionnaire. Please try again.';
		} finally {
			isSaving = false;
		}
	}

	// Helper functions for syncing
	async function syncSectionQuestions(
		section: Section,
		sectionApiId: string,
		authHeader: { Authorization: string },
		orgQuestionnaireId: string
	) {
		// Get existing questions in this section from API
		const apiSection = (q?.sections || []).find((s: any) => s.id === sectionApiId);
		const existingMcIds = new Set(
			(apiSection?.multiplechoicequestion_questions || []).map((q: any) => q.id).filter(Boolean)
		);
		const existingFtIds = new Set(
			(apiSection?.freetextquestion_questions || []).map((q: any) => q.id).filter(Boolean)
		);

		const localMcApiIds = new Set<string>();
		const localFtApiIds = new Set<string>();

		for (const question of section.questions) {
			if (question.type === 'multiple_choice') {
				if (question._apiId) {
					localMcApiIds.add(question._apiId);
					await syncMcQuestion(question, authHeader, orgQuestionnaireId);
				} else {
					await createMcQuestion(question, sectionApiId, authHeader, orgQuestionnaireId);
				}
			} else {
				if (question._apiId) {
					localFtApiIds.add(question._apiId);
					await syncFtQuestion(question, authHeader, orgQuestionnaireId);
				} else {
					await createFtQuestion(question, sectionApiId, authHeader, orgQuestionnaireId);
				}
			}
		}

		// Delete removed questions
		for (const existingId of existingMcIds) {
			if (!localMcApiIds.has(existingId)) {
				await questionnaireDeleteMcQuestion({
					path: { org_questionnaire_id: orgQuestionnaireId, question_id: existingId },
					headers: authHeader
				});
			}
		}
		for (const existingId of existingFtIds) {
			if (!localFtApiIds.has(existingId)) {
				await questionnaireDeleteFtQuestion({
					path: { org_questionnaire_id: orgQuestionnaireId, question_id: existingId },
					headers: authHeader
				});
			}
		}
	}

	async function createSectionQuestions(
		section: Section,
		sectionApiId: string,
		authHeader: { Authorization: string },
		orgQuestionnaireId: string
	) {
		for (const question of section.questions) {
			if (question.type === 'multiple_choice') {
				await createMcQuestion(question, sectionApiId, authHeader, orgQuestionnaireId);
			} else {
				await createFtQuestion(question, sectionApiId, authHeader, orgQuestionnaireId);
			}
		}
	}

	async function syncMcQuestion(
		question: Question,
		authHeader: { Authorization: string },
		orgQuestionnaireId: string
	) {
		if (!question._apiId) return;

		// Update the question
		await questionnaireUpdateMcQuestion({
			path: { org_questionnaire_id: orgQuestionnaireId, question_id: question._apiId },
			body: {
				question: question.text,
				hint: question.hint || null,
				is_mandatory: question.required,
				positive_weight: String(question.positiveWeight),
				negative_weight: String(question.negativeWeight),
				is_fatal: question.isFatal,
				allow_multiple_answers: question.allowMultipleAnswers || false,
				shuffle_options: question.shuffleOptions ?? true
			},
			headers: authHeader
		});

		// Sync options
		await syncMcOptions(question, authHeader, orgQuestionnaireId);
	}

	async function syncMcOptions(
		question: Question,
		authHeader: { Authorization: string },
		orgQuestionnaireId: string
	) {
		if (!question._apiId) return;

		// Find existing options from API
		let existingOptions: any[] = [];
		const topQuestion = (q?.multiplechoicequestion_questions || []).find(
			(q: any) => q.id === question._apiId
		);
		if (topQuestion) {
			existingOptions = topQuestion.options || [];
		} else {
			for (const section of q?.sections || []) {
				const sectionQuestion = (section.multiplechoicequestion_questions || []).find(
					(q: any) => q.id === question._apiId
				);
				if (sectionQuestion) {
					existingOptions = sectionQuestion.options || [];
					break;
				}
			}
		}

		const existingOptionIds = new Set(existingOptions.map((o: any) => o.id).filter(Boolean));
		const localOptionApiIds = new Set<string>();

		for (let i = 0; i < (question.options || []).length; i++) {
			const option = question.options![i];
			if (option._apiId) {
				localOptionApiIds.add(option._apiId);
				// Update existing option
				await questionnaireUpdateMcOption({
					path: { org_questionnaire_id: orgQuestionnaireId, option_id: option._apiId },
					body: {
						option: option.text,
						is_correct: option.isCorrect,
						order: i
					},
					headers: authHeader
				});
			} else if (option.text.trim()) {
				// Create new option
				await questionnaireCreateMcOption({
					path: { org_questionnaire_id: orgQuestionnaireId, question_id: question._apiId },
					body: {
						option: option.text,
						is_correct: option.isCorrect,
						order: i
					},
					headers: authHeader
				});
			}
		}

		// Delete removed options
		for (const existingId of existingOptionIds) {
			if (!localOptionApiIds.has(existingId)) {
				await questionnaireDeleteMcOption({
					path: { org_questionnaire_id: orgQuestionnaireId, option_id: existingId },
					headers: authHeader
				});
			}
		}
	}

	async function syncFtQuestion(
		question: Question,
		authHeader: { Authorization: string },
		orgQuestionnaireId: string
	) {
		if (!question._apiId) return;

		await questionnaireUpdateFtQuestion({
			path: { org_questionnaire_id: orgQuestionnaireId, question_id: question._apiId },
			body: {
				question: question.text,
				hint: question.hint || null,
				is_mandatory: question.required,
				positive_weight: String(question.positiveWeight),
				negative_weight: String(question.negativeWeight),
				is_fatal: question.isFatal,
				llm_guidelines: question.llmGuidelines || null
			},
			headers: authHeader
		});
	}

	async function createMcQuestion(
		question: Question,
		sectionId: string | null,
		authHeader: { Authorization: string },
		orgQuestionnaireId: string
	) {
		const apiFormat = mcQuestionToApiFormat(question);
		await questionnaireCreateMcQuestion({
			path: { org_questionnaire_id: orgQuestionnaireId },
			body: {
				section_id: sectionId,
				...apiFormat
			},
			headers: authHeader
		});
	}

	async function createFtQuestion(
		question: Question,
		sectionId: string | null,
		authHeader: { Authorization: string },
		orgQuestionnaireId: string
	) {
		const apiFormat = ftQuestionToApiFormat(question);
		await questionnaireCreateFtQuestion({
			path: { org_questionnaire_id: orgQuestionnaireId },
			body: {
				section_id: sectionId,
				...apiFormat
			},
			headers: authHeader
		});
	}
</script>

<svelte:head>
	<title>{m['questionnaireEditPage.pageTitle']()} - {q?.name ?? ''}</title>
</svelte:head>

{#if !isLoaded}
	<div class="flex min-h-[50vh] items-center justify-center">
		<div class="text-center">
			<div
				class="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
			></div>
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
					<p class="font-medium text-green-800 dark:text-green-200">Editing enabled</p>
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
					<p class="font-medium text-yellow-800 dark:text-yellow-200">Questions cannot be edited</p>
					<p class="mt-1 text-yellow-700 dark:text-yellow-300">
						This questionnaire is {currentStatus}. To edit questions, change the status back to
						draft. Note: this may affect existing submissions.
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
						disabled={!canEdit}
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
							if (v === 'admission' && canEdit) {
								questionnaireType = v;
							}
						}}
						disabled={!canEdit}
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
						disabled={!canEdit}
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
							if (v && canEdit) {
								evaluationMode = v as typeof evaluationMode;
							}
						}}
						disabled={!canEdit}
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
							disabled={!canEdit}
						/>
						<Label for="shuffle-questions" class="font-normal"
							>Shuffle questions for each user</Label
						>
					</div>
					<div class="flex items-center space-x-2">
						<input
							id="shuffle-sections"
							type="checkbox"
							bind:checked={shuffleSections}
							class="h-4 w-4 rounded border-gray-300"
							disabled={!canEdit}
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
							disabled={!canEdit}
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
						disabled={!canEdit}
					/>
					<p class="text-xs text-muted-foreground">
						{m['questionnaireEditPage.advanced.llmGuidelinesDescription']()}
					</p>
				</div>

				<!-- Duration Settings -->
				<div class="grid gap-4 sm:grid-cols-2">
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
							disabled={!canEdit}
						/>
						<p class="text-xs text-muted-foreground">
							{m['questionnaireEditPage.advanced.submissionValidityDescription']()}
						</p>
					</div>

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
							disabled={!canEdit}
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
					<Input
						id="max-attempts"
						type="number"
						bind:value={maxAttempts}
						min="0"
						step="1"
						required
						disabled={!canEdit}
					/>
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
						<CardDescription>{m['questionnaireEditPage.assignments.description']()}</CardDescription
						>
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
				{#if (questionnaire?.events?.length || 0) === 0 && (questionnaire?.event_series?.length || 0) === 0}
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
						{#if questionnaire?.events && questionnaire.events.length > 0}
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

						{#if questionnaire?.event_series && questionnaire.event_series.length > 0}
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

		<!-- Questions & Sections (same as create page) -->
		<Card>
			<CardHeader>
				<div class="flex items-center justify-between">
					<div>
						<CardTitle
							>{m['questionnaireEditPage.questions.title']()} ({totalQuestionCount})</CardTitle
						>
						<CardDescription>{m['questionnaireEditPage.questions.description']()}</CardDescription>
					</div>
					{#if canEdit}
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
					{/if}
				</div>
			</CardHeader>
			<CardContent class="space-y-6">
				{#if totalQuestionCount === 0 && sections.length === 0}
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
				{:else if canEdit}
					<!-- Editable mode - same as create page -->
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

					<!-- Sections -->
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
				{:else}
					<!-- Read-only mode - display questions nicely -->
					<div class="space-y-4">
						{#if topLevelQuestions.length > 0}
							<div class="space-y-3">
								<h3 class="text-sm font-medium text-muted-foreground">Top-level Questions</h3>
								{#each topLevelQuestions as question}
									<div class="rounded-lg border p-4">
										<div class="mb-2 flex items-center gap-2">
											<span
												class="rounded px-2 py-1 text-xs font-medium {question.type ===
												'multiple_choice'
													? 'bg-blue-100 text-blue-700'
													: 'bg-purple-100 text-purple-700'}"
											>
												{question.type === 'multiple_choice' ? 'Multiple Choice' : 'Free Text'}
											</span>
											{#if question.required}
												<span class="text-xs text-destructive">Required</span>
											{/if}
										</div>
										<p class="font-medium">{question.text}</p>
										{#if question.type === 'multiple_choice' && question.options}
											<div class="mt-2 space-y-1">
												{#each question.options as option}
													<div class="flex items-center gap-2 text-sm">
														<span
															class={option.isCorrect
																? 'font-medium text-green-600'
																: 'text-muted-foreground'}
														>
															{option.isCorrect ? '✓' : '○'}
														</span>
														<span class={option.isCorrect ? 'font-medium' : ''}>{option.text}</span>
													</div>
												{/each}
											</div>
										{/if}
									</div>
								{/each}
							</div>
						{/if}

						{#each sections as section}
							<div class="space-y-3 rounded-lg border-2 border-dashed border-muted p-4">
								<div class="flex items-center justify-between border-b pb-2">
									<h3 class="font-semibold">{section.name}</h3>
									<span class="text-sm text-muted-foreground">
										({section.questions.length} questions)
									</span>
								</div>
								{#if section.description}
									<p class="text-sm text-muted-foreground">{section.description}</p>
								{/if}
								{#each section.questions as question}
									<div class="rounded-lg border bg-background p-4">
										<div class="mb-2 flex items-center gap-2">
											<span
												class="rounded px-2 py-1 text-xs font-medium {question.type ===
												'multiple_choice'
													? 'bg-blue-100 text-blue-700'
													: 'bg-purple-100 text-purple-700'}"
											>
												{question.type === 'multiple_choice' ? 'Multiple Choice' : 'Free Text'}
											</span>
											{#if question.required}
												<span class="text-xs text-destructive">Required</span>
											{/if}
										</div>
										<p class="font-medium">{question.text}</p>
										{#if question.type === 'multiple_choice' && question.options}
											<div class="mt-2 space-y-1">
												{#each question.options as option}
													<div class="flex items-center gap-2 text-sm">
														<span
															class={option.isCorrect
																? 'font-medium text-green-600'
																: 'text-muted-foreground'}
														>
															{option.isCorrect ? '✓' : '○'}
														</span>
														<span class={option.isCorrect ? 'font-medium' : ''}>{option.text}</span>
													</div>
												{/each}
											</div>
										{/if}
									</div>
								{/each}
								{#if section.questions.length === 0}
									<div
										class="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground"
									>
										No questions in this section.
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}

				{#if errors.questions}
					<p class="mt-4 text-sm text-destructive">{errors.questions}</p>
				{/if}

				<!-- Bottom action bar (only in edit mode) -->
				{#if canEdit && (totalQuestionCount > 0 || sections.length > 0)}
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

		<!-- Error Display -->
		{#if saveError}
			<Card class="border-destructive bg-destructive/10">
				<CardContent class="py-4">
					<div class="flex items-start gap-3">
						<div class="flex-1">
							<p class="font-medium text-destructive">Save Error</p>
							<p class="mt-1 whitespace-pre-wrap text-sm text-destructive/90">{saveError}</p>
						</div>
						<Button
							variant="ghost"
							size="sm"
							onclick={() => (saveError = null)}
							class="text-destructive hover:text-destructive"
						>
							Dismiss
						</Button>
					</div>
				</CardContent>
			</Card>
		{/if}

		<!-- Actions -->
		<div class="flex justify-end gap-3">
			<Button href="/org/{data.organizationSlug}/admin/questionnaires" variant="outline">
				{m['questionnaireEditPage.cancelButton']()}
			</Button>
			<Button onclick={saveQuestionnaire} disabled={isSaving || !canEdit}>
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
