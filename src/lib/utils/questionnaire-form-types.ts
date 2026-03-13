/**
 * Shared TypeScript types and factory functions for the questionnaire
 * create and edit pages.
 *
 * These types represent the LOCAL form state (not the API schemas).
 * They are used for building and editing questionnaires before saving.
 */

// ===== Type Definitions =====

/** An option in a multiple-choice question. */
export interface QuestionnaireOption {
	text: string;
	isCorrect: boolean;
	conditionalQuestions?: QuestionnaireQuestion[];
	conditionalSections?: QuestionnaireConditionalSection[];
	/** Tracks the API ID for existing options (edit page only). */
	_apiId?: string;
}

/** A question (multiple choice, free text, or file upload). */
export interface QuestionnaireQuestion {
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
	options?: QuestionnaireOption[];
	allowMultipleAnswers?: boolean;
	shuffleOptions?: boolean;
	// For free text
	llmGuidelines?: string;
	// For file upload
	allowedMimeTypes?: string[];
	maxFileSize?: number;
	maxFiles?: number;
	/** Tracks the API ID for existing questions (edit page only). */
	_apiId?: string;
}

export type QuestionType = QuestionnaireQuestion['type'];

/** A conditional content section within an option. */
export interface QuestionnaireConditionalSection {
	id: string;
	name: string;
	description?: string;
	order: number;
	questions: QuestionnaireQuestion[];
}

/** A top-level section grouping questions. */
export interface QuestionnaireSection {
	id: string;
	name: string;
	description?: string;
	order: number;
	questions: QuestionnaireQuestion[];
	/** Tracks the API ID for existing sections (edit page only). */
	_apiId?: string;
}

// ===== Factory Functions =====

/** Create a new question of the given type with sensible defaults. */
export function createQuestion(type: QuestionType, order: number): QuestionnaireQuestion {
	const base: QuestionnaireQuestion = {
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
		// file_upload
		return {
			...base,
			allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'],
			maxFileSize: 10 * 1024 * 1024,
			maxFiles: 1
		};
	}
}

/** Create a new empty section. */
export function createSection(existingSectionsCount: number): QuestionnaireSection {
	return {
		id: crypto.randomUUID(),
		name: `Section ${existingSectionsCount + 1}`,
		description: '',
		order: existingSectionsCount,
		questions: []
	};
}

/** Create a new empty option. */
export function createOption(): QuestionnaireOption {
	return { text: '', isCorrect: false };
}

/** Create a new conditional section. */
export function createConditionalSection(existingCount: number): QuestionnaireConditionalSection {
	return {
		id: crypto.randomUUID(),
		name: `Conditional Section ${existingCount + 1}`,
		description: '',
		order: existingCount,
		questions: []
	};
}

// ===== DnD Config Constants =====

/** Flip animation duration for drag-and-drop. */
export const DND_FLIP_DURATION_MS = 200;

/** Drop target styling for drag-and-drop zones. */
export const DND_DROP_TARGET_STYLE = {
	outline: '2px dashed hsl(var(--primary))',
	borderRadius: '8px'
} as const;
