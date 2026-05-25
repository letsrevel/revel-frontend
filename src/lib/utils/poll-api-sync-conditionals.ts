/**
 * Conditional question + section sync helpers for the poll DRAFT edit page.
 *
 * Mirrors the conditional-content handling of `questionnaire-api-sync.ts` but
 * calls the `pollquestion*` SDK functions with `poll_id` path params.
 *
 * These helpers and `./poll-api-sync-questions` are mutually recursive; the
 * cycle is resolved at runtime via hoisted function declarations.
 */

import {
	pollquestionCreateSection,
	pollquestionUpdateSection,
	pollquestionDeleteSection,
	pollquestionDeleteMcQuestion,
	pollquestionDeleteFtQuestion,
	pollquestionDeleteFuQuestion
} from '$lib/api/generated/sdk.gen';

import type {
	QuestionnaireOption,
	QuestionnaireConditionalSection
} from './questionnaire-form-types';

import type { AuthHeader, ApiQuestionnaireShape } from './poll-api-sync-types';

import {
	syncPollMcQuestion,
	syncPollFtQuestion,
	syncPollFuQuestion,
	createPollMcQuestion,
	createPollFtQuestion,
	createPollFuQuestion,
	createPollSectionQuestions
} from './poll-api-sync-questions';

/** Sync conditional questions attached to a specific poll option. */
export async function syncPollConditionalQuestions(
	option: QuestionnaireOption,
	optionApiId: string,
	authHeader: AuthHeader,
	pollId: string,
	q: ApiQuestionnaireShape
) {
	const conditionalQuestions = option.conditionalQuestions || [];

	// Get existing conditional questions for this option from API
	const existingConditionalMcIds = new Set<string>();
	const existingConditionalFtIds = new Set<string>();
	const existingConditionalFuIds = new Set<string>();

	for (const apiQ of q?.multiplechoicequestion_questions || []) {
		if (apiQ.depends_on_option_id === optionApiId) existingConditionalMcIds.add(apiQ.id);
	}
	for (const apiQ of q?.freetextquestion_questions || []) {
		if (apiQ.depends_on_option_id === optionApiId) existingConditionalFtIds.add(apiQ.id);
	}
	for (const apiQ of q?.fileuploadquestion_questions || []) {
		if (apiQ.depends_on_option_id === optionApiId) existingConditionalFuIds.add(apiQ.id);
	}
	for (const apiSection of q?.sections || []) {
		for (const apiQ of apiSection.multiplechoicequestion_questions || []) {
			if (apiQ.depends_on_option_id === optionApiId) existingConditionalMcIds.add(apiQ.id);
		}
		for (const apiQ of apiSection.freetextquestion_questions || []) {
			if (apiQ.depends_on_option_id === optionApiId) existingConditionalFtIds.add(apiQ.id);
		}
		for (const apiQ of apiSection.fileuploadquestion_questions || []) {
			if (apiQ.depends_on_option_id === optionApiId) existingConditionalFuIds.add(apiQ.id);
		}
	}

	const localConditionalMcIds = new Set<string>();
	const localConditionalFtIds = new Set<string>();
	const localConditionalFuIds = new Set<string>();

	for (const condQ of conditionalQuestions) {
		if (condQ.type === 'multiple_choice') {
			if (condQ._apiId) {
				localConditionalMcIds.add(condQ._apiId);
				await syncPollMcQuestion(condQ, authHeader, pollId, q, null, optionApiId);
			} else {
				await createPollMcQuestion(condQ, null, authHeader, pollId, optionApiId);
			}
		} else if (condQ.type === 'file_upload') {
			if (condQ._apiId) {
				localConditionalFuIds.add(condQ._apiId);
				await syncPollFuQuestion(condQ, authHeader, pollId, null, optionApiId);
			} else {
				await createPollFuQuestion(condQ, null, authHeader, pollId, optionApiId);
			}
		} else {
			if (condQ._apiId) {
				localConditionalFtIds.add(condQ._apiId);
				await syncPollFtQuestion(condQ, authHeader, pollId, null, optionApiId);
			} else {
				await createPollFtQuestion(condQ, null, authHeader, pollId, optionApiId);
			}
		}
	}

	// Delete removed conditional questions
	for (const existingId of existingConditionalMcIds) {
		if (!localConditionalMcIds.has(existingId)) {
			await pollquestionDeleteMcQuestion({
				path: { poll_id: pollId, question_id: existingId },
				headers: authHeader
			});
		}
	}
	for (const existingId of existingConditionalFtIds) {
		if (!localConditionalFtIds.has(existingId)) {
			await pollquestionDeleteFtQuestion({
				path: { poll_id: pollId, question_id: existingId },
				headers: authHeader
			});
		}
	}
	for (const existingId of existingConditionalFuIds) {
		if (!localConditionalFuIds.has(existingId)) {
			await pollquestionDeleteFuQuestion({
				path: { poll_id: pollId, question_id: existingId },
				headers: authHeader
			});
		}
	}
}

/** Sync conditional sections attached to a specific poll option. */
export async function syncPollConditionalSections(
	option: QuestionnaireOption,
	optionApiId: string,
	authHeader: AuthHeader,
	pollId: string,
	q: ApiQuestionnaireShape
) {
	const conditionalSections = option.conditionalSections || [];

	const existingConditionalSectionIds = new Set<string>();
	for (const apiSection of q?.sections || []) {
		if (apiSection.depends_on_option_id === optionApiId) {
			existingConditionalSectionIds.add(apiSection.id);
		}
	}

	const localConditionalSectionIds = new Set<string>();

	for (const condSection of conditionalSections) {
		if (condSection._apiId) {
			const apiId = condSection._apiId;
			localConditionalSectionIds.add(apiId);
			await pollquestionUpdateSection({
				path: { poll_id: pollId, section_id: apiId },
				body: {
					name: condSection.name,
					description: condSection.description || null,
					order: condSection.order,
					depends_on_option_id: optionApiId
				},
				headers: authHeader
			});
			await syncPollConditionalSectionQuestions(condSection, apiId, authHeader, pollId, q);
		} else {
			const sectionResponse = await pollquestionCreateSection({
				path: { poll_id: pollId },
				body: {
					name: condSection.name,
					description: condSection.description || null,
					order: condSection.order,
					depends_on_option_id: optionApiId
				},
				headers: authHeader
			});
			const sectionData = sectionResponse.data as { id?: string } | undefined;
			if (sectionData?.id) {
				await createPollSectionQuestions(condSection, sectionData.id, authHeader, pollId);
			}
		}
	}

	// Delete removed conditional sections
	for (const existingId of existingConditionalSectionIds) {
		if (!localConditionalSectionIds.has(existingId)) {
			await pollquestionDeleteSection({
				path: { poll_id: pollId, section_id: existingId },
				headers: authHeader
			});
		}
	}
}

/** Sync questions within a conditional poll section. */
export async function syncPollConditionalSectionQuestions(
	section: QuestionnaireConditionalSection,
	sectionApiId: string,
	authHeader: AuthHeader,
	pollId: string,
	q: ApiQuestionnaireShape
) {
	const apiSection = (q?.sections || []).find((s) => s.id === sectionApiId);
	const existingMcIds = new Set<string>(
		(apiSection?.multiplechoicequestion_questions || []).map((apiQ) => apiQ.id).filter(Boolean)
	);
	const existingFtIds = new Set<string>(
		(apiSection?.freetextquestion_questions || []).map((apiQ) => apiQ.id).filter(Boolean)
	);
	const existingFuIds = new Set<string>(
		(apiSection?.fileuploadquestion_questions || []).map((apiQ) => apiQ.id).filter(Boolean)
	);

	const localMcIds = new Set<string>();
	const localFtIds = new Set<string>();
	const localFuIds = new Set<string>();

	for (const question of section.questions) {
		if (question.type === 'multiple_choice') {
			if (question._apiId) {
				localMcIds.add(question._apiId);
				await syncPollMcQuestion(question, authHeader, pollId, q, sectionApiId);
			} else {
				await createPollMcQuestion(question, sectionApiId, authHeader, pollId);
			}
		} else if (question.type === 'file_upload') {
			if (question._apiId) {
				localFuIds.add(question._apiId);
				await syncPollFuQuestion(question, authHeader, pollId, sectionApiId);
			} else {
				await createPollFuQuestion(question, sectionApiId, authHeader, pollId);
			}
		} else {
			if (question._apiId) {
				localFtIds.add(question._apiId);
				await syncPollFtQuestion(question, authHeader, pollId, sectionApiId);
			} else {
				await createPollFtQuestion(question, sectionApiId, authHeader, pollId);
			}
		}
	}

	// Delete removed questions
	for (const existingId of existingMcIds) {
		if (!localMcIds.has(existingId)) {
			await pollquestionDeleteMcQuestion({
				path: { poll_id: pollId, question_id: existingId },
				headers: authHeader
			});
		}
	}
	for (const existingId of existingFtIds) {
		if (!localFtIds.has(existingId)) {
			await pollquestionDeleteFtQuestion({
				path: { poll_id: pollId, question_id: existingId },
				headers: authHeader
			});
		}
	}
	for (const existingId of existingFuIds) {
		if (!localFuIds.has(existingId)) {
			await pollquestionDeleteFuQuestion({
				path: { poll_id: pollId, question_id: existingId },
				headers: authHeader
			});
		}
	}
}
