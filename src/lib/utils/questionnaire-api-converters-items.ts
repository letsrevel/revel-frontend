/**
 * API → Local item converters for the questionnaire edit page.
 *
 * These convert individual API response items (options, questions, sections)
 * back to local component state. `initializeFromApiData`
 * (`./questionnaire-api-converters-init`) orchestrates them into the full form
 * state; the public facade (`./questionnaire-api-converters`) re-exports them.
 */

import type {
	QuestionnaireOption,
	QuestionnaireQuestion,
	QuestionnaireSection
} from './questionnaire-form-types';

// ===== Loose API input shapes =====
//
// These interfaces model the API questionnaire data the converters READ. The
// converters are shared by two callers that feed differently-shaped data:
// `QuestionnaireResponseSchema` (run-together collection names, string weights)
// and `QuestionnaireSchema` (underscored names, a subset of fields). Every field
// is therefore optional and weights accept `string | number` — the converters
// coerce/fall back per field. The `[key: string]: unknown` index signature both
// satisfies `normalizeQuestionCollections`'s `Record<string, unknown>` constraint
// and supports the computed collection-name access below.

/** Loose API multiple-choice option item read by the converters. */
export interface ApiOptionInput {
	id?: string;
	option?: string;
	is_correct?: boolean;
	[key: string]: unknown;
}

/** Loose API question item (superset across both schema shapes). */
export interface ApiQuestionInput {
	id?: string;
	question?: string;
	hint?: string | null;
	reviewer_notes?: string | null;
	is_mandatory?: boolean;
	order?: number;
	positive_weight?: string | number | null;
	negative_weight?: string | number | null;
	is_fatal?: boolean;
	allow_multiple_answers?: boolean;
	shuffle_options?: boolean;
	llm_guidelines?: string | null;
	allowed_mime_types?: string[];
	max_file_size?: number;
	max_files?: number;
	depends_on_option_id?: string | null;
	options?: ApiOptionInput[];
	[key: string]: unknown;
}

/** Loose API section item read by the converters. */
export interface ApiSectionInput {
	id?: string;
	name?: string;
	description?: string | null;
	order?: number;
	depends_on_option_id?: string | null;
	multiplechoicequestion_questions?: ApiQuestionInput[];
	freetextquestion_questions?: ApiQuestionInput[];
	fileuploadquestion_questions?: ApiQuestionInput[];
	[key: string]: unknown;
}

// ===== API → Local Converters =====

/** Convert an API option to local format. */
export function convertApiOption(apiOption: ApiOptionInput): QuestionnaireOption {
	return {
		id: apiOption.id ?? crypto.randomUUID(),
		text: apiOption.option || '',
		isCorrect: apiOption.is_correct || false,
		conditionalQuestions: [],
		conditionalSections: [],
		_apiId: apiOption.id
	};
}

/** Convert an API MC question to local format. */
export function convertApiMcQuestion(
	apiQuestion: ApiQuestionInput,
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
		positiveWeight: Number(apiQuestion.positive_weight ?? 1.0),
		negativeWeight: Number(apiQuestion.negative_weight ?? 0.0),
		isFatal: apiQuestion.is_fatal ?? false,
		allowMultipleAnswers: apiQuestion.allow_multiple_answers ?? false,
		shuffleOptions: apiQuestion.shuffle_options ?? true,
		options: (apiQuestion.options || []).map(convertApiOption),
		_apiId: apiQuestion.id
	};
}

/** Convert an API FT question to local format. */
export function convertApiFtQuestion(
	apiQuestion: ApiQuestionInput,
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
		positiveWeight: Number(apiQuestion.positive_weight ?? 1.0),
		negativeWeight: Number(apiQuestion.negative_weight ?? 0.0),
		isFatal: apiQuestion.is_fatal ?? false,
		llmGuidelines: apiQuestion.llm_guidelines || undefined,
		_apiId: apiQuestion.id
	};
}

/** Convert an API FU question to local format. */
export function convertApiFuQuestion(
	apiQuestion: ApiQuestionInput,
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
		positiveWeight: Number(apiQuestion.positive_weight ?? 1.0),
		negativeWeight: Number(apiQuestion.negative_weight ?? 0.0),
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
	apiSection: ApiSectionInput,
	conditionalQuestionIds?: Set<string>
): QuestionnaireSection {
	const mcQuestions = (apiSection.multiplechoicequestion_questions || [])
		.filter((apiQ) => !conditionalQuestionIds?.has(apiQ.id ?? ''))
		.map((apiQ, i: number) => convertApiMcQuestion(apiQ, apiQ.order ?? i));
	const ftQuestions = (apiSection.freetextquestion_questions || [])
		.filter((apiQ) => !conditionalQuestionIds?.has(apiQ.id ?? ''))
		.map((apiQ, i: number) => convertApiFtQuestion(apiQ, apiQ.order ?? mcQuestions.length + i));
	const fuQuestions = (apiSection.fileuploadquestion_questions || [])
		.filter((apiQ) => !conditionalQuestionIds?.has(apiQ.id ?? ''))
		.map((apiQ, i: number) =>
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
