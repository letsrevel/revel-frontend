import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import QuestionnaireFormFields from './QuestionnaireFormFields.svelte';

/**
 * Covers the two numeric fields only — minimum score and max attempts. Both used
 * to commit `Number(e.currentTarget.value)` on every keystroke, and `Number('')`
 * is 0, so an emptied field refilled itself with a 0 under the caret (#924).
 */
describe('QuestionnaireFormFields — numeric fields', () => {
	let handlers: Record<string, ReturnType<typeof vi.fn>>;

	beforeEach(() => {
		handlers = {
			onMinScoreChange: vi.fn(),
			onMaxAttemptsChange: vi.fn()
		};
	});

	function renderFields(overrides: { minScore?: number; maxAttempts?: number } = {}) {
		return render(QuestionnaireFormFields, {
			props: {
				name: 'Test questionnaire',
				questionnaireType: 'admission',
				requiresEvaluation: true,
				effectiveRequiresEvaluation: true,
				minScore: overrides.minScore ?? 50,
				evaluationMode: 'manual',
				shuffleQuestions: false,
				shuffleSections: false,
				membersExempt: false,
				perEvent: false,
				llmGuidelines: '',
				maxSubmissionAge: null,
				canRetakeAfter: null,
				maxAttempts: overrides.maxAttempts ?? 3,
				canEdit: true,
				onNameChange: vi.fn(),
				onQuestionnaireTypeChange: vi.fn(),
				onRequiresEvaluationChange: vi.fn(),
				onMinScoreChange: handlers.onMinScoreChange,
				onEvaluationModeChange: vi.fn(),
				onShuffleQuestionsChange: vi.fn(),
				onShuffleSectionsChange: vi.fn(),
				onMembersExemptChange: vi.fn(),
				onPerEventChange: vi.fn(),
				onLlmGuidelinesChange: vi.fn(),
				onMaxSubmissionAgeChange: vi.fn(),
				onCanRetakeAfterChange: vi.fn(),
				onMaxAttemptsChange: handlers.onMaxAttemptsChange
			}
		});
	}

	function minScoreInput(): HTMLInputElement {
		return screen.getByLabelText(/minimum score/i) as HTMLInputElement;
	}

	function maxAttemptsInput(): HTMLInputElement {
		return screen.getByLabelText(/max(imum)? (number of )?attempts/i) as HTMLInputElement;
	}

	it('lets the minimum score be cleared without refilling it with 0', async () => {
		renderFields({ minScore: 50 });
		const input = minScoreInput();
		expect(input.value).toBe('50');

		await fireEvent.input(input, { target: { value: '' } });

		expect(input.value).toBe('');
		expect(handlers.onMinScoreChange).not.toHaveBeenCalled();
	});

	it('commits a minimum score retyped after clearing, including 0', async () => {
		renderFields({ minScore: 50 });
		const input = minScoreInput();

		await fireEvent.input(input, { target: { value: '' } });
		await fireEvent.input(input, { target: { value: '7' } });
		expect(handlers.onMinScoreChange).toHaveBeenLastCalledWith(7);

		// 0 is a legal minimum score ("no minimum"), unlike the max-tickets field
		// this guard generalizes — the bounds decide, not the helper.
		await fireEvent.input(input, { target: { value: '0' } });
		expect(handlers.onMinScoreChange).toHaveBeenLastCalledWith(0);
	});

	it('clamps the minimum score to 0..100 on blur', async () => {
		renderFields({ minScore: 50 });
		const input = minScoreInput();

		await fireEvent.input(input, { target: { value: '150' } });
		expect(handlers.onMinScoreChange).not.toHaveBeenCalled();

		await fireEvent.blur(input);
		expect(handlers.onMinScoreChange).toHaveBeenLastCalledWith(100);
	});

	it('restores the previous minimum score when an emptied field is blurred', async () => {
		renderFields({ minScore: 50 });
		const input = minScoreInput();

		await fireEvent.input(input, { target: { value: '' } });
		await fireEvent.blur(input);

		expect(input.value).toBe('50');
		expect(handlers.onMinScoreChange).toHaveBeenLastCalledWith(50);
	});

	it('lets max attempts be cleared and retyped', async () => {
		renderFields({ maxAttempts: 3 });
		const input = maxAttemptsInput();

		await fireEvent.input(input, { target: { value: '' } });
		expect(input.value).toBe('');
		expect(handlers.onMaxAttemptsChange).not.toHaveBeenCalled();

		await fireEvent.input(input, { target: { value: '10' } });
		expect(handlers.onMaxAttemptsChange).toHaveBeenLastCalledWith(10);
	});

	it('settles max attempts on blur without accepting a negative', async () => {
		renderFields({ maxAttempts: 3 });
		const input = maxAttemptsInput();

		await fireEvent.input(input, { target: { value: '-2' } });
		expect(handlers.onMaxAttemptsChange).not.toHaveBeenCalled();

		await fireEvent.blur(input);
		expect(handlers.onMaxAttemptsChange).toHaveBeenLastCalledWith(0);
	});
});
