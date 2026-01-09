/**
 * Utility functions for handling conditional questions in questionnaires.
 *
 * Conditional questions are questions that only appear when a specific
 * option is selected in a multiple choice question. They have a
 * `depends_on_option_id` field that references the triggering option.
 */

import type {
	QuestionnaireSchema,
	SectionSchema,
	MultipleChoiceQuestionSchema,
	FreeTextQuestionSchema
} from '$lib/api/generated';

/**
 * Combined question type that can be either multiple choice or free text.
 */
export interface ConditionalQuestion {
	id: string;
	question: string;
	hint?: string | null;
	is_mandatory: boolean;
	order: number;
	depends_on_option_id?: string | null;
	type: 'multiple_choice' | 'free_text';
	// For multiple choice
	allow_multiple_answers?: boolean;
	options?: Array<{ id: string; option: string; order: number }>;
}

/**
 * A section that may have conditional visibility.
 */
export interface ConditionalSection {
	id: string;
	name: string;
	description?: string | null;
	order: number;
	depends_on_option_id?: string | null;
	questions: ConditionalQuestion[];
}

/**
 * Flattened structure of all questions with their conditional information.
 */
export interface FlattenedQuestionnaire {
	/** All top-level questions (not in sections, not conditional to an option) */
	topLevelQuestions: ConditionalQuestion[];
	/** All sections (may be conditional) */
	sections: ConditionalSection[];
	/** Map of option_id -> questions that depend on it */
	optionDependencies: Map<string, ConditionalQuestion[]>;
	/** Map of option_id -> sections that depend on it */
	sectionDependencies: Map<string, ConditionalSection[]>;
	/** Set of all option IDs that have dependent questions/sections */
	optionsWithDependents: Set<string>;
}

/**
 * Convert a MultipleChoiceQuestionSchema to ConditionalQuestion.
 */
function mcToConditional(q: MultipleChoiceQuestionSchema): ConditionalQuestion {
	return {
		id: q.id,
		question: q.question,
		hint: q.hint,
		is_mandatory: q.is_mandatory,
		order: q.order,
		depends_on_option_id: q.depends_on_option_id,
		type: 'multiple_choice',
		allow_multiple_answers: q.allow_multiple_answers,
		options: q.options
	};
}

/**
 * Convert a FreeTextQuestionSchema to ConditionalQuestion.
 */
function ftToConditional(q: FreeTextQuestionSchema): ConditionalQuestion {
	return {
		id: q.id,
		question: q.question,
		hint: q.hint,
		is_mandatory: q.is_mandatory,
		order: q.order,
		depends_on_option_id: q.depends_on_option_id,
		type: 'free_text'
	};
}

/**
 * Convert a SectionSchema to ConditionalSection.
 */
function sectionToConditional(s: SectionSchema): ConditionalSection {
	const mcQuestions = (s.multiple_choice_questions || []).map(mcToConditional);
	const ftQuestions = (s.free_text_questions || []).map(ftToConditional);
	const allQuestions = [...mcQuestions, ...ftQuestions].sort((a, b) => a.order - b.order);

	return {
		id: s.id,
		name: s.name,
		description: s.description,
		order: s.order,
		depends_on_option_id: s.depends_on_option_id,
		questions: allQuestions
	};
}

/**
 * Flatten a questionnaire into a structure that makes it easy to work with
 * conditional questions and sections.
 */
export function flattenQuestionnaire(questionnaire: QuestionnaireSchema): FlattenedQuestionnaire {
	const optionDependencies = new Map<string, ConditionalQuestion[]>();
	const sectionDependencies = new Map<string, ConditionalSection[]>();
	const optionsWithDependents = new Set<string>();

	// Process top-level questions
	const mcQuestions = (questionnaire.multiple_choice_questions || []).map(mcToConditional);
	const ftQuestions = (questionnaire.free_text_questions || []).map(ftToConditional);
	const allTopLevel = [...mcQuestions, ...ftQuestions].sort((a, b) => a.order - b.order);

	// Separate conditional from non-conditional top-level questions
	const topLevelQuestions: ConditionalQuestion[] = [];
	for (const q of allTopLevel) {
		if (q.depends_on_option_id) {
			const deps = optionDependencies.get(q.depends_on_option_id) || [];
			deps.push(q);
			optionDependencies.set(q.depends_on_option_id, deps);
			optionsWithDependents.add(q.depends_on_option_id);
		} else {
			topLevelQuestions.push(q);
		}
	}

	// Process sections
	const allSections = (questionnaire.sections || []).map(sectionToConditional);
	const sections: ConditionalSection[] = [];

	for (const section of allSections) {
		if (section.depends_on_option_id) {
			const deps = sectionDependencies.get(section.depends_on_option_id) || [];
			deps.push(section);
			sectionDependencies.set(section.depends_on_option_id, deps);
			optionsWithDependents.add(section.depends_on_option_id);
		} else {
			sections.push(section);
		}

		// Also check questions within sections for dependencies
		for (const q of section.questions) {
			if (q.depends_on_option_id) {
				const deps = optionDependencies.get(q.depends_on_option_id) || [];
				deps.push(q);
				optionDependencies.set(q.depends_on_option_id, deps);
				optionsWithDependents.add(q.depends_on_option_id);
			}
		}
	}

	// Sort sections by order
	sections.sort((a, b) => a.order - b.order);

	return {
		topLevelQuestions,
		sections,
		optionDependencies,
		sectionDependencies,
		optionsWithDependents
	};
}

/**
 * Given a set of selected option IDs, determine which questions are visible.
 * A question is visible if:
 * 1. It has no depends_on_option_id (always visible), OR
 * 2. Its depends_on_option_id is in the selected options set
 */
export function getVisibleQuestionIds(
	flattened: FlattenedQuestionnaire,
	selectedOptionIds:
		| Set<string>
		| { has(value: string): boolean; [Symbol.iterator](): Iterator<string> }
): Set<string> {
	const visibleIds = new Set<string>();

	// All non-conditional top-level questions are visible
	for (const q of flattened.topLevelQuestions) {
		if (!q.depends_on_option_id) {
			visibleIds.add(q.id);
		}
	}

	// Check conditional questions based on selected options
	for (const optionId of selectedOptionIds) {
		const deps = flattened.optionDependencies.get(optionId);
		if (deps) {
			for (const q of deps) {
				visibleIds.add(q.id);
			}
		}
	}

	// Questions in visible sections (non-conditional or condition met)
	for (const section of flattened.sections) {
		// Add all questions from non-conditional sections
		for (const q of section.questions) {
			if (!q.depends_on_option_id) {
				visibleIds.add(q.id);
			} else if (selectedOptionIds.has(q.depends_on_option_id)) {
				visibleIds.add(q.id);
			}
		}
	}

	// Questions from conditional sections where condition is met
	for (const optionId of selectedOptionIds) {
		const deps = flattened.sectionDependencies.get(optionId);
		if (deps) {
			for (const section of deps) {
				for (const q of section.questions) {
					// Questions in conditional sections are visible if:
					// 1. The section's condition is met (we're in this loop), AND
					// 2. The question itself doesn't have a condition OR its condition is met
					if (!q.depends_on_option_id || selectedOptionIds.has(q.depends_on_option_id)) {
						visibleIds.add(q.id);
					}
				}
			}
		}
	}

	return visibleIds;
}

/**
 * Given a set of selected option IDs, determine which sections are visible.
 */
export function getVisibleSectionIds(
	flattened: FlattenedQuestionnaire,
	selectedOptionIds:
		| Set<string>
		| { has(value: string): boolean; [Symbol.iterator](): Iterator<string> }
): Set<string> {
	const visibleIds = new Set<string>();

	// Non-conditional sections are always visible
	for (const section of flattened.sections) {
		if (!section.depends_on_option_id) {
			visibleIds.add(section.id);
		}
	}

	// Conditional sections where condition is met
	for (const optionId of selectedOptionIds) {
		const deps = flattened.sectionDependencies.get(optionId);
		if (deps) {
			for (const section of deps) {
				visibleIds.add(section.id);
			}
		}
	}

	return visibleIds;
}

/**
 * Check if a question's mandatory status should be enforced.
 * A conditional mandatory question is only required if its condition is met.
 */
export function isMandatoryAndVisible(
	question: ConditionalQuestion,
	visibleQuestionIds: Set<string>
): boolean {
	return question.is_mandatory && visibleQuestionIds.has(question.id);
}

/**
 * Get all questions that depend on a specific option (for inline display).
 */
export function getQuestionsForOption(
	flattened: FlattenedQuestionnaire,
	optionId: string
): ConditionalQuestion[] {
	return flattened.optionDependencies.get(optionId) || [];
}

/**
 * Get all sections that depend on a specific option (for inline display).
 */
export function getSectionsForOption(
	flattened: FlattenedQuestionnaire,
	optionId: string
): ConditionalSection[] {
	return flattened.sectionDependencies.get(optionId) || [];
}

/**
 * Check if an option has any dependent questions or sections.
 */
export function optionHasDependents(flattened: FlattenedQuestionnaire, optionId: string): boolean {
	return flattened.optionsWithDependents.has(optionId);
}
