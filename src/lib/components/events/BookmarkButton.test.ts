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

// Mock SvelteKit navigation (invalidateAll runs on successful toggle)
vi.mock('$app/navigation', () => ({
	invalidateAll: vi.fn()
}));

// Mock toasts
vi.mock('svelte-sonner', () => ({
	toast: { success: vi.fn(), error: vi.fn() }
}));

import {
	eventpublicattendanceBookmarkEvent,
	eventpublicattendanceUnbookmarkEvent
} from '$lib/api/generated/sdk.gen';
import { authStore } from '$lib/stores/auth.svelte';
import { invalidateAll } from '$app/navigation';
import { toast } from 'svelte-sonner';

const mockAuthStore = authStore as { accessToken: string | null };

describe('BookmarkButton', () => {
	let queryClient: QueryClient;

	beforeEach(() => {
		queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
		});
		vi.spyOn(queryClient, 'invalidateQueries');
		vi.clearAllMocks();
		mockAuthStore.accessToken = 'test-token';
	});

	function renderButton(props: {
		eventId: string;
		isBookmarked: boolean;
		variant?: 'float' | 'inline';
		onlyWhenBookmarked?: boolean;
	}) {
		return render(QueryClientTestWrapper, {
			props: { client: queryClient, component: BookmarkButton, props }
		});
	}

	it('renders nothing when unauthenticated', () => {
		mockAuthStore.accessToken = null;
		const { container } = renderButton({ eventId: 'e1', isBookmarked: false });
		expect(container.querySelector('button')).toBeNull();
	});

	it('reflects the initial bookmarked state via aria-pressed', () => {
		renderButton({ eventId: 'e1', isBookmarked: true });
		expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
	});

	it('exposes a hover tooltip via the title attribute', () => {
		renderButton({ eventId: 'e1', isBookmarked: false });
		// title mirrors the aria-label so hovering shows "Bookmark this event"
		const btn = screen.getByRole('button');
		expect(btn).toHaveAttribute('title', btn.getAttribute('aria-label') ?? '');
	});

	it('optimistically bookmarks on click, calls POST, toasts, and invalidates the dashboard', async () => {
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
		await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
		expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
			queryKey: ['dashboard-your-events']
		});
		expect(invalidateAll).toHaveBeenCalled();
	});

	it('optimistically unbookmarks on click, calls DELETE, and shows a success toast', async () => {
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
		await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
	});

	it('does not queue a second request while one is in flight', async () => {
		const user = userEvent.setup();
		// Hold the first request open so the second click lands while pending.
		let resolveFirst: (() => void) | undefined;
		vi.mocked(eventpublicattendanceBookmarkEvent).mockImplementationOnce(
			() => new Promise((resolve) => (resolveFirst = () => resolve({ data: {} } as never)))
		);
		renderButton({ eventId: 'e1', isBookmarked: false });
		const btn = screen.getByRole('button');

		await user.click(btn);
		await user.click(btn); // should be ignored (pending / disabled)

		expect(eventpublicattendanceBookmarkEvent).toHaveBeenCalledTimes(1);
		resolveFirst?.();
	});

	it('reverts and shows an error toast when the mutation fails', async () => {
		const user = userEvent.setup();
		vi.mocked(eventpublicattendanceBookmarkEvent).mockRejectedValueOnce(new Error('boom'));
		renderButton({ eventId: 'e1', isBookmarked: false });
		const btn = screen.getByRole('button');

		await user.click(btn);

		await waitFor(() => expect(btn).toHaveAttribute('aria-pressed', 'false'));
		expect(toast.error).toHaveBeenCalled();
		expect(toast.success).not.toHaveBeenCalled();
	});

	describe('onlyWhenBookmarked (card indicator)', () => {
		it('renders nothing when not bookmarked', () => {
			const { container } = renderButton({
				eventId: 'e1',
				isBookmarked: false,
				onlyWhenBookmarked: true
			});
			expect(container.querySelector('button')).toBeNull();
		});

		it('removes the bookmark, fires its success toast, then disappears', async () => {
			const user = userEvent.setup();
			renderButton({ eventId: 'e1', isBookmarked: true, onlyWhenBookmarked: true });
			const btn = screen.getByRole('button');
			expect(btn).toHaveAttribute('aria-pressed', 'true');

			await user.click(btn);

			// onSuccess must fire (toast) even though the indicator ultimately unmounts.
			await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
			expect(eventpublicattendanceUnbookmarkEvent).toHaveBeenCalledWith({
				path: { event_id: 'e1' }
			});
			// After the request settles the indicator is gone.
			await waitFor(() => expect(screen.queryByRole('button')).toBeNull());
		});
	});
});
