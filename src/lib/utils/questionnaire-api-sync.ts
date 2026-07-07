/**
 * API sync orchestrator for the questionnaire edit page.
 *
 * These functions handle incremental sync: diffing local state vs API state
 * and making targeted create/update/delete API calls.
 *
 * The per-question/section helpers live in `./questionnaire-api-sync-questions`
 * and the conditional-content helpers in `./questionnaire-api-sync-conditionals`.
 * They are re-exported here so existing importers of this module keep working.
 */

import {
	questionnaireUpdateOrgQuestionnaire,
	questionnaireCreateSection,
	questionnaireUpdateSection,
	questionnaireDeleteSection,
	questionnaireDeleteMcQuestion,
	questionnaireDeleteFtQuestion,
	questionnaireDeleteFuQuestion
} from '$lib/api/generated/sdk.gen';
import type { QuestionnaireEvaluationMode, QuestionnaireType } from '$lib/api/generated/types.gen';

import type { QuestionnaireQuestion, QuestionnaireSection } from './questionnaire-form-types';

import type { AuthHeader, ApiQuestionnaireShape } from './poll-api-sync-types';

import {
	syncMcQuestion,
	syncFtQuestion,
	syncFuQuestion,
	createMcQuestion,
	createFtQuestion,
	createFuQuestion,
	createSectionQuestions,
	syncSectionQuestions
} from './questionnaire-api-sync-questions';

// Re-export sync helpers for backwards compatibility
export {
	syncMcQuestion,
	syncMcOptions,
	syncFtQuestion,
	syncFuQuestion,
	createMcQuestion,
	createFtQuestion,
	createFuQuestion,
	createSectionQuestions,
	syncSectionQuestions
} from './questionnaire-api-sync-questions';

export {
	syncConditionalQuestions,
	syncConditionalSections,
	syncConditionalSectionQuestions
} from './questionnaire-api-sync-conditionals';

// Re-export converters for backwards compatibility
export {
	convertApiOption,
	convertApiMcQuestion,
	convertApiFtQuestion,
	convertApiFuQuestion,
	convertApiSection,
	initializeFromApiData,
	mcQuestionToEditApiFormat,
	ftQuestionToEditApiFormat,
	fuQuestionToEditApiFormat
} from './questionnaire-api-converters';

export type { InitFromApiResult } from './questionnaire-api-converters';

/**
 * Perform the full incremental save of a questionnaire (edit page).
 *
 * Updates metadata, syncs sections and top-level questions, deletes removed items.
 */
export async function saveQuestionnaireIncremental(params: {
	orgQuestionnaireId: string;
	authHeader: AuthHeader;
	q: ApiQuestionnaireShape | undefined;
	name: string;
	minScore: number;
	evaluationMode: QuestionnaireEvaluationMode;
	questionnaireType: QuestionnaireType;
	maxSubmissionAge: number | null;
	shuffleQuestions: boolean;
	shuffleSections: boolean;
	llmGuidelines: string;
	canRetakeAfter: number | null;
	maxAttempts: number;
	membersExempt: boolean;
	perEvent: boolean;
	requiresEvaluation: boolean;
	topLevelQuestions: QuestionnaireQuestion[];
	sections: QuestionnaireSection[];
}) {
	const {
		orgQuestionnaireId,
		authHeader,
		q,
		name,
		minScore,
		evaluationMode,
		questionnaireType,
		maxSubmissionAge,
		shuffleQuestions,
		shuffleSections,
		llmGuidelines,
		canRetakeAfter,
		maxAttempts,
		membersExempt,
		perEvent,
		requiresEvaluation,
		topLevelQuestions,
		sections
	} = params;

	// Track existing NON-CONDITIONAL items for deletion
	const existingSectionIds = new Set(
		(q?.sections || [])
			.filter((s) => !s.depends_on_option_id)
			.map((s) => s.id)
			.filter(Boolean) as string[]
	);
	const existingTopMcIds = new Set(
		(q?.multiplechoicequestion_questions || [])
			.filter((apiQ) => !apiQ.depends_on_option_id)
			.map((apiQ) => apiQ.id)
			.filter(Boolean) as string[]
	);
	const existingTopFtIds = new Set(
		(q?.freetextquestion_questions || [])
			.filter((apiQ) => !apiQ.depends_on_option_id)
			.map((apiQ) => apiQ.id)
			.filter(Boolean) as string[]
	);
	const existingTopFuIds = new Set(
		(q?.fileuploadquestion_questions || [])
			.filter((apiQ) => !apiQ.depends_on_option_id)
			.map((apiQ) => apiQ.id)
			.filter(Boolean) as string[]
	);

	// 1. Update metadata
	const metadataResponse = await questionnaireUpdateOrgQuestionnaire({
		path: { org_questionnaire_id: orgQuestionnaireId },
		body: {
			name,
			min_score: minScore,
			evaluation_mode: evaluationMode,
			questionnaire_type: questionnaireType,
			max_submission_age: maxSubmissionAge ? `P${maxSubmissionAge}D` : null,
			shuffle_questions: shuffleQuestions,
			shuffle_sections: shuffleSections,
			llm_guidelines: llmGuidelines || null,
			can_retake_after: canRetakeAfter ? `PT${canRetakeAfter * 3600}S` : null,
			max_attempts: maxAttempts,
			members_exempt: membersExempt,
			per_event: perEvent,
			requires_evaluation: requiresEvaluation
		},
		headers: authHeader
	});

	if (metadataResponse.error) {
		const err = metadataResponse.error;
		const detail =
			err && typeof err === 'object' && 'detail' in err && typeof err.detail === 'string'
				? err.detail
				: JSON.stringify(err);
		throw new Error(`Failed to update questionnaire metadata: ${detail}`);
	}

	// 2. Sync sections
	const localSectionApiIds = new Set<string>();
	for (const section of sections) {
		if (section._apiId) {
			localSectionApiIds.add(section._apiId);
			await questionnaireUpdateSection({
				path: { org_questionnaire_id: orgQuestionnaireId, section_id: section._apiId },
				body: {
					name: section.name,
					description: section.description || null,
					order: section.order,
					depends_on_option_id: section._dependsOnOptionId ?? null
				},
				headers: authHeader
			});
			await syncSectionQuestions(section, section._apiId, authHeader, orgQuestionnaireId, q);
		} else {
			const sectionResponse = await questionnaireCreateSection({
				path: { org_questionnaire_id: orgQuestionnaireId },
				body: {
					name: section.name,
					description: section.description || null,
					order: section.order
				},
				headers: authHeader
			});
			const sectionData = sectionResponse.data as { id?: string } | undefined;
			if (sectionData?.id) {
				await createSectionQuestions(section, sectionData.id, authHeader, orgQuestionnaireId);
			}
		}
	}

	// Delete removed sections
	for (const existingId of existingSectionIds) {
		if (!localSectionApiIds.has(existingId)) {
			await questionnaireDeleteSection({
				path: { org_questionnaire_id: orgQuestionnaireId, section_id: existingId },
				headers: authHeader
			});
		}
	}

	// 3. Sync top-level questions
	const localTopMcApiIds = new Set<string>();
	const localTopFtApiIds = new Set<string>();
	const localTopFuApiIds = new Set<string>();

	for (const question of topLevelQuestions) {
		if (question.type === 'multiple_choice') {
			if (question._apiId) {
				localTopMcApiIds.add(question._apiId);
				await syncMcQuestion(question, authHeader, orgQuestionnaireId, q);
			} else {
				await createMcQuestion(question, null, authHeader, orgQuestionnaireId);
			}
		} else if (question.type === 'free_text') {
			if (question._apiId) {
				localTopFtApiIds.add(question._apiId);
				await syncFtQuestion(question, authHeader, orgQuestionnaireId);
			} else {
				await createFtQuestion(question, null, authHeader, orgQuestionnaireId);
			}
		} else if (question.type === 'file_upload') {
			if (question._apiId) {
				localTopFuApiIds.add(question._apiId);
				await syncFuQuestion(question, authHeader, orgQuestionnaireId);
			} else {
				await createFuQuestion(question, null, authHeader, orgQuestionnaireId);
			}
		}
	}

	// Delete removed top-level questions
	for (const existingId of existingTopMcIds) {
		if (!localTopMcApiIds.has(existingId)) {
			await questionnaireDeleteMcQuestion({
				path: { org_questionnaire_id: orgQuestionnaireId, question_id: existingId },
				headers: authHeader
			});
		}
	}
	for (const existingId of existingTopFtIds) {
		if (!localTopFtApiIds.has(existingId)) {
			await questionnaireDeleteFtQuestion({
				path: { org_questionnaire_id: orgQuestionnaireId, question_id: existingId },
				headers: authHeader
			});
		}
	}
	for (const existingId of existingTopFuIds) {
		if (!localTopFuApiIds.has(existingId)) {
			await questionnaireDeleteFuQuestion({
				path: { org_questionnaire_id: orgQuestionnaireId, question_id: existingId },
				headers: authHeader
			});
		}
	}
}
