/**
 * API sync helpers for the poll DRAFT question edit page.
 *
 * Mirrors `questionnaire-api-sync.ts` but calls the `pollquestion*` SDK
 * functions with `poll_id` path params instead of `org_questionnaire_id`.
 *
 * Only the incremental question sync is handled here; poll metadata (name,
 * description, visibility, etc.) is saved via `pollPatchPoll` separately.
 */

import {
	pollquestionCreateSection,
	pollquestionUpdateSection,
	pollquestionDeleteSection,
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
	fuQuestionToEditApiFormat,
	normalizeQuestionCollections
} from './questionnaire-api-converters';

// ===== Internal Types =====

type AuthHeader = { Authorization: string };

// ===== Sync Helpers =====

/** Sync (update) an existing MC question via the poll API. */
export async function syncPollMcQuestion(
	question: QuestionnaireQuestion,
	authHeader: AuthHeader,
	pollId: string,
	q: any,
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
	q: any
) {
	if (!question._apiId) return;

	// Find existing options from API
	let existingOptions: any[] = [];
	const topQuestion = (q?.multiplechoicequestion_questions || []).find(
		(apiQ: any) => apiQ.id === question._apiId
	);
	if (topQuestion) {
		existingOptions = topQuestion.options || [];
	} else {
		for (const section of q?.sections || []) {
			const sectionQuestion = (section.multiplechoicequestion_questions || []).find(
				(apiQ: any) => apiQ.id === question._apiId
			);
			if (sectionQuestion) {
				existingOptions = sectionQuestion.options || [];
				break;
			}
		}
	}

	const existingOptionIds = new Set(existingOptions.map((o: any) => o.id).filter(Boolean));
	const localOptionApiIds = new Set<string>();
	const optionsToSync: { option: QuestionnaireOption; apiId: string }[] = [];

	for (let i = 0; i < (question.options || []).length; i++) {
		const option = question.options![i];
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
	section: QuestionnaireSection,
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
	q: any
) {
	// Filter out conditional questions (managed separately)
	const apiSection = (q?.sections || []).find((s: any) => s.id === sectionApiId);
	const existingMcIds = new Set(
		(apiSection?.multiplechoicequestion_questions || [])
			.filter((apiQ: any) => !apiQ.depends_on_option_id)
			.map((apiQ: any) => apiQ.id)
			.filter(Boolean) as string[]
	);
	const existingFtIds = new Set(
		(apiSection?.freetextquestion_questions || [])
			.filter((apiQ: any) => !apiQ.depends_on_option_id)
			.map((apiQ: any) => apiQ.id)
			.filter(Boolean) as string[]
	);
	const existingFuIds = new Set(
		(apiSection?.fileuploadquestion_questions || [])
			.filter((apiQ: any) => !apiQ.depends_on_option_id)
			.map((apiQ: any) => apiQ.id)
			.filter(Boolean) as string[]
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

/** Sync conditional questions attached to a specific poll option. */
export async function syncPollConditionalQuestions(
	option: QuestionnaireOption,
	optionApiId: string,
	authHeader: AuthHeader,
	pollId: string,
	q: any
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
	q: any
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
		if ((condSection as any)._apiId) {
			const apiId = (condSection as any)._apiId;
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
				await createPollSectionQuestions(condSection as any, sectionData.id, authHeader, pollId);
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
	q: any
) {
	const apiSection = (q?.sections || []).find((s: any) => s.id === sectionApiId);
	const existingMcIds = new Set<string>(
		(apiSection?.multiplechoicequestion_questions || []).map((apiQ: any) => apiQ.id).filter(Boolean)
	);
	const existingFtIds = new Set<string>(
		(apiSection?.freetextquestion_questions || []).map((apiQ: any) => apiQ.id).filter(Boolean)
	);
	const existingFuIds = new Set<string>(
		(apiSection?.fileuploadquestion_questions || []).map((apiQ: any) => apiQ.id).filter(Boolean)
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
	q: any;
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
	// coalesces both shapes; we apply it top-level and per-section.
	const q = normalizeQuestionCollections(rawQ);
	q.sections = (rawQ?.sections || []).map((s: Record<string, unknown>) =>
		normalizeQuestionCollections(s)
	);

	const authHeader: AuthHeader = { Authorization: `Bearer ${accessToken}` };

	// Track existing NON-CONDITIONAL items for deletion
	const existingSectionIds = new Set(
		(q?.sections || [])
			.filter((s: any) => !s.depends_on_option_id)
			.map((s: any) => s.id)
			.filter(Boolean) as string[]
	);
	const existingTopMcIds = new Set(
		(q?.multiplechoicequestion_questions || [])
			.filter((apiQ: any) => !apiQ.depends_on_option_id)
			.map((apiQ: any) => apiQ.id)
			.filter(Boolean) as string[]
	);
	const existingTopFtIds = new Set(
		(q?.freetextquestion_questions || [])
			.filter((apiQ: any) => !apiQ.depends_on_option_id)
			.map((apiQ: any) => apiQ.id)
			.filter(Boolean) as string[]
	);
	const existingTopFuIds = new Set(
		(q?.fileuploadquestion_questions || [])
			.filter((apiQ: any) => !apiQ.depends_on_option_id)
			.map((apiQ: any) => apiQ.id)
			.filter(Boolean) as string[]
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
					depends_on_option_id: (section as any)._dependsOnOptionId ?? null
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
