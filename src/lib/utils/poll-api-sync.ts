/**
 * API sync orchestrator for the poll DRAFT question edit page.
 *
 * Mirrors `questionnaire-api-sync.ts` but calls the `pollquestion*` SDK
 * functions with `poll_id` path params instead of `org_questionnaire_id`.
 *
 * Only the incremental question sync is handled here; poll metadata (name,
 * description, visibility, etc.) is saved via `pollPatchPoll` separately.
 *
 * The per-question/section/conditional helpers live in
 * `./poll-api-sync-questions` and `./poll-api-sync-conditionals`.
 */

import {
	pollquestionCreateSection,
	pollquestionUpdateSection,
	pollquestionDeleteSection,
	pollquestionDeleteMcQuestion,
	pollquestionDeleteFtQuestion,
	pollquestionDeleteFuQuestion
} from '$lib/api/generated/sdk.gen';

import type { QuestionnaireSchema } from '$lib/api/generated/types.gen';

import type { QuestionnaireQuestion, QuestionnaireSection } from './questionnaire-form-types';

import { normalizeQuestionCollections } from './questionnaire-api-converters';

import type { AuthHeader, ApiQuestionnaireShape, ApiSectionShape } from './poll-api-sync-types';

import {
	syncPollMcQuestion,
	syncPollFtQuestion,
	syncPollFuQuestion,
	createPollMcQuestion,
	createPollFtQuestion,
	createPollFuQuestion,
	createPollSectionQuestions,
	syncPollSectionQuestions
} from './poll-api-sync-questions';

/**
 * Perform the full incremental save of a DRAFT poll's questions.
 *
 * Syncs sections and top-level questions against the API, creating new items,
 * updating existing ones, and deleting removed ones.
 *
 * Poll metadata (name, description, visibility, etc.) is NOT handled here —
 * it is saved via `pollPatchPoll` in the page's `save()` function.
 */
export async function savePollQuestionsIncremental(params: {
	pollId: string;
	accessToken: string;
	q: QuestionnaireSchema | null | undefined;
	sections: QuestionnaireSection[];
	topLevelQuestions: QuestionnaireQuestion[];
}) {
	const { pollId, accessToken, q: rawQ, sections, topLevelQuestions } = params;

	// Normalize the API questionnaire shape before diffing. The poll-detail
	// endpoint embeds a `QuestionnaireSchema` with underscored collection names
	// (`multiple_choice_questions`, ...), but every read below (and in the
	// sub-helpers we pass `q` to) uses the Django reverse-relation names
	// (`multiplechoicequestion_questions`, ...). Without this, the "existing IDs"
	// sets are always empty, so removed questions/options/sections are never
	// DELETEd on save and reappear after reload. normalizeQuestionCollections
	// coalesces both shapes; we apply it top-level and per-section. The casts
	// bridge the underscored input shape to the reverse-relation read shape.
	const q = normalizeQuestionCollections(
		(rawQ ?? {}) as Record<string, unknown>
	) as ApiQuestionnaireShape;
	q.sections = ((rawQ?.sections ?? []) as unknown as Record<string, unknown>[]).map(
		(s) => normalizeQuestionCollections(s) as unknown as ApiSectionShape
	);

	const authHeader: AuthHeader = { Authorization: `Bearer ${accessToken}` };

	// Track existing NON-CONDITIONAL items for deletion
	const existingSectionIds = new Set(
		(q?.sections || [])
			.filter((s) => !s.depends_on_option_id)
			.map((s) => s.id)
			.filter(Boolean)
	);
	const existingTopMcIds = new Set(
		(q?.multiplechoicequestion_questions || [])
			.filter((apiQ) => !apiQ.depends_on_option_id)
			.map((apiQ) => apiQ.id)
			.filter(Boolean)
	);
	const existingTopFtIds = new Set(
		(q?.freetextquestion_questions || [])
			.filter((apiQ) => !apiQ.depends_on_option_id)
			.map((apiQ) => apiQ.id)
			.filter(Boolean)
	);
	const existingTopFuIds = new Set(
		(q?.fileuploadquestion_questions || [])
			.filter((apiQ) => !apiQ.depends_on_option_id)
			.map((apiQ) => apiQ.id)
			.filter(Boolean)
	);

	// 1. Sync sections
	const localSectionApiIds = new Set<string>();
	for (const section of sections) {
		if (section._apiId) {
			localSectionApiIds.add(section._apiId);
			await pollquestionUpdateSection({
				path: { poll_id: pollId, section_id: section._apiId },
				body: {
					name: section.name,
					description: section.description || null,
					order: section.order,
					depends_on_option_id: section._dependsOnOptionId ?? null
				},
				headers: authHeader
			});
			await syncPollSectionQuestions(section, section._apiId, authHeader, pollId, q);
		} else {
			const sectionResponse = await pollquestionCreateSection({
				path: { poll_id: pollId },
				body: {
					name: section.name,
					description: section.description || null,
					order: section.order
				},
				headers: authHeader
			});
			const sectionData = sectionResponse.data as { id?: string } | undefined;
			if (sectionData?.id) {
				await createPollSectionQuestions(section, sectionData.id, authHeader, pollId);
			}
		}
	}

	// Delete removed sections
	for (const existingId of existingSectionIds) {
		if (!localSectionApiIds.has(existingId)) {
			await pollquestionDeleteSection({
				path: { poll_id: pollId, section_id: existingId },
				headers: authHeader
			});
		}
	}

	// 2. Sync top-level questions
	const localTopMcApiIds = new Set<string>();
	const localTopFtApiIds = new Set<string>();
	const localTopFuApiIds = new Set<string>();

	for (const question of topLevelQuestions) {
		if (question.type === 'multiple_choice') {
			if (question._apiId) {
				localTopMcApiIds.add(question._apiId);
				await syncPollMcQuestion(question, authHeader, pollId, q);
			} else {
				await createPollMcQuestion(question, null, authHeader, pollId);
			}
		} else if (question.type === 'free_text') {
			if (question._apiId) {
				localTopFtApiIds.add(question._apiId);
				await syncPollFtQuestion(question, authHeader, pollId);
			} else {
				await createPollFtQuestion(question, null, authHeader, pollId);
			}
		} else if (question.type === 'file_upload') {
			if (question._apiId) {
				localTopFuApiIds.add(question._apiId);
				await syncPollFuQuestion(question, authHeader, pollId);
			} else {
				await createPollFuQuestion(question, null, authHeader, pollId);
			}
		}
	}

	// Delete removed top-level questions
	for (const existingId of existingTopMcIds) {
		if (!localTopMcApiIds.has(existingId)) {
			await pollquestionDeleteMcQuestion({
				path: { poll_id: pollId, question_id: existingId },
				headers: authHeader
			});
		}
	}
	for (const existingId of existingTopFtIds) {
		if (!localTopFtApiIds.has(existingId)) {
			await pollquestionDeleteFtQuestion({
				path: { poll_id: pollId, question_id: existingId },
				headers: authHeader
			});
		}
	}
	for (const existingId of existingTopFuIds) {
		if (!localTopFuApiIds.has(existingId)) {
			await pollquestionDeleteFuQuestion({
				path: { poll_id: pollId, question_id: existingId },
				headers: authHeader
			});
		}
	}
}
