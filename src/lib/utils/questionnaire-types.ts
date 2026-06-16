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
	QuestionnaireEvaluationStatus as ApiQuestionnaireEvaluationStatus,
	QuestionnaireSubmissionStatus as ApiQuestionnaireSubmissionStatus,
	QuestionnaireStatus as ApiQuestionnaireStatus
} from '$lib/api/generated/types.gen';

/**
 * QuestionnaireEvaluation Status enum
 */
export type QuestionnaireEvaluationStatus = ApiQuestionnaireEvaluationStatus;

/**
 * QuestionnaireSubmission Status enum
 */
export type QuestionnaireSubmissionStatus = ApiQuestionnaireSubmissionStatus;

/**
 * Questionnaire Status enum
 */
export type QuestionnaireStatus = ApiQuestionnaireStatus;

/**
 * SubmissionBadgeStatus extends the backend QuestionnaireEvaluationStatus with a
 * FE-only presentation status for submissions that need no human review.
 *
 * 'auto_accepted' is NOT a backend enum value — it is computed on the frontend
 * via resolveSubmissionBadgeStatus() when requiresEvaluation === false.
 */
export type SubmissionBadgeStatus =
	| 'approved'
	| 'rejected'
	| 'pending review'
	| 'draft'
	| 'auto_accepted';

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
