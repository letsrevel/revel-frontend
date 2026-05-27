import { render, screen, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import DuplicatePollModal from './DuplicatePollModal.svelte';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';

const getPollResult = {
	data: {
		id: 'p1',
		staff_anonymous: false,
		public_anonymous: false,
		result_visibility: 'private'
	}
};

vi.mock('$lib/api/generated/sdk.gen', () => ({
	pollGetPoll: vi.fn(() => Promise.resolve(getPollResult)),
	pollDuplicatePollAction: vi.fn().mockResolvedValue({ data: { id: 'new-poll-id' } })
}));
vi.mock('$lib/stores/auth.svelte', () => ({
	authStore: { accessToken: 'test-token' as string | null }
}));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

import { pollGetPoll, pollDuplicatePollAction } from '$lib/api/generated/sdk.gen';
import { goto } from '$app/navigation';

describe('DuplicatePollModal', () => {
	let queryClient: QueryClient;

	beforeEach(() => {
		queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
		});
		vi.clearAllMocks();
		getPollResult.data = {
			id: 'p1',
			staff_anonymous: false,
			public_anonymous: false,
			result_visibility: 'private'
		};
	});

	function renderModal() {
		const onClose = vi.fn();
		const result = render(QueryClientTestWrapper, {
			props: {
				client: queryClient,
				component: DuplicatePollModal,
				props: {
					open: true,
					pollId: 'p1',
					pollName: 'Weekly vote',
					organizationSlug: 'acme',
					onClose
				}
			}
		});
		return { ...result, onClose };
	}

	it('prefills the name and seeds anonymity from the fetched poll', async () => {
		renderModal();
		await waitFor(() => expect(pollGetPoll).toHaveBeenCalled());
		await waitFor(() =>
			expect(screen.getByRole('button', { name: /^duplicate$/i })).not.toBeDisabled()
		);
		const input = screen.getByLabelText(/new poll name/i) as HTMLInputElement;
		expect(input.value).toBe('Copy of Weekly vote');
		// Anonymity checkboxes reflect the fetched template values (both false here).
		expect((screen.getByLabelText(/from staff/i) as HTMLInputElement).checked).toBe(false);
		expect((screen.getByLabelText(/from voters/i) as HTMLInputElement).checked).toBe(false);
	});

	it('seeds non-trivial anonymity values from the fetched poll', async () => {
		getPollResult.data = {
			id: 'p1',
			staff_anonymous: true,
			public_anonymous: false,
			result_visibility: 'private'
		};
		renderModal();
		await waitFor(() => expect(pollGetPoll).toHaveBeenCalled());
		await waitFor(() =>
			expect((screen.getByLabelText(/from staff/i) as HTMLInputElement).checked).toBe(true)
		);
		// private visibility ⇒ public-anonymous is NOT forced, stays as the template's false
		const publicCheckbox = screen.getByLabelText(/from voters/i) as HTMLInputElement;
		expect(publicCheckbox.checked).toBe(false);
		expect(publicCheckbox.disabled).toBe(false);
	});

	it('sends the override values, navigates on success, and closes', async () => {
		const user = userEvent.setup();
		const { onClose } = renderModal();
		await waitFor(() => expect(pollGetPoll).toHaveBeenCalled());
		await waitFor(() =>
			expect(screen.getByRole('button', { name: /^duplicate$/i })).not.toBeDisabled()
		);

		await user.click(screen.getByRole('button', { name: /^duplicate$/i }));

		await waitFor(() =>
			expect(pollDuplicatePollAction).toHaveBeenCalledWith({
				path: { poll_id: 'p1' },
				body: { name: 'Copy of Weekly vote', staff_anonymous: false, public_anonymous: false },
				headers: { Authorization: 'Bearer test-token' }
			})
		);
		await waitFor(() => expect(goto).toHaveBeenCalledWith('/org/acme/admin/polls/new-poll-id'));
		await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
	});

	it('locks public anonymity on when result visibility is public', async () => {
		getPollResult.data = {
			id: 'p1',
			staff_anonymous: false,
			public_anonymous: true,
			result_visibility: 'public'
		};
		renderModal();
		await waitFor(() => expect(pollGetPoll).toHaveBeenCalled());

		const publicCheckbox = screen.getByLabelText(/from voters/i) as HTMLInputElement;
		await waitFor(() => expect(publicCheckbox.checked).toBe(true));
		expect(publicCheckbox.disabled).toBe(true);
	});

	it('blocks submit and shows an error when the name is empty', async () => {
		const user = userEvent.setup();
		renderModal();
		await waitFor(() => expect(pollGetPoll).toHaveBeenCalled());
		await waitFor(() =>
			expect(screen.getByRole('button', { name: /^duplicate$/i })).not.toBeDisabled()
		);
		await user.clear(screen.getByLabelText(/new poll name/i));
		await user.click(screen.getByRole('button', { name: /^duplicate$/i }));

		expect(pollDuplicatePollAction).not.toHaveBeenCalled();
		expect(screen.getByRole('alert')).toHaveTextContent(/required/i);
	});
});
