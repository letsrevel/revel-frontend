/**
 * Question + section CRUD helpers for the questionnaire edit page.
 *
 * These handle incremental sync of individual questions (MC/FT/FU), their
 * options, and the questions within a section — diffing local state vs API
 * state and making targeted create/update/delete calls.
 *
 * These helpers and `./questionnaire-api-sync-conditionals` are mutually
 * recursive (an MC option's sync triggers conditional sync, which re-syncs
 * questions). The cycle is resolved at runtime via hoisted function
 * declarations.
 */

import {
	questionnaireUpdateMcQuestion,
	questionnaireCreateMcQuestion,
	questionnaireCreateMcOption,
	questionnaireUpdateMcOption,
	questionnaireDeleteMcOption,
	questionnaireUpdateFtQuestion,
	questionnaireCreateFtQuestion,
	questionnaireDeleteFtQuestion,
	questionnaireUpdateFuQuestion,
	questionnaireCreateFuQuestion,
	questionnaireDeleteMcQuestion,
	questionnaireDeleteFuQuestion
} from '$lib/api/generated/sdk.gen';

import type {
	QuestionnaireOption,
	QuestionnaireQuestion,
	QuestionnaireConditionalSection,
	QuestionnaireSection
} from './questionnaire-form-types';

import type { AuthHeader, ApiOptionShape, ApiQuestionnaireShape } from './poll-api-sync-types';

import {
	mcQuestionToEditApiFormat,
	ftQuestionToEditApiFormat,
	fuQuestionToEditApiFormat
} from './questionnaire-api-converters';

import {
	syncConditionalQuestions,
	syncConditionalSections
} from './questionnaire-api-sync-conditionals';

/** Sync (update) an existing MC question via the API. */
export async function syncMcQuestion(
	question: QuestionnaireQuestion,
	authHeader: AuthHeader,
	orgQuestionnaireId: string,
	q: ApiQuestionnaireShape | undefined,
	sectionId?: string | null,
	dependsOnOptionId?: string | null
) {
	if (!question._apiId) return;

	await questionnaireUpdateMcQuestion({
		path: { org_questionnaire_id: orgQuestionnaireId, question_id: question._apiId },
		body: {
			question: question.text,
			hint: question.hint || null,
			is_mandatory: question.required,
			order: question.order,
			positive_weight: String(question.positiveWeight),
			negative_weight: String(question.negativeWeight),
			is_fatal: question.isFatal,
			allow_multiple_answers: question.allowMultipleAnswers || false,
			shuffle_options: question.shuffleOptions ?? true,
			section_id: sectionId ?? null,
			depends_on_option_id: dependsOnOptionId ?? null
		},
		headers: authHeader
	});

	await syncMcOptions(question, authHeader, orgQuestionnaireId, q);
}

/** Sync options for an existing MC question. */
export async function syncMcOptions(
	question: QuestionnaireQuestion,
	authHeader: AuthHeader,
	orgQuestionnaireId: string,
	q: ApiQuestionnaireShape | undefined
) {
	if (!question._apiId) return;

	// Find existing options from API
	let existingOptions: ApiOptionShape[] = [];
	const topQuestion = (q?.multiplechoicequestion_questions || []).find(
		(apiQ) => apiQ.id === question._apiId
	);
	if (topQuestion) {
		existingOptions = topQuestion.options || [];
	} else {
		for (const section of q?.sections || []) {
			const sectionQuestion = (section.multiplechoicequestion_questions || []).find(
				(apiQ) => apiQ.id === question._apiId
			);
			if (sectionQuestion) {
				existingOptions = sectionQuestion.options || [];
				break;
			}
		}
	}

	const existingOptionIds = new Set(existingOptions.map((o) => o.id).filter(Boolean));
	const localOptionApiIds = new Set<string>();
	const optionsToSync: { option: QuestionnaireOption; apiId: string }[] = [];

	const questionOptions = question.options ?? [];
	for (let i = 0; i < questionOptions.length; i++) {
		const option = questionOptions[i];
		if (option._apiId) {
			localOptionApiIds.add(option._apiId);
			await questionnaireUpdateMcOption({
				path: { org_questionnaire_id: orgQuestionnaireId, option_id: option._apiId },
				body: { option: option.text, is_correct: option.isCorrect, order: i },
				headers: authHeader
			});
			optionsToSync.push({ option, apiId: option._apiId });
		} else if (option.text.trim()) {
			const response = await questionnaireCreateMcOption({
				path: { org_questionnaire_id: orgQuestionnaireId, question_id: question._apiId },
				body: { option: option.text, is_correct: option.isCorrect, order: i },
				headers: authHeader
			});
			const newOptionId = (response.data as { id?: string })?.id;
			if (newOptionId) {
				optionsToSync.push({ option, apiId: newOptionId });
			}
		}
	}

	// Delete removed options
	for (const existingId of existingOptionIds) {
		if (!localOptionApiIds.has(existingId)) {
			await questionnaireDeleteMcOption({
				path: { org_questionnaire_id: orgQuestionnaireId, option_id: existingId },
				headers: authHeader
			});
		}
	}

	// Sync conditional questions and sections for each option
	for (const { option, apiId } of optionsToSync) {
		await syncConditionalQuestions(option, apiId, authHeader, orgQuestionnaireId, q);
		await syncConditionalSections(option, apiId, authHeader, orgQuestionnaireId, q);
	}
}

/** Sync (update) an existing FT question via the API. */
export async function syncFtQuestion(
	question: QuestionnaireQuestion,
	authHeader: AuthHeader,
	orgQuestionnaireId: string,
	sectionId?: string | null,
	dependsOnOptionId?: string | null
) {
	if (!question._apiId) return;

	await questionnaireUpdateFtQuestion({
		path: { org_questionnaire_id: orgQuestionnaireId, question_id: question._apiId },
		body: {
			question: question.text,
			hint: question.hint || null,
			is_mandatory: question.required,
			order: question.order,
			positive_weight: String(question.positiveWeight),
			negative_weight: String(question.negativeWeight),
			is_fatal: question.isFatal,
			llm_guidelines: question.llmGuidelines || null,
			section_id: sectionId ?? null,
			depends_on_option_id: dependsOnOptionId ?? null
		},
		headers: authHeader
	});
}

/** Sync (update) an existing FU question via the API. */
export async function syncFuQuestion(
	question: QuestionnaireQuestion,
	authHeader: AuthHeader,
	orgQuestionnaireId: string,
	sectionId?: string | null,
	dependsOnOptionId?: string | null
) {
	if (!question._apiId) return;

	await questionnaireUpdateFuQuestion({
		path: { org_questionnaire_id: orgQuestionnaireId, question_id: question._apiId },
		body: {
			question: question.text,
			hint: question.hint || null,
			is_mandatory: question.required,
			order: question.order,
			positive_weight: String(question.positiveWeight),
			negative_weight: String(question.negativeWeight),
			is_fatal: question.isFatal,
			allowed_mime_types: question.allowedMimeTypes || ['*/*'],
			max_file_size: question.maxFileSize || 10 * 1024 * 1024,
			max_files: question.maxFiles || 1,
			section_id: sectionId ?? null,
			depends_on_option_id: dependsOnOptionId ?? null
		},
		headers: authHeader
	});
}

/** Create a new MC question via the API. */
export async function createMcQuestion(
	question: QuestionnaireQuestion,
	sectionId: string | null,
	authHeader: AuthHeader,
	orgQuestionnaireId: string,
	dependsOnOptionId?: string | null
) {
	const apiFormat = mcQuestionToEditApiFormat(question);
	const response = await questionnaireCreateMcQuestion({
		path: { org_questionnaire_id: orgQuestionnaireId },
		body: {
			section_id: sectionId,
			depends_on_option_id: dependsOnOptionId || null,
			...apiFormat
		},
		headers: authHeader
	});
	return response.data;
}

/** Create a new FT question via the API. */
export async function createFtQuestion(
	question: QuestionnaireQuestion,
	sectionId: string | null,
	authHeader: AuthHeader,
	orgQuestionnaireId: string,
	dependsOnOptionId?: string | null
) {
	const apiFormat = ftQuestionToEditApiFormat(question);
	const response = await questionnaireCreateFtQuestion({
		path: { org_questionnaire_id: orgQuestionnaireId },
		body: {
			section_id: sectionId,
			depends_on_option_id: dependsOnOptionId || null,
			...apiFormat
		},
		headers: authHeader
	});
	return response.data;
}

/** Create a new FU question via the API. */
export async function createFuQuestion(
	question: QuestionnaireQuestion,
	sectionId: string | null,
	authHeader: AuthHeader,
	orgQuestionnaireId: string,
	dependsOnOptionId?: string | null
) {
	const apiFormat = fuQuestionToEditApiFormat(question);
	const response = await questionnaireCreateFuQuestion({
		path: { org_questionnaire_id: orgQuestionnaireId },
		body: {
			section_id: sectionId,
			depends_on_option_id: dependsOnOptionId || null,
			...apiFormat
		},
		headers: authHeader
	});
	return response.data;
}

/** Create all questions within a newly created section. */
export async function createSectionQuestions(
	section: QuestionnaireSection | QuestionnaireConditionalSection,
	sectionApiId: string,
	authHeader: AuthHeader,
	orgQuestionnaireId: string
) {
	for (const question of section.questions) {
		if (question.type === 'multiple_choice') {
			await createMcQuestion(question, sectionApiId, authHeader, orgQuestionnaireId);
		} else if (question.type === 'free_text') {
			await createFtQuestion(question, sectionApiId, authHeader, orgQuestionnaireId);
		} else if (question.type === 'file_upload') {
			await createFuQuestion(question, sectionApiId, authHeader, orgQuestionnaireId);
		}
	}
}

/** Sync questions within an existing section. */
export async function syncSectionQuestions(
	section: QuestionnaireSection,
	sectionApiId: string,
	authHeader: AuthHeader,
	orgQuestionnaireId: string,
	q: ApiQuestionnaireShape | undefined
) {
	// Filter out conditional questions (managed separately)
	const apiSection = (q?.sections || []).find((s) => s.id === sectionApiId);
	const existingMcIds = new Set(
		(apiSection?.multiplechoicequestion_questions || [])
			.filter((apiQ) => !apiQ.depends_on_option_id)
			.map((apiQ) => apiQ.id)
			.filter(Boolean) as string[]
	);
	const existingFtIds = new Set(
		(apiSection?.freetextquestion_questions || [])
			.filter((apiQ) => !apiQ.depends_on_option_id)
			.map((apiQ) => apiQ.id)
			.filter(Boolean) as string[]
	);
	const existingFuIds = new Set(
		(apiSection?.fileuploadquestion_questions || [])
			.filter((apiQ) => !apiQ.depends_on_option_id)
			.map((apiQ) => apiQ.id)
			.filter(Boolean) as string[]
	);

	const localMcApiIds = new Set<string>();
	const localFtApiIds = new Set<string>();
	const localFuApiIds = new Set<string>();

	for (const question of section.questions) {
		if (question.type === 'multiple_choice') {
			if (question._apiId) {
				localMcApiIds.add(question._apiId);
				await syncMcQuestion(question, authHeader, orgQuestionnaireId, q, sectionApiId);
			} else {
				await createMcQuestion(question, sectionApiId, authHeader, orgQuestionnaireId);
			}
		} else if (question.type === 'free_text') {
			if (question._apiId) {
				localFtApiIds.add(question._apiId);
				await syncFtQuestion(question, authHeader, orgQuestionnaireId, sectionApiId);
			} else {
				await createFtQuestion(question, sectionApiId, authHeader, orgQuestionnaireId);
			}
		} else if (question.type === 'file_upload') {
			if (question._apiId) {
				localFuApiIds.add(question._apiId);
				await syncFuQuestion(question, authHeader, orgQuestionnaireId, sectionApiId);
			} else {
				await createFuQuestion(question, sectionApiId, authHeader, orgQuestionnaireId);
			}
		}
	}

	// Delete removed questions
	for (const existingId of existingMcIds) {
		if (!localMcApiIds.has(existingId)) {
			await questionnaireDeleteMcQuestion({
				path: { org_questionnaire_id: orgQuestionnaireId, question_id: existingId },
				headers: authHeader
			});
		}
	}
	for (const existingId of existingFtIds) {
		if (!localFtApiIds.has(existingId)) {
			await questionnaireDeleteFtQuestion({
				path: { org_questionnaire_id: orgQuestionnaireId, question_id: existingId },
				headers: authHeader
			});
		}
	}
	for (const existingId of existingFuIds) {
		if (!localFuApiIds.has(existingId)) {
			await questionnaireDeleteFuQuestion({
				path: { org_questionnaire_id: orgQuestionnaireId, question_id: existingId },
				headers: authHeader
			});
		}
	}
}
