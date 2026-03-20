/**
 * API sync helpers for the questionnaire edit page.
 *
 * These functions handle incremental sync: diffing local state vs API state
 * and making targeted create/update/delete API calls.
 */

import {
	questionnaireUpdateOrgQuestionnaire,
	questionnaireCreateSection,
	questionnaireUpdateSection,
	questionnaireDeleteSection,
	questionnaireCreateMcQuestion,
	questionnaireUpdateMcQuestion,
	questionnaireDeleteMcQuestion,
	questionnaireCreateMcOption,
	questionnaireUpdateMcOption,
	questionnaireDeleteMcOption,
	questionnaireCreateFtQuestion,
	questionnaireUpdateFtQuestion,
	questionnaireDeleteFtQuestion,
	questionnaireCreateFuQuestion,
	questionnaireUpdateFuQuestion,
	questionnaireDeleteFuQuestion
} from '$lib/api/generated/sdk.gen';
import type { QuestionnaireEvaluationMode, QuestionnaireType } from '$lib/api/generated/types.gen';

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

// ===== Sync Helpers =====

type AuthHeader = { Authorization: string };

/** Sync (update) an existing MC question via the API. */
export async function syncMcQuestion(
	question: QuestionnaireQuestion,
	authHeader: AuthHeader,
	orgQuestionnaireId: string,
	q: any,
	dependsOnOptionId?: string | null
) {
	if (!question._apiId) return;

	await questionnaireUpdateMcQuestion({
		path: { org_questionnaire_id: orgQuestionnaireId, question_id: question._apiId },
		body: {
			question: question.text,
			hint: question.hint || null,
			is_mandatory: question.required,
			positive_weight: String(question.positiveWeight),
			negative_weight: String(question.negativeWeight),
			is_fatal: question.isFatal,
			allow_multiple_answers: question.allowMultipleAnswers || false,
			shuffle_options: question.shuffleOptions ?? true,
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
	dependsOnOptionId?: string | null
) {
	if (!question._apiId) return;

	await questionnaireUpdateFtQuestion({
		path: { org_questionnaire_id: orgQuestionnaireId, question_id: question._apiId },
		body: {
			question: question.text,
			hint: question.hint || null,
			is_mandatory: question.required,
			positive_weight: String(question.positiveWeight),
			negative_weight: String(question.negativeWeight),
			is_fatal: question.isFatal,
			llm_guidelines: question.llmGuidelines || null,
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
	dependsOnOptionId?: string | null
) {
	if (!question._apiId) return;

	await questionnaireUpdateFuQuestion({
		path: { org_questionnaire_id: orgQuestionnaireId, question_id: question._apiId },
		body: {
			question: question.text,
			hint: question.hint || null,
			is_mandatory: question.required,
			positive_weight: String(question.positiveWeight),
			negative_weight: String(question.negativeWeight),
			is_fatal: question.isFatal,
			allowed_mime_types: question.allowedMimeTypes || ['*/*'],
			max_file_size: question.maxFileSize || 10 * 1024 * 1024,
			max_files: question.maxFiles || 1,
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
	section: QuestionnaireSection,
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
				await syncMcQuestion(question, authHeader, orgQuestionnaireId, q);
			} else {
				await createMcQuestion(question, sectionApiId, authHeader, orgQuestionnaireId);
			}
		} else if (question.type === 'free_text') {
			if (question._apiId) {
				localFtApiIds.add(question._apiId);
				await syncFtQuestion(question, authHeader, orgQuestionnaireId);
			} else {
				await createFtQuestion(question, sectionApiId, authHeader, orgQuestionnaireId);
			}
		} else if (question.type === 'file_upload') {
			if (question._apiId) {
				localFuApiIds.add(question._apiId);
				await syncFuQuestion(question, authHeader, orgQuestionnaireId);
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

/** Sync conditional questions attached to a specific option. */
export async function syncConditionalQuestions(
	option: QuestionnaireOption,
	optionApiId: string,
	authHeader: AuthHeader,
	orgQuestionnaireId: string,
	q: any
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
				await syncMcQuestion(condQ, authHeader, orgQuestionnaireId, q, optionApiId);
			} else {
				await createMcQuestion(condQ, null, authHeader, orgQuestionnaireId, optionApiId);
			}
		} else {
			if (condQ._apiId) {
				localConditionalFtIds.add(condQ._apiId);
				await syncFtQuestion(condQ, authHeader, orgQuestionnaireId, optionApiId);
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
				await createSectionQuestions(
					condSection as any,
					sectionData.id,
					authHeader,
					orgQuestionnaireId
				);
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
	q: any
) {
	const apiSection = (q?.sections || []).find((s: any) => s.id === sectionApiId);
	const existingMcIds = new Set<string>(
		(apiSection?.multiplechoicequestion_questions || []).map((apiQ: any) => apiQ.id).filter(Boolean)
	);
	const existingFtIds = new Set<string>(
		(apiSection?.freetextquestion_questions || []).map((apiQ: any) => apiQ.id).filter(Boolean)
	);

	const localMcIds = new Set<string>();
	const localFtIds = new Set<string>();

	for (const question of section.questions) {
		if (question.type === 'multiple_choice') {
			if (question._apiId) {
				localMcIds.add(question._apiId);
				await syncMcQuestion(question, authHeader, orgQuestionnaireId, q);
			} else {
				await createMcQuestion(question, sectionApiId, authHeader, orgQuestionnaireId);
			}
		} else {
			if (question._apiId) {
				localFtIds.add(question._apiId);
				await syncFtQuestion(question, authHeader, orgQuestionnaireId);
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

/**
 * Perform the full incremental save of a questionnaire (edit page).
 *
 * Updates metadata, syncs sections and top-level questions, deletes removed items.
 */
export async function saveQuestionnaireIncremental(params: {
	orgQuestionnaireId: string;
	authHeader: AuthHeader;
	q: any;
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
		throw new Error('Failed to update questionnaire metadata');
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
					depends_on_option_id: (section as any)._dependsOnOptionId ?? null
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
