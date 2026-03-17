/**
 * API ↔ Local converters for the questionnaire edit page.
 *
 * These functions handle:
 * - Converting API response data back to local component state (initialize from API)
 * - Converting local state to API update format (string weights)
 */

import type {
	QuestionnaireOption,
	QuestionnaireQuestion,
	QuestionnaireConditionalSection,
	QuestionnaireSection
} from './questionnaire-form-types';

// ===== API → Local Converters =====

/** Convert an API option to local format. */
export function convertApiOption(apiOption: any): QuestionnaireOption {
	return {
		text: apiOption.option || '',
		isCorrect: apiOption.is_correct || false,
		conditionalQuestions: [],
		conditionalSections: [],
		_apiId: apiOption.id
	};
}

/** Convert an API MC question to local format. */
export function convertApiMcQuestion(
	apiQuestion: any,
	fallbackOrder: number
): QuestionnaireQuestion {
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

/** Convert an API FT question to local format. */
export function convertApiFtQuestion(
	apiQuestion: any,
	fallbackOrder: number
): QuestionnaireQuestion {
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

/** Convert an API FU question to local format. */
export function convertApiFuQuestion(
	apiQuestion: any,
	fallbackOrder: number
): QuestionnaireQuestion {
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

/**
 * Convert an API section to local format.
 * @param conditionalQuestionIds - IDs of questions to exclude (they belong to option conditionals)
 */
export function convertApiSection(
	apiSection: any,
	conditionalQuestionIds?: Set<string>
): QuestionnaireSection {
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

// ===== Initialize from API =====

/** Result of initializing local state from API data. */
export interface InitFromApiResult {
	name: string;
	questionnaireType: 'admission' | 'membership' | 'feedback' | 'generic';
	minScore: number;
	evaluationMode: 'automatic' | 'manual' | 'hybrid';
	shuffleQuestions: boolean;
	shuffleSections: boolean;
	llmGuidelines: string;
	canRetakeAfter: number | null;
	maxAttempts: number;
	membersExempt: boolean;
	perEvent: boolean;
	requiresEvaluation: boolean;
	maxSubmissionAge: number | null;
	topLevelQuestions: QuestionnaireQuestion[];
	sections: QuestionnaireSection[];
}

/**
 * Parse the full API questionnaire + org-questionnaire data into local form state.
 *
 * @param questionnaire - The org-questionnaire wrapper (has `questionnaire_type`, etc.)
 * @param q - The inner questionnaire object (has sections, questions, etc.)
 */
export function initializeFromApiData(questionnaire: any, q: any): InitFromApiResult {
	// Basic info
	const name = q.name || '';
	const minScore = Number(q.min_score ?? 0);
	const evaluationMode = (q.evaluation_mode as 'automatic' | 'manual' | 'hybrid') || 'automatic';
	const shuffleQuestions = q.shuffle_questions ?? false;
	const shuffleSections = q.shuffle_sections ?? false;
	const llmGuidelines = q.llm_guidelines || '';
	const canRetakeAfter =
		q.can_retake_after && typeof q.can_retake_after === 'number'
			? Math.round(q.can_retake_after / 3600)
			: null;
	const maxAttempts = q.max_attempts ?? 0;

	// From org questionnaire
	const questionnaireType = questionnaire.questionnaire_type || 'admission';
	const membersExempt = questionnaire.members_exempt ?? false;
	const perEvent = questionnaire.per_event ?? false;
	const requiresEvaluation = questionnaire.requires_evaluation ?? true;
	const maxSubmissionAge =
		questionnaire.max_submission_age && typeof questionnaire.max_submission_age === 'number'
			? Math.round(questionnaire.max_submission_age / 86400)
			: null;

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

	// ===== Step 2: Collect IDs of conditional questions/sections =====
	const conditionalQuestionIds = new Set<string>();
	const conditionalSectionIds = new Set<string>();

	for (const mcq of q.multiplechoicequestion_questions || []) {
		if (mcq.depends_on_option_id) conditionalQuestionIds.add(mcq.id);
	}
	for (const ftq of q.freetextquestion_questions || []) {
		if (ftq.depends_on_option_id) conditionalQuestionIds.add(ftq.id);
	}
	for (const fuq of q.fileuploadquestion_questions || []) {
		if (fuq.depends_on_option_id) conditionalQuestionIds.add(fuq.id);
	}
	for (const apiSection of q.sections || []) {
		if (apiSection.depends_on_option_id) conditionalSectionIds.add(apiSection.id);
		for (const mcq of apiSection.multiplechoicequestion_questions || []) {
			if (mcq.depends_on_option_id) conditionalQuestionIds.add(mcq.id);
		}
		for (const ftq of apiSection.freetextquestion_questions || []) {
			if (ftq.depends_on_option_id) conditionalQuestionIds.add(ftq.id);
		}
		for (const fuq of apiSection.fileuploadquestion_questions || []) {
			if (fuq.depends_on_option_id) conditionalQuestionIds.add(fuq.id);
		}
	}

	// ===== Step 3: Convert top-level questions (excluding section/conditional) =====
	const topMc = (q.multiplechoicequestion_questions || [])
		.filter((apiQ: any) => !sectionQuestionIds.has(apiQ.id) && !conditionalQuestionIds.has(apiQ.id))
		.map((apiQ: any) => convertApiMcQuestion(apiQ, apiQ.order ?? 0));
	const topFt = (q.freetextquestion_questions || [])
		.filter((apiQ: any) => !sectionQuestionIds.has(apiQ.id) && !conditionalQuestionIds.has(apiQ.id))
		.map((apiQ: any) => convertApiFtQuestion(apiQ, apiQ.order ?? 0));
	const topFu = (q.fileuploadquestion_questions || [])
		.filter((apiQ: any) => !sectionQuestionIds.has(apiQ.id) && !conditionalQuestionIds.has(apiQ.id))
		.map((apiQ: any) => convertApiFuQuestion(apiQ, apiQ.order ?? 0));
	const topLevelQuestions = [...topMc, ...topFt, ...topFu].sort((a, b) => a.order - b.order);

	// ===== Step 4: Convert sections (excluding conditional sections) =====
	const sections = (q.sections || [])
		.filter((apiSection: any) => !conditionalSectionIds.has(apiSection.id))
		.map((apiSection: any) => convertApiSection(apiSection, conditionalQuestionIds))
		.sort((a: QuestionnaireSection, b: QuestionnaireSection) => a.order - b.order);

	// ===== Step 5: Build option map for attaching conditional content =====
	const optionMap = new Map<string, QuestionnaireOption>();

	for (const question of topLevelQuestions) {
		if (question.options) {
			for (const option of question.options) {
				if (option._apiId) optionMap.set(option._apiId, option);
			}
		}
	}
	for (const section of sections) {
		for (const question of section.questions) {
			if (question.options) {
				for (const option of question.options) {
					if (option._apiId) optionMap.set(option._apiId, option);
				}
			}
		}
	}

	// ===== Step 6: Attach conditional questions/sections to parent options =====
	function attachConditionalQuestion(apiQ: any, type: 'mc' | 'ft') {
		if (!apiQ.depends_on_option_id || !conditionalQuestionIds.has(apiQ.id)) return;

		const parentOption = optionMap.get(apiQ.depends_on_option_id);
		if (parentOption) {
			const existingIds = new Set(
				parentOption.conditionalQuestions?.map((cq: QuestionnaireQuestion) => cq._apiId) || []
			);
			if (existingIds.has(apiQ.id)) return;

			const convertedQ =
				type === 'mc'
					? convertApiMcQuestion(apiQ, apiQ.order ?? 0)
					: convertApiFtQuestion(apiQ, apiQ.order ?? 0);
			parentOption.conditionalQuestions = parentOption.conditionalQuestions || [];
			parentOption.conditionalQuestions.push(convertedQ);

			if (type === 'mc' && convertedQ.options) {
				for (const opt of convertedQ.options) {
					if (opt._apiId) optionMap.set(opt._apiId, opt);
				}
			}
		}
	}

	// Conditional MC questions
	for (const apiQ of q.multiplechoicequestion_questions || []) {
		attachConditionalQuestion(apiQ, 'mc');
	}
	for (const apiSection of q.sections || []) {
		for (const apiQ of apiSection.multiplechoicequestion_questions || []) {
			attachConditionalQuestion(apiQ, 'mc');
		}
	}

	// Conditional FT questions
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
				const convertedSection: QuestionnaireConditionalSection = {
					id: crypto.randomUUID(),
					name: apiSection.name || '',
					description: apiSection.description || undefined,
					order: apiSection.order ?? 0,
					questions: []
				};
				const sectionMc = (apiSection.multiplechoicequestion_questions || [])
					.filter((mcq: any) => !mcq.depends_on_option_id)
					.map((mcq: any) => convertApiMcQuestion(mcq, mcq.order ?? 0));
				const sectionFt = (apiSection.freetextquestion_questions || [])
					.filter((ftq: any) => !ftq.depends_on_option_id)
					.map((ftq: any) => convertApiFtQuestion(ftq, ftq.order ?? 0));
				convertedSection.questions = [...sectionMc, ...sectionFt].sort((a, b) => a.order - b.order);
				parentOption.conditionalSections = parentOption.conditionalSections || [];
				parentOption.conditionalSections.push(convertedSection);
			}
		}
	}

	// Sort conditional content within each option
	for (const option of optionMap.values()) {
		if (option.conditionalQuestions && option.conditionalQuestions.length > 1) {
			option.conditionalQuestions.sort((a, b) => a.order - b.order);
		}
		if (option.conditionalSections && option.conditionalSections.length > 1) {
			option.conditionalSections.sort((a, b) => a.order - b.order);
		}
	}

	return {
		name,
		questionnaireType,
		minScore,
		evaluationMode,
		shuffleQuestions,
		shuffleSections,
		llmGuidelines,
		canRetakeAfter,
		maxAttempts,
		membersExempt,
		perEvent,
		requiresEvaluation,
		maxSubmissionAge,
		topLevelQuestions,
		sections
	};
}

// ===== Local → API Update Converters (edit-page style: String weights) =====

/** Convert a local MC question to API update format (string weights). */
export function mcQuestionToEditApiFormat(q: QuestionnaireQuestion) {
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

/** Convert a local FT question to API update format (string weights). */
export function ftQuestionToEditApiFormat(q: QuestionnaireQuestion) {
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

/** Convert a local FU question to API update format (string weights). */
export function fuQuestionToEditApiFormat(q: QuestionnaireQuestion) {
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
