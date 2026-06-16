import type { QuestionnaireEvaluationStatus } from '$lib/api/generated/types.gen';
import type { SubmissionBadgeStatus } from '$lib/components/questionnaires/SubmissionStatusBadge.svelte';

/**
 * Resolves the correct badge status for a questionnaire submission.
 *
 * - If the questionnaire does not require evaluation (`requiresEvaluation === false`),
 *   submissions are granted access immediately → show `'auto_accepted'`.
 * - If evaluation is required and a status exists, return that status.
 * - If evaluation is required but no status exists yet, fall back to `'pending review'`.
 */
export function resolveSubmissionBadgeStatus(
	requiresEvaluation: boolean,
	evaluationStatus: QuestionnaireEvaluationStatus | null | undefined
): SubmissionBadgeStatus {
	if (!requiresEvaluation) {
		return 'auto_accepted';
	}
	return evaluationStatus ?? 'pending review';
}
