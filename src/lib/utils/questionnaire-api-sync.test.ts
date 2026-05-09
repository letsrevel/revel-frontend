import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockUpdateMc = vi.fn();
const mockUpdateFt = vi.fn();
const mockUpdateFu = vi.fn();
const mockCreateMc = vi.fn();
const mockCreateFt = vi.fn();
const mockCreateFu = vi.fn();
const mockUpdateOption = vi.fn();

vi.mock('$lib/api/generated/sdk.gen', () => ({
	questionnaireUpdateOrgQuestionnaire: vi.fn(),
	questionnaireCreateSection: vi.fn(),
	questionnaireUpdateSection: vi.fn(),
	questionnaireDeleteSection: vi.fn(),
	questionnaireCreateMcQuestion: (...args: unknown[]) => mockCreateMc(...args),
	questionnaireUpdateMcQuestion: (...args: unknown[]) => mockUpdateMc(...args),
	questionnaireDeleteMcQuestion: vi.fn(),
	questionnaireCreateMcOption: vi.fn(),
	questionnaireUpdateMcOption: (...args: unknown[]) => mockUpdateOption(...args),
	questionnaireDeleteMcOption: vi.fn(),
	questionnaireCreateFtQuestion: (...args: unknown[]) => mockCreateFt(...args),
	questionnaireUpdateFtQuestion: (...args: unknown[]) => mockUpdateFt(...args),
	questionnaireDeleteFtQuestion: vi.fn(),
	questionnaireCreateFuQuestion: (...args: unknown[]) => mockCreateFu(...args),
	questionnaireUpdateFuQuestion: (...args: unknown[]) => mockUpdateFu(...args),
	questionnaireDeleteFuQuestion: vi.fn()
}));

import { syncConditionalQuestions } from './questionnaire-api-sync';
import type { QuestionnaireOption, QuestionnaireQuestion } from './questionnaire-form-types';

const AUTH = { Authorization: 'Bearer test' };
const ORG_QID = 'org-qid';
const OPTION_API_ID = 'option-uuid';

function makeMcSubQuestion(apiId: string | undefined): QuestionnaireQuestion {
	return {
		id: 'local-mc-id',
		_apiId: apiId,
		type: 'multiple_choice',
		text: 'Sub MC',
		required: true,
		order: 0,
		positiveWeight: 1,
		negativeWeight: 0,
		isFatal: false,
		options: [],
		allowMultipleAnswers: false,
		shuffleOptions: true
	};
}

function makeFtSubQuestion(apiId: string | undefined): QuestionnaireQuestion {
	return {
		id: 'local-ft-id',
		_apiId: apiId,
		type: 'free_text',
		text: 'Sub FT',
		required: true,
		order: 0,
		positiveWeight: 1,
		negativeWeight: 0,
		isFatal: false
	};
}

function makeOption(conditionals: QuestionnaireQuestion[]): QuestionnaireOption {
	return {
		text: 'Option A',
		isCorrect: false,
		_apiId: OPTION_API_ID,
		conditionalQuestions: conditionals,
		conditionalSections: []
	};
}

describe('syncConditionalQuestions — depends_on_option_id wiring (regression guard for #351)', () => {
	beforeEach(() => {
		mockUpdateMc.mockReset().mockResolvedValue({ data: undefined });
		mockUpdateFt.mockReset().mockResolvedValue({ data: undefined });
		mockUpdateFu.mockReset().mockResolvedValue({ data: undefined });
		mockCreateMc.mockReset().mockResolvedValue({ data: { id: 'new-id' } });
		mockCreateFt.mockReset().mockResolvedValue({ data: { id: 'new-id' } });
		mockCreateFu.mockReset().mockResolvedValue({ data: { id: 'new-id' } });
		mockUpdateOption.mockReset().mockResolvedValue({ data: undefined });
	});

	it('UPDATE branch — existing MC sub-question PUTs section_id=null, depends_on_option_id=optionApiId', async () => {
		const condQ = makeMcSubQuestion('existing-mc-api-id');
		const option = makeOption([condQ]);

		await syncConditionalQuestions(option, OPTION_API_ID, AUTH, ORG_QID, {});

		expect(mockUpdateMc).toHaveBeenCalledTimes(1);
		const body = mockUpdateMc.mock.calls[0][0].body;
		expect(body.section_id).toBeNull();
		expect(body.depends_on_option_id).toBe(OPTION_API_ID);
	});

	it('UPDATE branch — existing FT sub-question PUTs section_id=null, depends_on_option_id=optionApiId', async () => {
		const condQ = makeFtSubQuestion('existing-ft-api-id');
		const option = makeOption([condQ]);

		await syncConditionalQuestions(option, OPTION_API_ID, AUTH, ORG_QID, {});

		expect(mockUpdateFt).toHaveBeenCalledTimes(1);
		const body = mockUpdateFt.mock.calls[0][0].body;
		expect(body.section_id).toBeNull();
		expect(body.depends_on_option_id).toBe(OPTION_API_ID);
	});

	it('CREATE branch — new MC sub-question POSTs section_id=null, depends_on_option_id=optionApiId', async () => {
		const condQ = makeMcSubQuestion(undefined);
		const option = makeOption([condQ]);

		await syncConditionalQuestions(option, OPTION_API_ID, AUTH, ORG_QID, {});

		expect(mockCreateMc).toHaveBeenCalledTimes(1);
		const body = mockCreateMc.mock.calls[0][0].body;
		expect(body.section_id).toBeNull();
		expect(body.depends_on_option_id).toBe(OPTION_API_ID);
	});

	it('CREATE branch — new FT sub-question POSTs section_id=null, depends_on_option_id=optionApiId', async () => {
		const condQ = makeFtSubQuestion(undefined);
		const option = makeOption([condQ]);

		await syncConditionalQuestions(option, OPTION_API_ID, AUTH, ORG_QID, {});

		expect(mockCreateFt).toHaveBeenCalledTimes(1);
		const body = mockCreateFt.mock.calls[0][0].body;
		expect(body.section_id).toBeNull();
		expect(body.depends_on_option_id).toBe(OPTION_API_ID);
	});
});
