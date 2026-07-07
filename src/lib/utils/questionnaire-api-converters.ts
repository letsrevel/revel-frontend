/**
 * API ↔ Local converters for the questionnaire edit page.
 *
 * This module owns the Local → API update converters (string weights) and
 * re-exports the API → Local item converters
 * (`./questionnaire-api-converters-items`) and the initialize-from-API
 * orchestration (`./questionnaire-api-converters-init`) so existing importers
 * of this path keep working unchanged.
 */

import type { QuestionnaireQuestion } from './questionnaire-form-types';

// Re-export API → Local item converters for backwards compatibility
export {
	convertApiOption,
	convertApiMcQuestion,
	convertApiFtQuestion,
	convertApiFuQuestion,
	convertApiSection
} from './questionnaire-api-converters-items';

// Re-export initialize-from-API orchestration for backwards compatibility
export {
	normalizeQuestionCollections,
	initializeFromApiData
} from './questionnaire-api-converters-init';

export type { InitFromApiResult } from './questionnaire-api-converters-init';

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
