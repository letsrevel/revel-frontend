/**
 * Shared CRUD/manipulation and API-format-conversion functions for the
 * questionnaire create and edit pages.
 *
 * All list-manipulation helpers are pure functions: they accept the current
 * list, return a new list, and let the caller assign it back to the `$state`.
 */

import {
	createQuestion,
	type QuestionnaireQuestion,
	type QuestionnaireSection,
	type QuestionnaireConditionalSection,
	type QuestionType
} from './questionnaire-form-types';

// ===== Top-Level Question Helpers =====

/** Add a new question to the end of a top-level questions list. */
export function addTopLevelQuestion(
	questions: QuestionnaireQuestion[],
	type: QuestionType
): QuestionnaireQuestion[] {
	const newQuestion = createQuestion(type, questions.length);
	return [...questions, newQuestion];
}

/** Remove a question by id and re-order the remainder. */
export function removeTopLevelQuestion(
	questions: QuestionnaireQuestion[],
	id: string
): QuestionnaireQuestion[] {
	return questions.filter((q) => q.id !== id).map((q, index) => ({ ...q, order: index }));
}

/** Shallow-merge `updates` into the question with the given id. */
export function updateTopLevelQuestion(
	questions: QuestionnaireQuestion[],
	id: string,
	updates: Partial<QuestionnaireQuestion>
): QuestionnaireQuestion[] {
	return questions.map((q) => (q.id === id ? { ...q, ...updates } : q));
}

// ===== Section Helpers =====

/** Append a new section and return the updated list. */
export function addSection(sections: QuestionnaireSection[]): QuestionnaireSection[] {
	const newSection: QuestionnaireSection = {
		id: crypto.randomUUID(),
		name: `Section ${sections.length + 1}`,
		description: '',
		order: sections.length,
		questions: []
	};
	return [...sections, newSection];
}

/** Remove a section by id and re-order the remainder. */
export function removeSection(
	sections: QuestionnaireSection[],
	id: string
): QuestionnaireSection[] {
	return sections.filter((s) => s.id !== id).map((s, index) => ({ ...s, order: index }));
}

/** Shallow-merge `updates` into the section with the given id. */
export function updateSection(
	sections: QuestionnaireSection[],
	id: string,
	updates: Partial<QuestionnaireSection>
): QuestionnaireSection[] {
	return sections.map((s) => (s.id === id ? { ...s, ...updates } : s));
}

// ===== Section-Question Helpers =====

/** Add a new question to a specific section. */
export function addQuestionToSection(
	sections: QuestionnaireSection[],
	sectionId: string,
	type: QuestionType
): QuestionnaireSection[] {
	return sections.map((s) => {
		if (s.id === sectionId) {
			const newQuestion = createQuestion(type, s.questions.length);
			return { ...s, questions: [...s.questions, newQuestion] };
		}
		return s;
	});
}

/** Remove a question from a section and re-order remaining questions. */
export function removeQuestionFromSection(
	sections: QuestionnaireSection[],
	sectionId: string,
	questionId: string
): QuestionnaireSection[] {
	return sections.map((s) => {
		if (s.id === sectionId) {
			const newQuestions = s.questions
				.filter((q) => q.id !== questionId)
				.map((q, index) => ({ ...q, order: index }));
			return { ...s, questions: newQuestions };
		}
		return s;
	});
}

/** Update a question within a specific section. */
export function updateQuestionInSection(
	sections: QuestionnaireSection[],
	sectionId: string,
	questionId: string,
	updates: Partial<QuestionnaireQuestion>
): QuestionnaireSection[] {
	return sections.map((s) => {
		if (s.id === sectionId) {
			return {
				...s,
				questions: s.questions.map((q) => (q.id === questionId ? { ...q, ...updates } : q))
			};
		}
		return s;
	});
}

/** Replace the questions list for a specific section (used after drag-and-drop). */
export function reorderQuestionsInSection(
	sections: QuestionnaireSection[],
	sectionId: string,
	newQuestions: QuestionnaireQuestion[]
): QuestionnaireSection[] {
	return sections.map((s) => {
		if (s.id === sectionId) {
			return { ...s, questions: newQuestions };
		}
		return s;
	});
}

// ===== API Format Converters (create-page style: numeric weights) =====

/** Convert a conditional MC question to API format (no nested conditionals). */
export function conditionalMcQuestionToApiFormat(
	q: QuestionnaireQuestion,
	order: number
): Record<string, unknown> {
	return {
		question: q.text,
		hint: q.hint || null,
		is_mandatory: q.required,
		order,
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

/** Convert a conditional FT question to API format. */
export function conditionalFtQuestionToApiFormat(
	q: QuestionnaireQuestion,
	order: number
): Record<string, unknown> {
	return {
		question: q.text,
		hint: q.hint || null,
		is_mandatory: q.required,
		order,
		positive_weight: q.positiveWeight,
		negative_weight: q.negativeWeight,
		is_fatal: q.isFatal,
		llm_guidelines: q.llmGuidelines || null
	};
}

/** Convert a conditional FU question to API format. */
export function conditionalFuQuestionToApiFormat(
	q: QuestionnaireQuestion,
	order: number
): Record<string, unknown> {
	return {
		question: q.text,
		hint: q.hint || null,
		is_mandatory: q.required,
		order,
		positive_weight: q.positiveWeight,
		negative_weight: q.negativeWeight,
		is_fatal: q.isFatal,
		allowed_mime_types: q.allowedMimeTypes || ['image/jpeg', 'image/png', 'application/pdf'],
		max_file_size: q.maxFileSize || 5242880,
		max_files: q.maxFiles || 1
	};
}

/** Convert a conditional section to API format. */
export function conditionalSectionToApiFormat(
	s: QuestionnaireConditionalSection,
	order: number
): Record<string, unknown> {
	const mcQuestions = s.questions
		.filter((q) => q.type === 'multiple_choice' && q.text.trim())
		.map((q, idx) => conditionalMcQuestionToApiFormat(q, idx));
	const ftQuestions = s.questions
		.filter((q) => q.type === 'free_text' && q.text.trim())
		.map((q, idx) => conditionalFtQuestionToApiFormat(q, idx));
	const fuQuestions = s.questions
		.filter((q) => q.type === 'file_upload' && q.text.trim())
		.map((q, idx) => conditionalFuQuestionToApiFormat(q, idx));

	return {
		name: s.name,
		description: s.description || null,
		order,
		...(mcQuestions.length > 0 ? { multiplechoicequestion_questions: mcQuestions } : {}),
		...(ftQuestions.length > 0 ? { freetextquestion_questions: ftQuestions } : {}),
		...(fuQuestions.length > 0 ? { fileuploadquestion_questions: fuQuestions } : {})
	};
}

/**
 * Convert a top-level / section-level MC question to API create format.
 * Includes conditional questions/sections on each option.
 */
export function mcQuestionToCreateApiFormat(q: QuestionnaireQuestion): Record<string, unknown> {
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
				.map((o, i) => {
					const conditionalMc = (o.conditionalQuestions || [])
						.filter((cq) => cq.type === 'multiple_choice' && cq.text.trim())
						.map((cq, idx) => conditionalMcQuestionToApiFormat(cq, idx));
					const conditionalFt = (o.conditionalQuestions || [])
						.filter((cq) => cq.type === 'free_text' && cq.text.trim())
						.map((cq, idx) => conditionalFtQuestionToApiFormat(cq, idx));
					const conditionalFu = (o.conditionalQuestions || [])
						.filter((cq) => cq.type === 'file_upload' && cq.text.trim())
						.map((cq, idx) => conditionalFuQuestionToApiFormat(cq, idx));
					const conditionalSections = (o.conditionalSections || [])
						.filter((cs) => cs.name.trim())
						.map((cs, idx) => conditionalSectionToApiFormat(cs, idx));

					return {
						option: o.text,
						is_correct: o.isCorrect,
						order: i,
						...(conditionalMc.length > 0 ? { conditional_mc_questions: conditionalMc } : {}),
						...(conditionalFt.length > 0 ? { conditional_ft_questions: conditionalFt } : {}),
						...(conditionalFu.length > 0 ? { conditional_fu_questions: conditionalFu } : {}),
						...(conditionalSections.length > 0 ? { conditional_sections: conditionalSections } : {})
					};
				}) || []
	};
}

/** Convert a top-level / section-level FT question to API create format. */
export function ftQuestionToCreateApiFormat(q: QuestionnaireQuestion): Record<string, unknown> {
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

/** Convert a top-level / section-level FU question to API create format. */
export function fuQuestionToCreateApiFormat(q: QuestionnaireQuestion): Record<string, unknown> {
	return {
		question: q.text,
		hint: q.hint || null,
		reviewer_notes: q.reviewerNotes || null,
		is_mandatory: q.required,
		order: q.order,
		positive_weight: q.positiveWeight,
		negative_weight: q.negativeWeight,
		is_fatal: q.isFatal,
		allowed_mime_types: q.allowedMimeTypes || ['image/jpeg', 'image/png', 'application/pdf'],
		max_file_size: q.maxFileSize || 5242880,
		max_files: q.maxFiles || 1
	};
}

/** Parse validation error responses from the API into a user-friendly string. */
export function parseValidationErrors(errorData: unknown): string {
	if (!errorData || typeof errorData !== 'object') {
		return 'An unknown validation error occurred.';
	}

	const messages: string[] = [];

	if (Array.isArray(errorData)) {
		for (const err of errorData) {
			if (typeof err === 'string') {
				messages.push(err);
			} else if (err && typeof err === 'object') {
				for (const [field, fieldErrors] of Object.entries(err)) {
					if (Array.isArray(fieldErrors)) {
						for (const fieldErr of fieldErrors) {
							if (typeof fieldErr === 'string') {
								messages.push(`${field}: ${fieldErr}`);
							} else if (fieldErr && typeof fieldErr === 'object' && 'message' in fieldErr) {
								messages.push(`${field}: ${(fieldErr as { message: string }).message}`);
							}
						}
					} else if (typeof fieldErrors === 'string') {
						messages.push(`${field}: ${fieldErrors}`);
					}
				}
			}
		}
	} else {
		for (const [field, fieldErrors] of Object.entries(errorData)) {
			if (Array.isArray(fieldErrors)) {
				for (const err of fieldErrors) {
					if (typeof err === 'string') {
						messages.push(`${field}: ${err}`);
					} else if (err && typeof err === 'object' && 'message' in err) {
						messages.push(`${field}: ${(err as { message: string }).message}`);
					}
				}
			} else if (typeof fieldErrors === 'string') {
				messages.push(`${field}: ${fieldErrors}`);
			}
		}
	}

	if (messages.length === 0) {
		return 'Validation failed. Please check your input.';
	}

	return messages
		.map((msg) => {
			if (msg.includes('multiple correct answers')) {
				return 'A question with "Allow multiple answers" disabled cannot have multiple correct options marked. Please enable "Allow multiple answers" or select only one correct option.';
			}
			return msg;
		})
		.join('\n');
}

/**
 * Build the sections array for the create-questionnaire API payload.
 */
export function buildCreateApiSections(sections: QuestionnaireSection[]) {
	return sections.map((s) => ({
		name: s.name,
		description: s.description || null,
		order: s.order,
		multiplechoicequestion_questions: s.questions
			.filter((q) => q.type === 'multiple_choice')
			.map((q) => mcQuestionToCreateApiFormat(q)),
		freetextquestion_questions: s.questions
			.filter((q) => q.type === 'free_text')
			.map((q) => ftQuestionToCreateApiFormat(q)),
		fileuploadquestion_questions: s.questions
			.filter((q) => q.type === 'file_upload')
			.map((q) => fuQuestionToCreateApiFormat(q))
	}));
}
