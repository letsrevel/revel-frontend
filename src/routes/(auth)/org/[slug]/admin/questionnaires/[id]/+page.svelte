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
		Pencil,
		Upload
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
		questionnaireDeleteFtQuestion,
		questionnaireCreateFuQuestion,
		questionnaireUpdateFuQuestion,
		questionnaireDeleteFuQuestion
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
		type: 'multiple_choice' | 'free_text' | 'file_upload';
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
		// For file upload
		allowedMimeTypes?: string[];
		maxFileSize?: number;
		maxFiles?: number;
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
			conditionalQuestions: [],
			conditionalSections: [],
			_apiId: apiOption.id
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

	// Convert API FU question to local format
	function convertApiFuQuestion(apiQuestion: any, fallbackOrder: number): Question {
		return {
			id: crypto.randomUUID(),
			type: 'file_upload',
			text: apiQuestion.question || '',
			hint: apiQuestion.hint || undefined,
			reviewerNotes: apiQuestion.reviewer_notes || undefined,
			required: apiQuestion.is_mandatory ?? true,
			order: apiQuestion.order ?? fallbackOrder,
			positiveWeight: parseFloat(apiQuestion.positive_weight) || 1.0,
			negativeWeight: parseFloat(apiQuestion.negative_weight) || 0.0,
			isFatal: apiQuestion.is_fatal ?? false,
			allowedMimeTypes: apiQuestion.allowed_mime_types || ['*/*'],
			maxFileSize: apiQuestion.max_file_size || 10 * 1024 * 1024,
			maxFiles: apiQuestion.max_files || 1,
			_apiId: apiQuestion.id
		};
	}

	// Convert API section to local format
	// conditionalQuestionIds is optional - if provided, those questions will be excluded
	function convertApiSection(apiSection: any, conditionalQuestionIds?: Set<string>): Section {
		const mcQuestions = (apiSection.multiplechoicequestion_questions || [])
			.filter((apiQ: any) => !conditionalQuestionIds?.has(apiQ.id))
			.map((apiQ: any, i: number) => convertApiMcQuestion(apiQ, apiQ.order ?? i));
		const ftQuestions = (apiSection.freetextquestion_questions || [])
			.filter((apiQ: any) => !conditionalQuestionIds?.has(apiQ.id))
			.map((apiQ: any, i: number) =>
				convertApiFtQuestion(apiQ, apiQ.order ?? mcQuestions.length + i)
			);
		const fuQuestions = (apiSection.fileuploadquestion_questions || [])
			.filter((apiQ: any) => !conditionalQuestionIds?.has(apiQ.id))
			.map((apiQ: any, i: number) =>
				convertApiFuQuestion(apiQ, apiQ.order ?? mcQuestions.length + ftQuestions.length + i)
			);

		return {
			id: crypto.randomUUID(),
			name: apiSection.name || '',
			description: apiSection.description || undefined,
			order: apiSection.order ?? 0,
			questions: [...mcQuestions, ...ftQuestions, ...fuQuestions].sort((a, b) => a.order - b.order),
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
			perEvent = questionnaire.per_event ?? false;
			maxSubmissionAge =
				questionnaire.max_submission_age && typeof questionnaire.max_submission_age === 'number'
					? Math.round(questionnaire.max_submission_age / 86400)
					: null;
		}

		// ===== Step 1: Collect IDs of questions that belong to sections =====
		const sectionQuestionIds = new Set<string>();
		for (const apiSection of q.sections || []) {
			for (const mcq of apiSection.multiplechoicequestion_questions || []) {
				if (mcq.id) sectionQuestionIds.add(mcq.id);
			}
			for (const ftq of apiSection.freetextquestion_questions || []) {
				if (ftq.id) sectionQuestionIds.add(ftq.id);
			}
			for (const fuq of apiSection.fileuploadquestion_questions || []) {
				if (fuq.id) sectionQuestionIds.add(fuq.id);
			}
		}

		// ===== Step 2: Collect IDs of questions/sections that are conditional (depend on an option) =====
		const conditionalQuestionIds = new Set<string>();
		const conditionalSectionIds = new Set<string>();

		// Collect all conditional questions (those with depends_on_option_id)
		for (const mcq of q.multiplechoicequestion_questions || []) {
			if (mcq.depends_on_option_id) {
				conditionalQuestionIds.add(mcq.id);
			}
		}
		for (const ftq of q.freetextquestion_questions || []) {
			if (ftq.depends_on_option_id) {
				conditionalQuestionIds.add(ftq.id);
			}
		}
		for (const fuq of q.fileuploadquestion_questions || []) {
			if (fuq.depends_on_option_id) {
				conditionalQuestionIds.add(fuq.id);
			}
		}
		// Also check sections within sections for conditional questions
		for (const apiSection of q.sections || []) {
			if (apiSection.depends_on_option_id) {
				conditionalSectionIds.add(apiSection.id);
			}
			for (const mcq of apiSection.multiplechoicequestion_questions || []) {
				if (mcq.depends_on_option_id) {
					conditionalQuestionIds.add(mcq.id);
				}
			}
			for (const ftq of apiSection.freetextquestion_questions || []) {
				if (ftq.depends_on_option_id) {
					conditionalQuestionIds.add(ftq.id);
				}
			}
			for (const fuq of apiSection.fileuploadquestion_questions || []) {
				if (fuq.depends_on_option_id) {
					conditionalQuestionIds.add(fuq.id);
				}
			}
		}

		// ===== Step 3: Convert questions, excluding section questions and conditional questions =====
		const topMc = (q.multiplechoicequestion_questions || [])
			.filter(
				(apiQ: any) => !sectionQuestionIds.has(apiQ.id) && !conditionalQuestionIds.has(apiQ.id)
			)
			.map((apiQ: any) => convertApiMcQuestion(apiQ, apiQ.order ?? 0));
		const topFt = (q.freetextquestion_questions || [])
			.filter(
				(apiQ: any) => !sectionQuestionIds.has(apiQ.id) && !conditionalQuestionIds.has(apiQ.id)
			)
			.map((apiQ: any) => convertApiFtQuestion(apiQ, apiQ.order ?? 0));
		const topFu = (q.fileuploadquestion_questions || [])
			.filter(
				(apiQ: any) => !sectionQuestionIds.has(apiQ.id) && !conditionalQuestionIds.has(apiQ.id)
			)
			.map((apiQ: any) => convertApiFuQuestion(apiQ, apiQ.order ?? 0));
		topLevelQuestions = [...topMc, ...topFt, ...topFu].sort((a, b) => a.order - b.order);

		// ===== Step 4: Convert sections, excluding conditional sections =====
		// Also pass conditionalQuestionIds so section questions that are conditional get filtered out
		sections = (q.sections || [])
			.filter((apiSection: any) => !conditionalSectionIds.has(apiSection.id))
			.map((apiSection: any) => convertApiSection(apiSection, conditionalQuestionIds))
			.sort((a: Section, b: Section) => a.order - b.order);

		// ===== Step 5: Build a map of option API IDs to option objects =====
		// This lets us attach conditional questions/sections to their parent options
		const optionMap = new Map<string, Option>();

		// Collect options from top-level questions
		for (const question of topLevelQuestions) {
			if (question.options) {
				for (const option of question.options) {
					if (option._apiId) {
						optionMap.set(option._apiId, option);
					}
				}
			}
		}

		// Collect options from section questions
		for (const section of sections) {
			for (const question of section.questions) {
				if (question.options) {
					for (const option of question.options) {
						if (option._apiId) {
							optionMap.set(option._apiId, option);
						}
					}
				}
			}
		}

		// ===== Step 6: Attach conditional questions to their parent options =====
		// Helper function to process conditional questions
		function attachConditionalQuestion(apiQ: any, type: 'mc' | 'ft') {
			if (!apiQ.depends_on_option_id || !conditionalQuestionIds.has(apiQ.id)) return;

			const parentOption = optionMap.get(apiQ.depends_on_option_id);
			if (parentOption) {
				// Check if already attached (to avoid duplicates)
				const existingIds = new Set(
					parentOption.conditionalQuestions?.map((q: Question) => q._apiId) || []
				);
				if (existingIds.has(apiQ.id)) return;

				const convertedQ =
					type === 'mc'
						? convertApiMcQuestion(apiQ, apiQ.order ?? 0)
						: convertApiFtQuestion(apiQ, apiQ.order ?? 0);
				parentOption.conditionalQuestions = parentOption.conditionalQuestions || [];
				parentOption.conditionalQuestions.push(convertedQ);

				// Also add nested options to the map (for MC questions)
				if (type === 'mc' && convertedQ.options) {
					for (const opt of convertedQ.options) {
						if (opt._apiId) optionMap.set(opt._apiId, opt);
					}
				}
			}
		}

		// Conditional MC questions - check both top-level and within sections
		for (const apiQ of q.multiplechoicequestion_questions || []) {
			attachConditionalQuestion(apiQ, 'mc');
		}
		for (const apiSection of q.sections || []) {
			for (const apiQ of apiSection.multiplechoicequestion_questions || []) {
				attachConditionalQuestion(apiQ, 'mc');
			}
		}

		// Conditional FT questions - check both top-level and within sections
		for (const apiQ of q.freetextquestion_questions || []) {
			attachConditionalQuestion(apiQ, 'ft');
		}
		for (const apiSection of q.sections || []) {
			for (const apiQ of apiSection.freetextquestion_questions || []) {
				attachConditionalQuestion(apiQ, 'ft');
			}
		}

		// Conditional sections
		for (const apiSection of q.sections || []) {
			if (apiSection.depends_on_option_id && conditionalSectionIds.has(apiSection.id)) {
				const parentOption = optionMap.get(apiSection.depends_on_option_id);
				if (parentOption) {
					const convertedSection: ConditionalSection = {
						id: crypto.randomUUID(),
						name: apiSection.name || '',
						description: apiSection.description || undefined,
						order: apiSection.order ?? 0,
						questions: []
					};
					// Convert section questions (excluding any nested conditionals)
					const sectionMc = (apiSection.multiplechoicequestion_questions || [])
						.filter((mcq: any) => !mcq.depends_on_option_id)
						.map((mcq: any) => convertApiMcQuestion(mcq, mcq.order ?? 0));
					const sectionFt = (apiSection.freetextquestion_questions || [])
						.filter((ftq: any) => !ftq.depends_on_option_id)
						.map((ftq: any) => convertApiFtQuestion(ftq, ftq.order ?? 0));
					convertedSection.questions = [...sectionMc, ...sectionFt].sort(
						(a, b) => a.order - b.order
					);
					parentOption.conditionalSections = parentOption.conditionalSections || [];
					parentOption.conditionalSections.push(convertedSection);
				}
			}
		}

		// Sort conditional questions within each option by order
		for (const option of optionMap.values()) {
			if (option.conditionalQuestions && option.conditionalQuestions.length > 1) {
				option.conditionalQuestions.sort((a, b) => a.order - b.order);
			}
			if (option.conditionalSections && option.conditionalSections.length > 1) {
				option.conditionalSections.sort((a, b) => a.order - b.order);
			}
		}

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
	let perEvent = $state(false);

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

	// Edit mode state - user must explicitly enable editing
	// This protects against accidental modifications while still allowing edits to any questionnaire
	let isEditMode = $state(false);

	// Derived helper for UI - combines edit mode with data availability
	const canEdit = $derived(isEditMode && isLoaded);

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
	function createQuestion(
		type: 'multiple_choice' | 'free_text' | 'file_upload',
		order: number
	): Question {
		const base = {
			id: crypto.randomUUID(),
			type,
			text: '',
			required: true,
			order,
			positiveWeight: 1.0,
			negativeWeight: 0.0,
			isFatal: false
		};

		if (type === 'multiple_choice') {
			return {
				...base,
				options: [
					{ text: '', isCorrect: false },
					{ text: '', isCorrect: false }
				],
				allowMultipleAnswers: false,
				shuffleOptions: true
			};
		} else if (type === 'free_text') {
			return { ...base, llmGuidelines: '' };
		} else {
			return {
				...base,
				allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'],
				maxFileSize: 10 * 1024 * 1024,
				maxFiles: 1
			};
		}
	}

	// Add a new top-level question
	function addTopLevelQuestion(type: 'multiple_choice' | 'free_text' | 'file_upload') {
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
	function addQuestionToSection(
		sectionId: string,
		type: 'multiple_choice' | 'free_text' | 'file_upload'
	) {
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

	// Helper to convert local FU question to API format
	function fuQuestionToApiFormat(q: Question) {
		return {
			question: q.text,
			hint: q.hint || null,
			reviewer_notes: q.reviewerNotes || null,
			is_mandatory: q.required,
			order: q.order,
			positive_weight: String(q.positiveWeight),
			negative_weight: String(q.negativeWeight),
			is_fatal: q.isFatal,
			allowed_mime_types: q.allowedMimeTypes || ['*/*'],
			max_file_size: q.maxFileSize || 10 * 1024 * 1024,
			max_files: q.maxFiles || 1
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
			// Only track NON-CONDITIONAL sections/questions for deletion
			// (conditional items have depends_on_option_id and are managed by the backend)
			const existingSectionIds = new Set(
				(q?.sections || [])
					.filter((s: any) => !s.depends_on_option_id)
					.map((s: any) => s.id)
					.filter(Boolean)
			);
			const existingTopMcIds = new Set(
				(q?.multiplechoicequestion_questions || [])
					.filter((q: any) => !q.depends_on_option_id)
					.map((q: any) => q.id)
					.filter(Boolean)
			);
			const existingTopFtIds = new Set(
				(q?.freetextquestion_questions || [])
					.filter((q: any) => !q.depends_on_option_id)
					.map((q: any) => q.id)
					.filter(Boolean)
			);
			const existingTopFuIds = new Set(
				(q?.fileuploadquestion_questions || [])
					.filter((q: any) => !q.depends_on_option_id)
					.map((q: any) => q.id)
					.filter(Boolean)
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
					members_exempt: membersExempt,
					per_event: perEvent
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
					// Note: depends_on_option_id included for conditional sections
					await questionnaireUpdateSection({
						path: { org_questionnaire_id: orgQuestionnaireId, section_id: section._apiId },
						body: {
							name: section.name,
							description: section.description || null,
							order: section.order,
							depends_on_option_id: (section as any)._dependsOnOptionId ?? null
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
			const localTopFuApiIds = new Set<string>();

			for (const question of topLevelQuestions) {
				if (question.type === 'multiple_choice') {
					if (question._apiId) {
						localTopMcApiIds.add(question._apiId);
						await syncMcQuestion(question, authHeader, orgQuestionnaireId);
					} else {
						await createMcQuestion(question, null, authHeader, orgQuestionnaireId);
					}
				} else if (question.type === 'free_text') {
					if (question._apiId) {
						localTopFtApiIds.add(question._apiId);
						await syncFtQuestion(question, authHeader, orgQuestionnaireId);
					} else {
						await createFtQuestion(question, null, authHeader, orgQuestionnaireId);
					}
				} else if (question.type === 'file_upload') {
					if (question._apiId) {
						localTopFuApiIds.add(question._apiId);
						await syncFuQuestion(question, authHeader, orgQuestionnaireId);
					} else {
						await createFuQuestion(question, null, authHeader, orgQuestionnaireId);
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
			for (const existingId of existingTopFuIds) {
				if (!localTopFuApiIds.has(existingId)) {
					await questionnaireDeleteFuQuestion({
						path: { org_questionnaire_id: orgQuestionnaireId, question_id: existingId },
						headers: authHeader
					});
				}
			}

			// Refresh data, re-initialize state from API, and exit edit mode (stay on same page)
			await invalidateAll();
			initializeFromApi(); // Explicitly re-init with fresh data (avoids race with $effect)
			isEditMode = false;

			// Scroll to top so user sees the updated questionnaire
			window.scrollTo({ top: 0, behavior: 'smooth' });
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
		// IMPORTANT: Filter out conditional questions (those with depends_on_option_id)
		// They are managed separately via option.conditionalQuestions
		const apiSection = (q?.sections || []).find((s: any) => s.id === sectionApiId);
		const existingMcIds = new Set(
			(apiSection?.multiplechoicequestion_questions || [])
				.filter((q: any) => !q.depends_on_option_id)
				.map((q: any) => q.id)
				.filter(Boolean)
		);
		const existingFtIds = new Set(
			(apiSection?.freetextquestion_questions || [])
				.filter((q: any) => !q.depends_on_option_id)
				.map((q: any) => q.id)
				.filter(Boolean)
		);
		const existingFuIds = new Set(
			(apiSection?.fileuploadquestion_questions || [])
				.filter((q: any) => !q.depends_on_option_id)
				.map((q: any) => q.id)
				.filter(Boolean)
		);

		const localMcApiIds = new Set<string>();
		const localFtApiIds = new Set<string>();
		const localFuApiIds = new Set<string>();

		for (const question of section.questions) {
			if (question.type === 'multiple_choice') {
				if (question._apiId) {
					localMcApiIds.add(question._apiId);
					await syncMcQuestion(question, authHeader, orgQuestionnaireId);
				} else {
					await createMcQuestion(question, sectionApiId, authHeader, orgQuestionnaireId);
				}
			} else if (question.type === 'free_text') {
				if (question._apiId) {
					localFtApiIds.add(question._apiId);
					await syncFtQuestion(question, authHeader, orgQuestionnaireId);
				} else {
					await createFtQuestion(question, sectionApiId, authHeader, orgQuestionnaireId);
				}
			} else if (question.type === 'file_upload') {
				if (question._apiId) {
					localFuApiIds.add(question._apiId);
					await syncFuQuestion(question, authHeader, orgQuestionnaireId);
				} else {
					await createFuQuestion(question, sectionApiId, authHeader, orgQuestionnaireId);
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
		for (const existingId of existingFuIds) {
			if (!localFuApiIds.has(existingId)) {
				await questionnaireDeleteFuQuestion({
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
			} else if (question.type === 'free_text') {
				await createFtQuestion(question, sectionApiId, authHeader, orgQuestionnaireId);
			} else if (question.type === 'file_upload') {
				await createFuQuestion(question, sectionApiId, authHeader, orgQuestionnaireId);
			}
		}
	}

	async function syncMcQuestion(
		question: Question,
		authHeader: { Authorization: string },
		orgQuestionnaireId: string,
		dependsOnOptionId?: string | null
	) {
		if (!question._apiId) return;

		// Update the question
		// IMPORTANT: Include depends_on_option_id to preserve conditional question relationships
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
				shuffle_options: question.shuffleOptions ?? true,
				depends_on_option_id: dependsOnOptionId ?? null
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

		// Track options and their API IDs for syncing conditional questions
		const optionsToSync: { option: Option; apiId: string }[] = [];

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
				// Track for conditional question sync
				optionsToSync.push({ option, apiId: option._apiId });
			} else if (option.text.trim()) {
				// Create new option
				const response = await questionnaireCreateMcOption({
					path: { org_questionnaire_id: orgQuestionnaireId, question_id: question._apiId },
					body: {
						option: option.text,
						is_correct: option.isCorrect,
						order: i
					},
					headers: authHeader
				});
				// Track newly created option for conditional question sync
				const newOptionId = (response.data as { id?: string })?.id;
				if (newOptionId) {
					optionsToSync.push({ option, apiId: newOptionId });
				}
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

		// Sync conditional questions and sections for each option
		// We sync ALL options (not just ones with conditional content) to handle deletions
		for (const { option, apiId } of optionsToSync) {
			await syncConditionalQuestions(option, apiId, authHeader, orgQuestionnaireId);
			await syncConditionalSections(option, apiId, authHeader, orgQuestionnaireId);
		}
	}

	async function syncFtQuestion(
		question: Question,
		authHeader: { Authorization: string },
		orgQuestionnaireId: string,
		dependsOnOptionId?: string | null
	) {
		if (!question._apiId) return;

		// IMPORTANT: Include depends_on_option_id to preserve conditional question relationships
		await questionnaireUpdateFtQuestion({
			path: { org_questionnaire_id: orgQuestionnaireId, question_id: question._apiId },
			body: {
				question: question.text,
				hint: question.hint || null,
				is_mandatory: question.required,
				positive_weight: String(question.positiveWeight),
				negative_weight: String(question.negativeWeight),
				is_fatal: question.isFatal,
				llm_guidelines: question.llmGuidelines || null,
				depends_on_option_id: dependsOnOptionId ?? null
			},
			headers: authHeader
		});
	}

	async function createMcQuestion(
		question: Question,
		sectionId: string | null,
		authHeader: { Authorization: string },
		orgQuestionnaireId: string,
		dependsOnOptionId?: string | null
	) {
		const apiFormat = mcQuestionToApiFormat(question);
		const response = await questionnaireCreateMcQuestion({
			path: { org_questionnaire_id: orgQuestionnaireId },
			body: {
				section_id: sectionId,
				depends_on_option_id: dependsOnOptionId || null,
				...apiFormat
			},
			headers: authHeader
		});
		return response.data;
	}

	async function createFtQuestion(
		question: Question,
		sectionId: string | null,
		authHeader: { Authorization: string },
		orgQuestionnaireId: string,
		dependsOnOptionId?: string | null
	) {
		const apiFormat = ftQuestionToApiFormat(question);
		const response = await questionnaireCreateFtQuestion({
			path: { org_questionnaire_id: orgQuestionnaireId },
			body: {
				section_id: sectionId,
				depends_on_option_id: dependsOnOptionId || null,
				...apiFormat
			},
			headers: authHeader
		});
		return response.data;
	}

	async function syncFuQuestion(
		question: Question,
		authHeader: { Authorization: string },
		orgQuestionnaireId: string,
		dependsOnOptionId?: string | null
	) {
		if (!question._apiId) return;

		await questionnaireUpdateFuQuestion({
			path: { org_questionnaire_id: orgQuestionnaireId, question_id: question._apiId },
			body: {
				question: question.text,
				hint: question.hint || null,
				is_mandatory: question.required,
				positive_weight: String(question.positiveWeight),
				negative_weight: String(question.negativeWeight),
				is_fatal: question.isFatal,
				allowed_mime_types: question.allowedMimeTypes || ['*/*'],
				max_file_size: question.maxFileSize || 10 * 1024 * 1024,
				max_files: question.maxFiles || 1,
				depends_on_option_id: dependsOnOptionId ?? null
			},
			headers: authHeader
		});
	}

	async function createFuQuestion(
		question: Question,
		sectionId: string | null,
		authHeader: { Authorization: string },
		orgQuestionnaireId: string,
		dependsOnOptionId?: string | null
	) {
		const apiFormat = fuQuestionToApiFormat(question);
		const response = await questionnaireCreateFuQuestion({
			path: { org_questionnaire_id: orgQuestionnaireId },
			body: {
				section_id: sectionId,
				depends_on_option_id: dependsOnOptionId || null,
				...apiFormat
			},
			headers: authHeader
		});
		return response.data;
	}

	// Sync conditional questions for an option
	async function syncConditionalQuestions(
		option: Option,
		optionApiId: string,
		authHeader: { Authorization: string },
		orgQuestionnaireId: string
	) {
		const conditionalQuestions = option.conditionalQuestions || [];

		// Get existing conditional questions for this option from API
		// We need to find them across all questions in the questionnaire
		const existingConditionalMcIds = new Set<string>();
		const existingConditionalFtIds = new Set<string>();

		// Check top-level questions
		for (const apiQ of q?.multiplechoicequestion_questions || []) {
			if (apiQ.depends_on_option_id === optionApiId) {
				existingConditionalMcIds.add(apiQ.id);
			}
		}
		for (const apiQ of q?.freetextquestion_questions || []) {
			if (apiQ.depends_on_option_id === optionApiId) {
				existingConditionalFtIds.add(apiQ.id);
			}
		}

		// Check section questions
		for (const apiSection of q?.sections || []) {
			for (const apiQ of apiSection.multiplechoicequestion_questions || []) {
				if (apiQ.depends_on_option_id === optionApiId) {
					existingConditionalMcIds.add(apiQ.id);
				}
			}
			for (const apiQ of apiSection.freetextquestion_questions || []) {
				if (apiQ.depends_on_option_id === optionApiId) {
					existingConditionalFtIds.add(apiQ.id);
				}
			}
		}

		const localConditionalMcIds = new Set<string>();
		const localConditionalFtIds = new Set<string>();

		// Sync each conditional question
		for (const condQ of conditionalQuestions) {
			if (condQ.type === 'multiple_choice') {
				if (condQ._apiId) {
					localConditionalMcIds.add(condQ._apiId);
					// Update existing conditional question - pass optionApiId to preserve dependency
					await syncMcQuestion(condQ, authHeader, orgQuestionnaireId, optionApiId);
				} else {
					// Create new conditional question
					await createMcQuestion(condQ, null, authHeader, orgQuestionnaireId, optionApiId);
				}
			} else {
				if (condQ._apiId) {
					localConditionalFtIds.add(condQ._apiId);
					// Update existing conditional question - pass optionApiId to preserve dependency
					await syncFtQuestion(condQ, authHeader, orgQuestionnaireId, optionApiId);
				} else {
					// Create new conditional question
					await createFtQuestion(condQ, null, authHeader, orgQuestionnaireId, optionApiId);
				}
			}
		}

		// Delete removed conditional questions
		for (const existingId of existingConditionalMcIds) {
			if (!localConditionalMcIds.has(existingId)) {
				await questionnaireDeleteMcQuestion({
					path: { org_questionnaire_id: orgQuestionnaireId, question_id: existingId },
					headers: authHeader
				});
			}
		}
		for (const existingId of existingConditionalFtIds) {
			if (!localConditionalFtIds.has(existingId)) {
				await questionnaireDeleteFtQuestion({
					path: { org_questionnaire_id: orgQuestionnaireId, question_id: existingId },
					headers: authHeader
				});
			}
		}
	}

	// Sync conditional sections for an option
	async function syncConditionalSections(
		option: Option,
		optionApiId: string,
		authHeader: { Authorization: string },
		orgQuestionnaireId: string
	) {
		const conditionalSections = option.conditionalSections || [];

		// Get existing conditional sections for this option from API
		const existingConditionalSectionIds = new Set<string>();

		for (const apiSection of q?.sections || []) {
			if (apiSection.depends_on_option_id === optionApiId) {
				existingConditionalSectionIds.add(apiSection.id);
			}
		}

		const localConditionalSectionIds = new Set<string>();

		// Sync each conditional section
		for (const condSection of conditionalSections) {
			if ((condSection as any)._apiId) {
				const apiId = (condSection as any)._apiId;
				localConditionalSectionIds.add(apiId);
				// Update existing conditional section
				await questionnaireUpdateSection({
					path: { org_questionnaire_id: orgQuestionnaireId, section_id: apiId },
					body: {
						name: condSection.name,
						description: condSection.description || null,
						order: condSection.order,
						depends_on_option_id: optionApiId
					},
					headers: authHeader
				});
				// Sync questions in this conditional section
				await syncConditionalSectionQuestions(condSection, apiId, authHeader, orgQuestionnaireId);
			} else {
				// Create new conditional section
				const sectionResponse = await questionnaireCreateSection({
					path: { org_questionnaire_id: orgQuestionnaireId },
					body: {
						name: condSection.name,
						description: condSection.description || null,
						order: condSection.order,
						depends_on_option_id: optionApiId
					},
					headers: authHeader
				});
				const sectionData = sectionResponse.data as { id?: string } | undefined;
				if (sectionData?.id) {
					// Create questions in new conditional section
					await createSectionQuestions(
						condSection as any,
						sectionData.id,
						authHeader,
						orgQuestionnaireId
					);
				}
			}
		}

		// Delete removed conditional sections
		for (const existingId of existingConditionalSectionIds) {
			if (!localConditionalSectionIds.has(existingId)) {
				await questionnaireDeleteSection({
					path: { org_questionnaire_id: orgQuestionnaireId, section_id: existingId },
					headers: authHeader
				});
			}
		}
	}

	// Sync questions in a conditional section (similar to syncSectionQuestions but for conditional sections)
	async function syncConditionalSectionQuestions(
		section: ConditionalSection,
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

		const localMcIds = new Set<string>();
		const localFtIds = new Set<string>();

		// Sync each question
		for (const question of section.questions) {
			if (question.type === 'multiple_choice') {
				if (question._apiId) {
					localMcIds.add(question._apiId);
					await syncMcQuestion(question, authHeader, orgQuestionnaireId);
				} else {
					await createMcQuestion(question, sectionApiId, authHeader, orgQuestionnaireId);
				}
			} else {
				if (question._apiId) {
					localFtIds.add(question._apiId);
					await syncFtQuestion(question, authHeader, orgQuestionnaireId);
				} else {
					await createFtQuestion(question, sectionApiId, authHeader, orgQuestionnaireId);
				}
			}
		}

		// Delete removed questions
		for (const existingId of existingMcIds) {
			if (!localMcIds.has(existingId)) {
				await questionnaireDeleteMcQuestion({
					path: { org_questionnaire_id: orgQuestionnaireId, question_id: existingId },
					headers: authHeader
				});
			}
		}
		for (const existingId of existingFtIds) {
			if (!localFtIds.has(existingId)) {
				await questionnaireDeleteFtQuestion({
					path: { org_questionnaire_id: orgQuestionnaireId, question_id: existingId },
					headers: authHeader
				});
			}
		}
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

		<div class="flex items-center justify-between">
			<div>
				<h1 class="text-3xl font-bold tracking-tight">{m['questionnaireEditPage.title']()}</h1>
				<p class="mt-2 text-sm text-muted-foreground">{m['questionnaireEditPage.subtitle']()}</p>
			</div>
			<div class="flex gap-2">
				<Button
					href="/org/{data.organizationSlug}/admin/questionnaires/{data.questionnaire?.id}/summary"
					variant="outline"
					size="sm"
				>
					{m['questionnaireEditPage.viewSummary']()}
				</Button>
			</div>
		</div>
	</div>

	<!-- Status Management -->
	<Card
		class="mb-6 {currentStatus === 'draft'
			? 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30'
			: currentStatus === 'ready'
				? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/30'
				: ''}"
	>
		<CardHeader>
			<div class="flex items-center justify-between">
				<div>
					<CardTitle>{m['questionnaireEditPage.status.title']()}</CardTitle>
					<CardDescription
						class={currentStatus === 'draft'
							? 'text-amber-700 dark:text-amber-300'
							: currentStatus === 'ready'
								? 'text-blue-700 dark:text-blue-300'
								: ''}>{m['questionnaireEditPage.status.description']()}</CardDescription
					>
				</div>
				{#if currentStatus === 'draft'}
					<Badge class="bg-amber-500 text-sm text-white hover:bg-amber-600">
						{currentStatusInfo.label}
					</Badge>
				{:else if currentStatus === 'ready'}
					<Badge class="bg-blue-500 text-sm text-white hover:bg-blue-600">
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
						: currentStatus === 'ready'
							? 'text-blue-700 dark:text-blue-300'
							: 'text-muted-foreground'}"
				>
					{currentStatusInfo.description}
				</p>

				{#if currentStatus === 'ready'}
					<!-- Warning for "ready" but not published status -->
					<div
						class="flex items-start gap-3 rounded-lg border border-orange-300 bg-orange-50 p-4 dark:border-orange-700 dark:bg-orange-950/50"
					>
						<AlertTriangle
							class="h-5 w-5 flex-shrink-0 text-orange-600 dark:text-orange-400"
							aria-hidden="true"
						/>
						<p class="text-sm font-medium text-orange-800 dark:text-orange-200">
							{m['questionnaireEditPage.status.ready_warning']()}
						</p>
					</div>
				{/if}

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
	{#if isEditMode}
		<div
			class="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950"
		>
			<div class="flex items-start justify-between gap-3">
				<div class="flex gap-3">
					<Pencil class="h-5 w-5 flex-shrink-0 text-green-600 dark:text-green-500" />
					<div class="text-sm">
						<p class="font-medium text-green-800 dark:text-green-200">Edit mode enabled</p>
						<p class="mt-1 text-green-700 dark:text-green-300">
							You can now edit questions, sections, and options. Changes will be saved when you
							click Save.
						</p>
					</div>
				</div>
				<Button variant="outline" size="sm" onclick={() => (isEditMode = false)} class="shrink-0">
					Cancel Editing
				</Button>
			</div>
		</div>
	{:else}
		<div
			class="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950"
		>
			<div class="flex items-start justify-between gap-3">
				<div class="flex gap-3">
					<FileEdit class="h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-500" />
					<div class="text-sm">
						<p class="font-medium text-blue-800 dark:text-blue-200">View mode</p>
						<p class="mt-1 text-blue-700 dark:text-blue-300">
							Click "Edit Questionnaire" to modify questions, sections, and options.
						</p>
					</div>
				</div>
				<Button
					variant="default"
					size="sm"
					onclick={() => (isEditMode = true)}
					class="shrink-0 gap-2"
				>
					<Pencil class="h-4 w-4" />
					Edit Questionnaire
				</Button>
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

				<!-- Per-Event Completion (only for admission type) -->
				{#if questionnaireType === 'admission'}
					<div class="space-y-2">
						<div class="flex items-center space-x-2">
							<input
								id="per-event"
								type="checkbox"
								bind:checked={perEvent}
								class="h-4 w-4 rounded border-gray-300"
								disabled={!canEdit}
							/>
							<Label for="per-event" class="font-normal"
								>{m['questionnaireEditPage.perEventLabel']()}</Label
							>
						</div>
						<p class="text-xs text-muted-foreground">
							{m['questionnaireEditPage.perEventDescription']()}
						</p>
					</div>
				{/if}

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
							<Button
								variant="outline"
								size="sm"
								onclick={() => addTopLevelQuestion('file_upload')}
								class="gap-2"
							>
								<Upload class="h-4 w-4" />
								File Upload
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
													<!-- Display conditional questions for this option -->
													{#if option.conditionalQuestions && option.conditionalQuestions.length > 0}
														<div class="ml-6 mt-2 space-y-2 border-l-2 border-primary/30 pl-4">
															<p class="text-xs font-medium text-muted-foreground">
																↳ If selected, show:
															</p>
															{#each option.conditionalQuestions as condQ}
																<div class="rounded border bg-muted/50 p-3">
																	<div class="mb-1 flex items-center gap-2">
																		<span
																			class="rounded px-2 py-0.5 text-xs font-medium {condQ.type ===
																			'multiple_choice'
																				? 'bg-blue-100 text-blue-700'
																				: 'bg-purple-100 text-purple-700'}"
																		>
																			{condQ.type === 'multiple_choice' ? 'MC' : 'FT'}
																		</span>
																		{#if condQ.required}
																			<span class="text-xs text-destructive">Required</span>
																		{/if}
																	</div>
																	<p class="text-sm">{condQ.text}</p>
																	{#if condQ.type === 'multiple_choice' && condQ.options}
																		<div class="mt-1 space-y-0.5">
																			{#each condQ.options as condOpt}
																				<div
																					class="flex items-center gap-1 text-xs text-muted-foreground"
																				>
																					<span>{condOpt.isCorrect ? '✓' : '○'}</span>
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
																↳ If selected, show section:
															</p>
															{#each option.conditionalSections as condSection}
																<div class="rounded border border-green-500/50 bg-green-50/50 p-3">
																	<p class="mb-2 text-sm font-medium">{condSection.name}</p>
																	{#if condSection.description}
																		<p class="mb-2 text-xs text-muted-foreground">
																			{condSection.description}
																		</p>
																	{/if}
																	{#each condSection.questions as condQ}
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
													<!-- Display conditional questions for this option -->
													{#if option.conditionalQuestions && option.conditionalQuestions.length > 0}
														<div class="ml-6 mt-2 space-y-2 border-l-2 border-primary/30 pl-4">
															<p class="text-xs font-medium text-muted-foreground">
																↳ If selected, show:
															</p>
															{#each option.conditionalQuestions as condQ}
																<div class="rounded border bg-muted/50 p-3">
																	<div class="mb-1 flex items-center gap-2">
																		<span
																			class="rounded px-2 py-0.5 text-xs font-medium {condQ.type ===
																			'multiple_choice'
																				? 'bg-blue-100 text-blue-700'
																				: 'bg-purple-100 text-purple-700'}"
																		>
																			{condQ.type === 'multiple_choice' ? 'MC' : 'FT'}
																		</span>
																		{#if condQ.required}
																			<span class="text-xs text-destructive">Required</span>
																		{/if}
																	</div>
																	<p class="text-sm">{condQ.text}</p>
																	{#if condQ.type === 'multiple_choice' && condQ.options}
																		<div class="mt-1 space-y-0.5">
																			{#each condQ.options as condOpt}
																				<div
																					class="flex items-center gap-1 text-xs text-muted-foreground"
																				>
																					<span>{condOpt.isCorrect ? '✓' : '○'}</span>
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
																↳ If selected, show section:
															</p>
															{#each option.conditionalSections as condSection}
																<div class="rounded border border-green-500/50 bg-green-50/50 p-3">
																	<p class="mb-2 text-sm font-medium">{condSection.name}</p>
																	{#if condSection.description}
																		<p class="mb-2 text-xs text-muted-foreground">
																			{condSection.description}
																		</p>
																	{/if}
																	{#each condSection.questions as condQ}
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
						<Button
							variant="outline"
							size="sm"
							onclick={() => addTopLevelQuestion('file_upload')}
							class="gap-2"
						>
							<Upload class="h-4 w-4" />
							File Upload
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
