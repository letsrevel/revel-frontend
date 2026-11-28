import { render, screen, fireEvent, waitFor, within } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import { questionnaireUpdateQuestionnaireStatus } from '$lib/api/generated/sdk.gen';
import Page from './+page.svelte';

vi.mock('$app/navigation', () => ({ invalidateAll: vi.fn(async () => undefined), goto: vi.fn() }));
vi.mock('$lib/api/generated/sdk.gen', () => ({
	questionnaireUpdateQuestionnaireStatus: vi.fn()
}));
vi.mock('$lib/queries/org-questionnaires', () => ({
	invalidateOrgQuestionnaires: vi.fn(async () => undefined)
}));
vi.mock('$lib/stores/auth.svelte', () => ({ authStore: { accessToken: 'tok' } }));
vi.mock('$lib/utils/questionnaire-api-sync', () => ({
	initializeFromApiData: () => ({
		name: 'Q',
		questionnaireType: 'admission',
		minScore: 0,
		evaluationMode: 'automatic',
		shuffleQuestions: false,
		shuffleSections: false,
		llmGuidelines: '',
		canRetakeAfter: null,
		maxAttempts: 0,
		membersExempt: false,
		perEvent: false,
		requiresEvaluation: true,
		maxSubmissionAge: null,
		topLevelQuestions: [],
		sections: []
	}),
	saveQuestionnaireIncremental: vi.fn()
}));
vi.mock('$lib/components/questionnaires/QuestionnaireAssignmentModal.svelte', async () => ({
	default: (await import('$lib/test-utils/StubComponent.svelte')).default
}));
vi.mock('$lib/components/questionnaires/DuplicateQuestionnaireModal.svelte', async () => ({
	default: (await import('$lib/test-utils/StubComponent.svelte')).default
}));
vi.mock('$lib/components/questionnaires/QuestionnaireFormFields.svelte', async () => ({
	default: (await import('$lib/test-utils/StubComponent.svelte')).default
}));
vi.mock('$lib/components/questionnaires/QuestionnaireEditAssignments.svelte', async () => ({
	default: (await import('$lib/test-utils/StubComponent.svelte')).default
}));
vi.mock('$lib/components/questionnaires/QuestionnaireEditQuestionsCard.svelte', async () => ({
	default: (await import('$lib/test-utils/StubComponent.svelte')).default
}));

const future = new Date(Date.now() + 30 * 86_400_000).toISOString();

function questionnaire(over: Record<string, unknown>, status = 'draft') {
	return {
		id: 'oq-1',
		questionnaire_type: 'admission',
		events: [],
		event_series: [],
		tiers: [],
		is_organization_default: false,
		questionnaire: { name: 'Q', status },
		...over
	};
}

function setup(q: ReturnType<typeof questionnaire>) {
	return render(QueryClientTestWrapper, {
		props: {
			client: new QueryClient(),
			component: Page,
			componentProps: {
				data: {
					questionnaire: q,
					organizationSlug: 'acme',
					organization: { id: 'o1', name: 'Acme' }
				}
			}
		}
	});
}

describe('questionnaire page admin warnings', () => {
	beforeEach(() => vi.clearAllMocks());

	it('F1 warns for an admission questionnaire linked to an upcoming event in draft', async () => {
		setup(questionnaire({ events: [{ id: 'e1', start: future }] }));
		const list = await screen.findByTestId('questionnaire-warnings');
		const f1 = list.querySelector('[data-warning-id="F1"]');
		expect(f1).not.toBeNull();
		// Warn: never dismissible.
		expect(within(list).queryByRole('button', { name: /^Dismiss:/ })).toBeNull();
		expect(within(list).getByRole('button', { name: 'Publish' })).toBeInTheDocument();
	});

	it('F2 shows an Info hint for a membership default in draft', async () => {
		setup(questionnaire({ questionnaire_type: 'membership', is_organization_default: true }));
		const list = await screen.findByTestId('questionnaire-warnings');
		const f2 = list.querySelector('[data-warning-id="F2"]');
		expect(f2).not.toBeNull();
		// Info: dismissible for a saved questionnaire.
		expect(within(list).getByRole('button', { name: /^Dismiss:/ })).toBeInTheDocument();
	});

	it('shows no warning once the questionnaire is published', async () => {
		setup(questionnaire({ events: [{ id: 'e1', start: future }] }, 'published'));
		const list = await screen.findByTestId('questionnaire-warnings');
		expect(list.querySelector('[data-warning-id]')).toBeNull();
	});

	it('Publish asks for confirmation, applies the status, then focuses the status bar when focus was lost', async () => {
		vi.mocked(questionnaireUpdateQuestionnaireStatus).mockResolvedValue({} as never);
		setup(questionnaire({ events: [{ id: 'e1', start: future }] }));
		const list = await screen.findByTestId('questionnaire-warnings');
		await fireEvent.click(within(list).getByRole('button', { name: 'Publish' }));
		expect(questionnaireUpdateQuestionnaireStatus).not.toHaveBeenCalled();
		await fireEvent.click(await screen.findByTestId('confirm-dialog-confirm'));
		await waitFor(() =>
			expect(questionnaireUpdateQuestionnaireStatus).toHaveBeenCalledWith(
				expect.objectContaining({
					path: { org_questionnaire_id: 'oq-1', status: 'published' }
				})
			)
		);
		await waitFor(() => expect(document.getElementById('questionnaire-status-bar')).toHaveFocus());
	});
});
