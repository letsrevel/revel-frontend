/**
 * Question + section CRUD helpers for the poll DRAFT edit page.
 *
 * Mirrors `questionnaire-api-sync.ts` but calls the `pollquestion*` SDK
 * functions with `poll_id` path params instead of `org_questionnaire_id`.
 *
 * These helpers and `./poll-api-sync-conditionals` are mutually recursive
 * (an MC option's sync triggers conditional sync, which re-syncs questions).
 * The cycle is resolved at runtime via hoisted function declarations.
 */

import {
	pollquestionCreateMcQuestion,
	pollquestionUpdateMcQuestion,
	pollquestionDeleteMcQuestion,
	pollquestionCreateMcOption,
	pollquestionUpdateMcOption,
	pollquestionDeleteMcOption,
	pollquestionCreateFtQuestion,
	pollquestionUpdateFtQuestion,
	pollquestionDeleteFtQuestion,
	pollquestionCreateFuQuestion,
	pollquestionUpdateFuQuestion,
	pollquestionDeleteFuQuestion
} from '$lib/api/generated/sdk.gen';

import type {
	QuestionnaireOption,
	QuestionnaireQuestion,
	QuestionnaireConditionalSection,
	QuestionnaireSection
} from './questionnaire-form-types';

import {
	mcQuestionToEditApiFormat,
	ftQuestionToEditApiFormat,
	fuQuestionToEditApiFormat
} from './questionnaire-api-converters';

import type { AuthHeader, ApiOptionShape, ApiQuestionnaireShape } from './poll-api-sync-types';

import {
	syncPollConditionalQuestions,
	syncPollConditionalSections
} from './poll-api-sync-conditionals';

/** Sync (update) an existing MC question via the poll API. */
export async function syncPollMcQuestion(
	question: QuestionnaireQuestion,
	authHeader: AuthHeader,
	pollId: string,
	q: ApiQuestionnaireShape,
	sectionId?: string | null,
	dependsOnOptionId?: string | null
) {
	if (!question._apiId) return;

	await pollquestionUpdateMcQuestion({
		path: { poll_id: pollId, question_id: question._apiId },
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

	await syncPollMcOptions(question, authHeader, pollId, q);
}

/** Sync options for an existing MC question on a poll. */
export async function syncPollMcOptions(
	question: QuestionnaireQuestion,
	authHeader: AuthHeader,
	pollId: string,
	q: ApiQuestionnaireShape
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

	const questionOptions = question.options || [];
	for (let i = 0; i < questionOptions.length; i++) {
		const option = questionOptions[i];
		if (option._apiId) {
			localOptionApiIds.add(option._apiId);
			await pollquestionUpdateMcOption({
				path: { poll_id: pollId, option_id: option._apiId },
				body: { option: option.text, is_correct: option.isCorrect, order: i },
				headers: authHeader
			});
			optionsToSync.push({ option, apiId: option._apiId });
		} else if (option.text.trim()) {
			const response = await pollquestionCreateMcOption({
				path: { poll_id: pollId, question_id: question._apiId },
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
			await pollquestionDeleteMcOption({
				path: { poll_id: pollId, option_id: existingId },
				headers: authHeader
			});
		}
	}

	// Sync conditional questions and sections for each option
	for (const { option, apiId } of optionsToSync) {
		await syncPollConditionalQuestions(option, apiId, authHeader, pollId, q);
		await syncPollConditionalSections(option, apiId, authHeader, pollId, q);
	}
}

/** Sync (update) an existing FT question via the poll API. */
export async function syncPollFtQuestion(
	question: QuestionnaireQuestion,
	authHeader: AuthHeader,
	pollId: string,
	sectionId?: string | null,
	dependsOnOptionId?: string | null
) {
	if (!question._apiId) return;

	await pollquestionUpdateFtQuestion({
		path: { poll_id: pollId, question_id: question._apiId },
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

/** Sync (update) an existing FU question via the poll API. */
export async function syncPollFuQuestion(
	question: QuestionnaireQuestion,
	authHeader: AuthHeader,
	pollId: string,
	sectionId?: string | null,
	dependsOnOptionId?: string | null
) {
	if (!question._apiId) return;

	await pollquestionUpdateFuQuestion({
		path: { poll_id: pollId, question_id: question._apiId },
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

/** Create a new MC question on a poll via the API. */
export async function createPollMcQuestion(
	question: QuestionnaireQuestion,
	sectionId: string | null,
	authHeader: AuthHeader,
	pollId: string,
	dependsOnOptionId?: string | null
) {
	const apiFormat = mcQuestionToEditApiFormat(question);
	const response = await pollquestionCreateMcQuestion({
		path: { poll_id: pollId },
		body: {
			section_id: sectionId,
			depends_on_option_id: dependsOnOptionId || null,
			...apiFormat
		},
		headers: authHeader
	});
	return response.data;
}

/** Create a new FT question on a poll via the API. */
export async function createPollFtQuestion(
	question: QuestionnaireQuestion,
	sectionId: string | null,
	authHeader: AuthHeader,
	pollId: string,
	dependsOnOptionId?: string | null
) {
	const apiFormat = ftQuestionToEditApiFormat(question);
	const response = await pollquestionCreateFtQuestion({
		path: { poll_id: pollId },
		body: {
			section_id: sectionId,
			depends_on_option_id: dependsOnOptionId || null,
			...apiFormat
		},
		headers: authHeader
	});
	return response.data;
}

/** Create a new FU question on a poll via the API. */
export async function createPollFuQuestion(
	question: QuestionnaireQuestion,
	sectionId: string | null,
	authHeader: AuthHeader,
	pollId: string,
	dependsOnOptionId?: string | null
) {
	const apiFormat = fuQuestionToEditApiFormat(question);
	const response = await pollquestionCreateFuQuestion({
		path: { poll_id: pollId },
		body: {
			section_id: sectionId,
			depends_on_option_id: dependsOnOptionId || null,
			...apiFormat
		},
		headers: authHeader
	});
	return response.data;
}

/** Create all questions within a newly created poll section. */
export async function createPollSectionQuestions(
	section: QuestionnaireSection | QuestionnaireConditionalSection,
	sectionApiId: string,
	authHeader: AuthHeader,
	pollId: string
) {
	for (const question of section.questions) {
		if (question.type === 'multiple_choice') {
			await createPollMcQuestion(question, sectionApiId, authHeader, pollId);
		} else if (question.type === 'free_text') {
			await createPollFtQuestion(question, sectionApiId, authHeader, pollId);
		} else if (question.type === 'file_upload') {
			await createPollFuQuestion(question, sectionApiId, authHeader, pollId);
		}
	}
}

/** Sync questions within an existing poll section. */
export async function syncPollSectionQuestions(
	section: QuestionnaireSection,
	sectionApiId: string,
	authHeader: AuthHeader,
	pollId: string,
	q: ApiQuestionnaireShape
) {
	// Filter out conditional questions (managed separately)
	const apiSection = (q?.sections || []).find((s) => s.id === sectionApiId);
	const existingMcIds = new Set(
		(apiSection?.multiplechoicequestion_questions || [])
			.filter((apiQ) => !apiQ.depends_on_option_id)
			.map((apiQ) => apiQ.id)
			.filter(Boolean)
	);
	const existingFtIds = new Set(
		(apiSection?.freetextquestion_questions || [])
			.filter((apiQ) => !apiQ.depends_on_option_id)
			.map((apiQ) => apiQ.id)
			.filter(Boolean)
	);
	const existingFuIds = new Set(
		(apiSection?.fileuploadquestion_questions || [])
			.filter((apiQ) => !apiQ.depends_on_option_id)
			.map((apiQ) => apiQ.id)
			.filter(Boolean)
	);

	const localMcApiIds = new Set<string>();
	const localFtApiIds = new Set<string>();
	const localFuApiIds = new Set<string>();

	for (const question of section.questions) {
		if (question.type === 'multiple_choice') {
			if (question._apiId) {
				localMcApiIds.add(question._apiId);
				await syncPollMcQuestion(question, authHeader, pollId, q, sectionApiId);
			} else {
				await createPollMcQuestion(question, sectionApiId, authHeader, pollId);
			}
		} else if (question.type === 'free_text') {
			if (question._apiId) {
				localFtApiIds.add(question._apiId);
				await syncPollFtQuestion(question, authHeader, pollId, sectionApiId);
			} else {
				await createPollFtQuestion(question, sectionApiId, authHeader, pollId);
			}
		} else if (question.type === 'file_upload') {
			if (question._apiId) {
				localFuApiIds.add(question._apiId);
				await syncPollFuQuestion(question, authHeader, pollId, sectionApiId);
			} else {
				await createPollFuQuestion(question, sectionApiId, authHeader, pollId);
			}
		}
	}

	// Delete removed questions
	for (const existingId of existingMcIds) {
		if (!localMcApiIds.has(existingId)) {
			await pollquestionDeleteMcQuestion({
				path: { poll_id: pollId, question_id: existingId },
				headers: authHeader
			});
		}
	}
	for (const existingId of existingFtIds) {
		if (!localFtApiIds.has(existingId)) {
			await pollquestionDeleteFtQuestion({
				path: { poll_id: pollId, question_id: existingId },
				headers: authHeader
			});
		}
	}
	for (const existingId of existingFuIds) {
		if (!localFuApiIds.has(existingId)) {
			await pollquestionDeleteFuQuestion({
				path: { poll_id: pollId, question_id: existingId },
				headers: authHeader
			});
		}
	}
}
