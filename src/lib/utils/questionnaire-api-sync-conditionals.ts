/**
 * Conditional-content sync helpers for the questionnaire edit page.
 *
 * These handle incremental sync of the questions and sections that hang off a
 * specific MC option (conditional questions/sections revealed by an answer).
 *
 * These helpers and `./questionnaire-api-sync-questions` are mutually recursive
 * (a conditional's sync re-syncs the underlying questions/sections). The cycle
 * is resolved at runtime via hoisted function declarations.
 */

import {
	questionnaireCreateSection,
	questionnaireUpdateSection,
	questionnaireDeleteSection,
	questionnaireDeleteMcQuestion,
	questionnaireDeleteFtQuestion
} from '$lib/api/generated/sdk.gen';

import type {
	QuestionnaireOption,
	QuestionnaireConditionalSection
} from './questionnaire-form-types';

import type { AuthHeader, ApiQuestionnaireShape } from './poll-api-sync-types';

import {
	syncMcQuestion,
	syncFtQuestion,
	createMcQuestion,
	createFtQuestion,
	createSectionQuestions
} from './questionnaire-api-sync-questions';

/** Sync conditional questions attached to a specific option. */
export async function syncConditionalQuestions(
	option: QuestionnaireOption,
	optionApiId: string,
	authHeader: AuthHeader,
	orgQuestionnaireId: string,
	q: ApiQuestionnaireShape | undefined
) {
	const conditionalQuestions = option.conditionalQuestions || [];

	// Get existing conditional questions for this option from API
	const existingConditionalMcIds = new Set<string>();
	const existingConditionalFtIds = new Set<string>();

	for (const apiQ of q?.multiplechoicequestion_questions || []) {
		if (apiQ.depends_on_option_id === optionApiId) existingConditionalMcIds.add(apiQ.id);
	}
	for (const apiQ of q?.freetextquestion_questions || []) {
		if (apiQ.depends_on_option_id === optionApiId) existingConditionalFtIds.add(apiQ.id);
	}
	for (const apiSection of q?.sections || []) {
		for (const apiQ of apiSection.multiplechoicequestion_questions || []) {
			if (apiQ.depends_on_option_id === optionApiId) existingConditionalMcIds.add(apiQ.id);
		}
		for (const apiQ of apiSection.freetextquestion_questions || []) {
			if (apiQ.depends_on_option_id === optionApiId) existingConditionalFtIds.add(apiQ.id);
		}
	}

	const localConditionalMcIds = new Set<string>();
	const localConditionalFtIds = new Set<string>();

	for (const condQ of conditionalQuestions) {
		if (condQ.type === 'multiple_choice') {
			if (condQ._apiId) {
				localConditionalMcIds.add(condQ._apiId);
				await syncMcQuestion(condQ, authHeader, orgQuestionnaireId, q, null, optionApiId);
			} else {
				await createMcQuestion(condQ, null, authHeader, orgQuestionnaireId, optionApiId);
			}
		} else {
			if (condQ._apiId) {
				localConditionalFtIds.add(condQ._apiId);
				await syncFtQuestion(condQ, authHeader, orgQuestionnaireId, null, optionApiId);
			} else {
				await createFtQuestion(condQ, null, authHeader, orgQuestionnaireId, optionApiId);
			}
		}
	}

	// Delete removed conditional questions
	for (const existingId of existingConditionalMcIds) {
		if (!localConditionalMcIds.has(existingId)) {
			await questionnaireDeleteMcQuestion({
				path: { org_questionnaire_id: orgQuestionnaireId, question_id: existingId },
				headers: authHeader
			});
		}
	}
	for (const existingId of existingConditionalFtIds) {
		if (!localConditionalFtIds.has(existingId)) {
			await questionnaireDeleteFtQuestion({
				path: { org_questionnaire_id: orgQuestionnaireId, question_id: existingId },
				headers: authHeader
			});
		}
	}
}

/** Sync conditional sections attached to a specific option. */
export async function syncConditionalSections(
	option: QuestionnaireOption,
	optionApiId: string,
	authHeader: AuthHeader,
	orgQuestionnaireId: string,
	q: ApiQuestionnaireShape | undefined
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
			await questionnaireUpdateSection({
				path: { org_questionnaire_id: orgQuestionnaireId, section_id: apiId },
				body: {
					name: condSection.name,
					description: condSection.description || null,
					order: condSection.order,
					depends_on_option_id: optionApiId
				},
				headers: authHeader
			});
			await syncConditionalSectionQuestions(condSection, apiId, authHeader, orgQuestionnaireId, q);
		} else {
			const sectionResponse = await questionnaireCreateSection({
				path: { org_questionnaire_id: orgQuestionnaireId },
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
				await createSectionQuestions(condSection, sectionData.id, authHeader, orgQuestionnaireId);
			}
		}
	}

	// Delete removed conditional sections
	for (const existingId of existingConditionalSectionIds) {
		if (!localConditionalSectionIds.has(existingId)) {
			await questionnaireDeleteSection({
				path: { org_questionnaire_id: orgQuestionnaireId, section_id: existingId },
				headers: authHeader
			});
		}
	}
}

/** Sync questions within a conditional section. */
export async function syncConditionalSectionQuestions(
	section: QuestionnaireConditionalSection,
	sectionApiId: string,
	authHeader: AuthHeader,
	orgQuestionnaireId: string,
	q: ApiQuestionnaireShape | undefined
) {
	const apiSection = (q?.sections || []).find((s) => s.id === sectionApiId);
	const existingMcIds = new Set<string>(
		(apiSection?.multiplechoicequestion_questions || []).map((apiQ) => apiQ.id).filter(Boolean)
	);
	const existingFtIds = new Set<string>(
		(apiSection?.freetextquestion_questions || []).map((apiQ) => apiQ.id).filter(Boolean)
	);

	const localMcIds = new Set<string>();
	const localFtIds = new Set<string>();

	for (const question of section.questions) {
		if (question.type === 'multiple_choice') {
			if (question._apiId) {
				localMcIds.add(question._apiId);
				await syncMcQuestion(question, authHeader, orgQuestionnaireId, q, sectionApiId);
			} else {
				await createMcQuestion(question, sectionApiId, authHeader, orgQuestionnaireId);
			}
		} else {
			if (question._apiId) {
				localFtIds.add(question._apiId);
				await syncFtQuestion(question, authHeader, orgQuestionnaireId, sectionApiId);
			} else {
				await createFtQuestion(question, sectionApiId, authHeader, orgQuestionnaireId);
			}
		}
	}

	// Delete removed questions
	for (const existingId of existingMcIds) {
		if (!localMcIds.has(existingId)) {
			await questionnaireDeleteMcQuestion({
				path: { org_questionnaire_id: orgQuestionnaireId, question_id: existingId },
				headers: authHeader
			});
		}
	}
	for (const existingId of existingFtIds) {
		if (!localFtIds.has(existingId)) {
			await questionnaireDeleteFtQuestion({
				path: { org_questionnaire_id: orgQuestionnaireId, question_id: existingId },
				headers: authHeader
			});
		}
	}
}
