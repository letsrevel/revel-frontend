import { render, screen, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import DuplicateQuestionnaireModal from './DuplicateQuestionnaireModal.svelte';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';

vi.mock('$lib/api/generated/sdk.gen', () => ({
	questionnaireDuplicateOrgQuestionnaire: vi.fn().mockResolvedValue({ data: { id: 'new-q-id' } })
}));
vi.mock('$lib/stores/auth.svelte', () => ({
	authStore: { accessToken: 'test-token' as string | null }
}));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

import { questionnaireDuplicateOrgQuestionnaire } from '$lib/api/generated/sdk.gen';
import { authStore } from '$lib/stores/auth.svelte';
import { goto } from '$app/navigation';

const mockAuthStore = authStore as { accessToken: string | null };

describe('DuplicateQuestionnaireModal', () => {
	let queryClient: QueryClient;

	beforeEach(() => {
		queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
		});
		vi.clearAllMocks();
		mockAuthStore.accessToken = 'test-token';
	});

	function renderModal() {
		const onClose = vi.fn();
		const result = render(QueryClientTestWrapper, {
			props: {
				client: queryClient,
				component: DuplicateQuestionnaireModal,
				props: {
					open: true,
					orgQuestionnaireId: 'q1',
					questionnaireName: 'Admission',
					organizationSlug: 'acme',
					onClose
				}
			}
		});
		return { ...result, onClose };
	}

	it('prefills the name with "Copy of {name}"', () => {
		renderModal();
		const input = screen.getByLabelText(/new questionnaire name/i) as HTMLInputElement;
		expect(input.value).toBe('Copy of Admission');
	});

	it('submits name + copy_associations, navigates to the new draft, and closes', async () => {
		const user = userEvent.setup();
		const { onClose } = renderModal();
		await user.click(screen.getByLabelText(/copy event & series links/i));
		await user.click(screen.getByRole('button', { name: /^duplicate$/i }));

		await waitFor(() =>
			expect(questionnaireDuplicateOrgQuestionnaire).toHaveBeenCalledWith({
				path: { org_questionnaire_id: 'q1' },
				body: { name: 'Copy of Admission', copy_associations: true },
				headers: { Authorization: 'Bearer test-token' }
			})
		);
		await waitFor(() =>
			expect(goto).toHaveBeenCalledWith('/org/acme/admin/questionnaires/new-q-id')
		);
		await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
	});

	it('blocks submit and shows an error when the name is empty', async () => {
		const user = userEvent.setup();
		renderModal();
		await user.clear(screen.getByLabelText(/new questionnaire name/i));
		await user.click(screen.getByRole('button', { name: /^duplicate$/i }));

		expect(questionnaireDuplicateOrgQuestionnaire).not.toHaveBeenCalled();
		expect(screen.getByRole('alert')).toHaveTextContent(/required/i);
	});
});
