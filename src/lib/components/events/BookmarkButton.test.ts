import { render, screen, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import BookmarkButton from './BookmarkButton.svelte';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';

// Mock the generated SDK
vi.mock('$lib/api/generated/sdk.gen', () => ({
	eventpublicattendanceBookmarkEvent: vi.fn().mockResolvedValue({ data: {} }),
	eventpublicattendanceUnbookmarkEvent: vi.fn().mockResolvedValue({ data: undefined })
}));

// Mock the auth store (plain object; mutate `accessToken` before each render)
vi.mock('$lib/stores/auth.svelte', () => ({
	authStore: { accessToken: 'test-token' as string | null }
}));

// Mock toasts
vi.mock('svelte-sonner', () => ({
	toast: { error: vi.fn() }
}));

import {
	eventpublicattendanceBookmarkEvent,
	eventpublicattendanceUnbookmarkEvent
} from '$lib/api/generated/sdk.gen';
import { authStore } from '$lib/stores/auth.svelte';
import { toast } from 'svelte-sonner';

describe('BookmarkButton', () => {
	let queryClient: QueryClient;

	beforeEach(() => {
		queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
		});
		vi.clearAllMocks();
		(authStore as { accessToken: string | null }).accessToken = 'test-token';
	});

	function renderButton(props: {
		eventId: string;
		isBookmarked: boolean;
		variant?: 'float' | 'header';
	}) {
		return render(QueryClientTestWrapper, {
			props: { client: queryClient, component: BookmarkButton, props }
		});
	}

	it('renders nothing when unauthenticated', () => {
		(authStore as { accessToken: string | null }).accessToken = null;
		const { container } = renderButton({ eventId: 'e1', isBookmarked: false });
		expect(container.querySelector('button')).toBeNull();
	});

	it('reflects the initial bookmarked state via aria-pressed', () => {
		renderButton({ eventId: 'e1', isBookmarked: true });
		expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
	});

	it('optimistically bookmarks on click and calls the POST endpoint', async () => {
		const user = userEvent.setup();
		renderButton({ eventId: 'e1', isBookmarked: false });
		const btn = screen.getByRole('button');
		expect(btn).toHaveAttribute('aria-pressed', 'false');

		await user.click(btn);

		// Optimistic flip is synchronous; the API call fires on the next microtask.
		expect(btn).toHaveAttribute('aria-pressed', 'true');
		await waitFor(() =>
			expect(eventpublicattendanceBookmarkEvent).toHaveBeenCalledWith({ path: { event_id: 'e1' } })
		);
		// Guard against calling the opposite (DELETE) endpoint.
		expect(eventpublicattendanceUnbookmarkEvent).not.toHaveBeenCalled();
	});

	it('optimistically unbookmarks on click and calls the DELETE endpoint', async () => {
		const user = userEvent.setup();
		renderButton({ eventId: 'e1', isBookmarked: true });
		const btn = screen.getByRole('button');

		await user.click(btn);

		expect(btn).toHaveAttribute('aria-pressed', 'false');
		await waitFor(() =>
			expect(eventpublicattendanceUnbookmarkEvent).toHaveBeenCalledWith({
				path: { event_id: 'e1' }
			})
		);
		// Guard against calling the opposite (POST) endpoint.
		expect(eventpublicattendanceBookmarkEvent).not.toHaveBeenCalled();
	});

	it('reverts and shows an error toast when the mutation fails', async () => {
		const user = userEvent.setup();
		vi.mocked(eventpublicattendanceBookmarkEvent).mockRejectedValueOnce(new Error('boom'));
		renderButton({ eventId: 'e1', isBookmarked: false });
		const btn = screen.getByRole('button');

		await user.click(btn);

		await waitFor(() => expect(btn).toHaveAttribute('aria-pressed', 'false'));
		expect(toast.error).toHaveBeenCalled();
	});
});
