import { render, screen, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import Page from './+page.svelte';
import type { QuestionnaireSchema } from '$lib/api/generated/types.gen';

const submitMock = vi.hoisted(() => vi.fn());
vi.mock('$lib/api', () => ({
	memembershipquestionnaireSubmitMembershipQuestionnaire: submitMock
}));

const toastInfo = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
vi.mock('svelte-sonner', () => ({
	toast: { info: toastInfo, success: toastSuccess, error: toastError }
}));

const gotoMock = vi.hoisted(() => vi.fn());
vi.mock('$app/navigation', () => ({ goto: gotoMock }));

vi.mock('$lib/stores/auth.svelte', () => ({ authStore: { accessToken: 'tok' } }));

/** No questions: every "required" answer is vacuously given, so Submit is live. */
const QUESTIONNAIRE: QuestionnaireSchema = {
	id: 'q-1',
	name: 'Membership questionnaire',
	description: null,
	multiple_choice_questions: [],
	free_text_questions: [],
	file_upload_questions: []
};

const DATA = {
	organization: { id: 'org-1', name: 'Acme', slug: 'acme' },
	questionnaire: QUESTIONNAIRE
};

describe('Membership questionnaire fill page', () => {
	let queryClient: QueryClient;

	function renderPage() {
		return render(QueryClientTestWrapper, {
			props: {
				client: queryClient,
				component: Page,
				// The page only reads `data`; `$types` PageData is structural here.
				componentProps: { data: DATA } as unknown as Record<string, unknown>
			}
		});
	}

	async function submit() {
		const user = userEvent.setup();
		await user.click(screen.getByRole('button', { name: 'Submit Questionnaire' }));
	}

	beforeEach(() => {
		submitMock.mockReset();
		toastInfo.mockReset();
		toastSuccess.mockReset();
		toastError.mockReset();
		gotoMock.mockReset();
		queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
		});
	});

	/**
	 * The submit endpoint answers with the SUBMISSION shape on every path (the
	 * grader is queued on commit), so `requires_evaluation` is the whole signal —
	 * see the `isAutoAccepted` comment on the page.
	 */
	function submissionResponse(requiresEvaluation: boolean) {
		return {
			data: {
				id: 'sub-1',
				questionnaire_id: 'q-1',
				status: 'ready',
				submitted_at: '2026-07-27T10:00:00Z',
				requires_evaluation: requiresEvaluation
			},
			error: undefined
		};
	}

	describe('post-submit copy (#697)', () => {
		it('tells a gate-clearing submission it passed, and does not redirect', async () => {
			// `requires_evaluation: false` is the backend's documented "grants access
			// without any evaluation" flag — nobody will review this, so the generic
			// pending toast would be false.
			submitMock.mockResolvedValue(submissionResponse(false));
			renderPage();
			await submit();

			await waitFor(() => expect(toastSuccess).toHaveBeenCalledTimes(1));
			expect(toastSuccess).toHaveBeenCalledWith('Questionnaire passed — you can continue joining.');
			expect(toastInfo).not.toHaveBeenCalled();
			// The inline panel takes over instead of a bounce back to the org page.
			expect(await screen.findByText('Questionnaire approved')).toBeInTheDocument();
			expect(gotoMock).not.toHaveBeenCalled();
		});

		it('never promises membership on the gate-clear path', async () => {
			// Clearing the questionnaire gate only turns the org CTA back into a
			// plain "Join" — the application is still owed. Neither the toast nor the
			// panel may claim the user is in.
			submitMock.mockResolvedValue(submissionResponse(false));
			renderPage();
			await submit();

			await waitFor(() => expect(toastSuccess).toHaveBeenCalledTimes(1));
			const toastCopy = toastSuccess.mock.calls[0][0] as string;
			expect(toastCopy).not.toMatch(/member/i);
			expect(toastCopy).not.toMatch(/welcome/i);
			expect(screen.getByText(/you can continue joining acme now/i)).toBeInTheDocument();
		});

		it('keeps the pending copy when an evaluation really is owed', async () => {
			// The grader runs asynchronously, so at response time the outcome is
			// genuinely unknown, and the redirect stands. The copy must fit BOTH
			// owners of this path — an LLM auto-grader and a human reviewer — so it
			// says "evaluated" rather than "the organization will review it", which
			// is literally false for the AUTOMATIC mode that dominates here.
			submitMock.mockResolvedValue(submissionResponse(true));
			renderPage();
			await submit();

			await waitFor(() => expect(toastInfo).toHaveBeenCalledTimes(1));
			const pendingCopy = toastInfo.mock.calls[0][0] as string;
			expect(pendingCopy).toBe(
				"Questionnaire submitted — we'll let you know once it's been evaluated."
			);
			// Neutral on WHO evaluates: an LLM pass is not an organization review.
			expect(pendingCopy).not.toMatch(/organization will review/i);
			expect(toastSuccess).not.toHaveBeenCalled();
			await waitFor(() => expect(gotoMock).toHaveBeenCalledTimes(1));
			expect(screen.queryByText('Questionnaire approved')).toBeNull();
		});

		it('reads an inline approved evaluation as a gate clear', async () => {
			// Defensive branch: the response model admits the evaluation shape even
			// though this endpoint never returns it today.
			submitMock.mockResolvedValue({
				data: {
					submission: {
						id: 'sub-1',
						questionnaire_id: 'q-1',
						status: 'ready',
						submitted_at: '2026-07-27T10:00:00Z',
						requires_evaluation: true
					},
					score: '10.00',
					status: 'approved'
				},
				error: undefined
			});
			renderPage();
			await submit();

			await waitFor(() => expect(toastSuccess).toHaveBeenCalledTimes(1));
			expect(toastInfo).not.toHaveBeenCalled();
			expect(gotoMock).not.toHaveBeenCalled();
		});

		it('leaves a rejected inline evaluation on the review copy', async () => {
			submitMock.mockResolvedValue({
				data: {
					submission: {
						id: 'sub-1',
						questionnaire_id: 'q-1',
						status: 'ready',
						submitted_at: '2026-07-27T10:00:00Z',
						requires_evaluation: true
					},
					score: '1.00',
					status: 'rejected'
				},
				error: undefined
			});
			renderPage();
			await submit();

			await waitFor(() => expect(toastInfo).toHaveBeenCalledTimes(1));
			expect(toastSuccess).not.toHaveBeenCalled();
		});
	});
});
