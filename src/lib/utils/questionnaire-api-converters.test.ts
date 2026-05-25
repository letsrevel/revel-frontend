import { describe, it, expect } from 'vitest';
import { initializeFromApiData } from './questionnaire-api-converters';

// Regression guard for the "poll created without questions" bug.
//
// initializeFromApiData is shared by two callers that feed it differently
// named question collections:
//   - Questionnaire admin endpoints → QuestionnaireResponseSchema, using the
//     Django reverse-relation names (multiplechoicequestion_questions, etc.).
//   - Poll detail endpoint → QuestionnaireSchema, using underscored names
//     (multiple_choice_questions, etc.) — changed when the voter form's
//     flattenQuestionnaire needed the underscored shape.
//
// The converter only read the run-together names, so a freshly-created poll's
// DRAFT editor rendered "Questions (0)" even though the backend had saved the
// question. These tests assert both shapes hydrate identically.

const orgWrapper = {
	questionnaire_type: 'admission',
	members_exempt: false,
	per_event: false,
	requires_evaluation: false,
	max_submission_age: null
};

const mcQuestion = {
	id: 'q-mc-1',
	question: 'Pick one',
	hint: null,
	is_mandatory: true,
	order: 0,
	allow_multiple_answers: false,
	options: [
		{ id: 'opt-yes', option: 'Yes', order: 0 },
		{ id: 'opt-no', option: 'No', order: 1 }
	]
};

describe('initializeFromApiData — collection naming', () => {
	it('hydrates from QuestionnaireResponseSchema (run-together names)', () => {
		const q = {
			id: 'qn-1',
			name: 'Run-together poll',
			evaluation_mode: 'manual',
			sections: [],
			multiplechoicequestion_questions: [mcQuestion],
			freetextquestion_questions: [],
			fileuploadquestion_questions: []
		};

		const result = initializeFromApiData(orgWrapper, q);

		expect(result.topLevelQuestions).toHaveLength(1);
		expect(result.topLevelQuestions[0].text).toBe('Pick one');
		expect(result.topLevelQuestions[0].options).toHaveLength(2);
	});

	it('hydrates from QuestionnaireSchema (underscored names) — the poll-detail shape', () => {
		const q = {
			id: 'qn-2',
			name: 'Underscored poll',
			evaluation_mode: 'manual',
			sections: [],
			multiple_choice_questions: [mcQuestion],
			free_text_questions: [],
			file_upload_questions: []
		};

		const result = initializeFromApiData(orgWrapper, q);

		// This is the assertion that was failing before the fix: the DRAFT
		// editor saw zero questions because the converter only looked for the
		// run-together names.
		expect(result.topLevelQuestions).toHaveLength(1);
		expect(result.topLevelQuestions[0].text).toBe('Pick one');
		expect(result.topLevelQuestions[0].options.map((o) => o.text).sort()).toEqual(['No', 'Yes']);
	});

	it('hydrates underscored questions nested inside a section', () => {
		const q = {
			id: 'qn-3',
			name: 'Sectioned poll',
			evaluation_mode: 'manual',
			multiple_choice_questions: [],
			free_text_questions: [],
			file_upload_questions: [],
			sections: [
				{
					id: 'sec-1',
					name: 'Section A',
					order: 0,
					depends_on_option_id: null,
					multiple_choice_questions: [{ ...mcQuestion, id: 'q-mc-sec' }],
					free_text_questions: [],
					file_upload_questions: []
				}
			]
		};

		const result = initializeFromApiData(orgWrapper, q);

		expect(result.sections).toHaveLength(1);
		expect(result.sections[0].questions).toHaveLength(1);
		expect(result.sections[0].questions[0].text).toBe('Pick one');
	});

	it('does not mutate the input object', () => {
		const q = {
			id: 'qn-4',
			name: 'No-mutate poll',
			evaluation_mode: 'manual',
			sections: [],
			multiple_choice_questions: [mcQuestion],
			free_text_questions: [],
			file_upload_questions: []
		};

		initializeFromApiData(orgWrapper, q);

		// The converter normalizes a shallow copy; the reactive source must be
		// left untouched (no run-together keys grafted onto it).
		expect('multiplechoicequestion_questions' in q).toBe(false);
	});
});
