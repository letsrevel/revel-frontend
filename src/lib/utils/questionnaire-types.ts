/**
 * Questionnaire Status Type Aliases
 *
 * The generated TypeScript types from OpenAPI don't handle string enums with spaces properly.
 * This file provides correct type aliases for questionnaire Status enums.
 *
 * Backend enums:
 * - QuestionnaireEvaluation.Status: 'approved' | 'rejected' | 'pending review'
 * - QuestionnaireSubmission.Status: 'draft' | 'ready'
 * - Questionnaire.Status: 'draft' | 'ready' | 'published'
 */

import type {
	QuestionnairesModelsQuestionnaireEvaluationStatus,
	QuestionnairesModelsQuestionnaireSubmissionStatus,
	QuestionnairesModelsQuestionnaireStatus
} from '$lib/api/generated/types.gen';

/**
 * QuestionnaireEvaluation Status enum
 * Note: The generated type is missing 'pending review' due to OpenAPI generator limitations
 */
export type QuestionnaireEvaluationStatus =
	| QuestionnairesModelsQuestionnaireEvaluationStatus
	| 'pending review';

/**
 * QuestionnaireSubmission Status enum
 */
export type QuestionnaireSubmissionStatus = QuestionnairesModelsQuestionnaireSubmissionStatus;

/**
 * Questionnaire Status enum
 */
export type QuestionnaireStatus = QuestionnairesModelsQuestionnaireStatus;

/**
 * Type guards for questionnaire evaluation status
 */
export function isApproved(status: QuestionnaireEvaluationStatus | null | undefined): boolean {
	return status === 'approved';
}

export function isRejected(status: QuestionnaireEvaluationStatus | null | undefined): boolean {
	return status === 'rejected';
}

export function isPendingReview(status: QuestionnaireEvaluationStatus | null | undefined): boolean {
	return status === 'pending review';
}

/**
 * Type guards for questionnaire submission status
 */
export function isDraft(
	status: QuestionnaireSubmissionStatus | QuestionnaireStatus | null | undefined
): boolean {
	return status === 'draft';
}

export function isReady(
	status: QuestionnaireSubmissionStatus | QuestionnaireStatus | null | undefined
): boolean {
	return status === 'ready';
}

export function isPublished(status: QuestionnaireStatus | null | undefined): boolean {
	return status === 'published';
}
