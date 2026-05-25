/**
 * Shared types for the poll DRAFT question-sync helpers.
 *
 * The `Api*Shape` interfaces describe the NORMALIZED API questionnaire that the
 * sync helpers diff against — i.e. the output of `normalizeQuestionCollections`,
 * which exposes question collections under the Django reverse-relation names
 * (`multiplechoicequestion_questions`, ...). They intentionally model only the
 * fields the diffing reads, not the full generated schema.
 */

/** Authorization header carried through every sync call. */
export type AuthHeader = { Authorization: string };

/** Minimal shape of an API multiple-choice option as read during diffing. */
export interface ApiOptionShape {
	id: string;
}

/** Minimal shape of an API question as read during diffing. */
export interface ApiQuestionShape {
	id: string;
	depends_on_option_id?: string | null;
	options?: ApiOptionShape[] | null;
}

/** Minimal shape of an API section as read during diffing. */
export interface ApiSectionShape {
	id: string;
	depends_on_option_id?: string | null;
	multiplechoicequestion_questions?: ApiQuestionShape[] | null;
	freetextquestion_questions?: ApiQuestionShape[] | null;
	fileuploadquestion_questions?: ApiQuestionShape[] | null;
}

/** Normalized API questionnaire shape the sync helpers diff against. */
export interface ApiQuestionnaireShape {
	multiplechoicequestion_questions?: ApiQuestionShape[] | null;
	freetextquestion_questions?: ApiQuestionShape[] | null;
	fileuploadquestion_questions?: ApiQuestionShape[] | null;
	sections?: ApiSectionShape[] | null;
}
