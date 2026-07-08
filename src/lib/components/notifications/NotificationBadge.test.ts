import { render, screen, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import NotificationBadge from './NotificationBadge.svelte';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import * as api from '$lib/api/generated';

// Mock the API
vi.mock('$lib/api/generated', () => ({
	notificationUnreadCount: vi.fn()
}));

/** Build a fully-typed resolved result for the mocked notificationUnreadCount SDK call. */
type UnreadCountResult = Awaited<ReturnType<typeof api.notificationUnreadCount>>;
function unreadCountResult(count: number): UnreadCountResult {
	return {
		data: { count },
		error: undefined,
		request: new Request('http://localhost/api/notifications/unread-count'),
		response: new Response()
	};
}

describe('NotificationBadge', () => {
	let queryClient: QueryClient;

	beforeEach(() => {
		queryClient = new QueryClient({
			defaultOptions: {
				queries: {
					retry: false,
					gcTime: 0
				}
			}
		});

		// Reset mocks
		vi.clearAllMocks();

		// Mock successful API response by default
		vi.mocked(api.notificationUnreadCount).mockResolvedValue(unreadCountResult(5));
	});

	afterEach(() => {
		queryClient.clear();
	});

	function renderBadge(props: Record<string, unknown> = {}) {
		return render(QueryClientTestWrapper, {
			props: {
				client: queryClient,
				component: NotificationBadge,
				props: { authToken: 'test-token', ...props }
			}
		});
	}

	it('renders badge with unread count', async () => {
		renderBadge();

		await waitFor(() => {
			expect(screen.getByRole('status')).toBeInTheDocument();
		});

		expect(screen.getByText('5')).toBeInTheDocument();
		expect(screen.getByLabelText('5 unread notifications')).toBeInTheDocument();
	});

	it('does not render badge when count is 0 by default', async () => {
		vi.mocked(api.notificationUnreadCount).mockResolvedValue(unreadCountResult(0));

		renderBadge();

		await waitFor(() => {
			expect(api.notificationUnreadCount).toHaveBeenCalled();
		});

		expect(screen.queryByRole('status')).not.toBeInTheDocument();
	});

	it('renders badge when count is 0 if showZero is true', async () => {
		vi.mocked(api.notificationUnreadCount).mockResolvedValue(unreadCountResult(0));

		renderBadge({ showZero: true });

		await waitFor(() => {
			expect(screen.getByRole('status')).toBeInTheDocument();
		});

		expect(screen.getByText('0')).toBeInTheDocument();
	});

	it('displays "99+" when count exceeds maxCount', async () => {
		vi.mocked(api.notificationUnreadCount).mockResolvedValue(unreadCountResult(150));

		renderBadge({ maxCount: 99 });

		await waitFor(() => {
			expect(screen.getByText('99+')).toBeInTheDocument();
		});

		expect(screen.getByLabelText('More than 99 unread notifications')).toBeInTheDocument();
	});

	it('uses custom maxCount', async () => {
		vi.mocked(api.notificationUnreadCount).mockResolvedValue(unreadCountResult(60));

		renderBadge({ maxCount: 50 });

		await waitFor(() => {
			expect(screen.getByText('50+')).toBeInTheDocument();
		});
	});

	it('calls onCountChange callback when count changes', async () => {
		const onCountChange = vi.fn();

		renderBadge({ onCountChange });

		await waitFor(() => {
			expect(onCountChange).toHaveBeenCalledWith(5);
		});
	});

	it('includes authorization header in API call', async () => {
		renderBadge({ authToken: 'my-secret-token' });

		await waitFor(() => {
			expect(api.notificationUnreadCount).toHaveBeenCalledWith({
				headers: { Authorization: 'Bearer my-secret-token' }
			});
		});
	});

	it('handles API errors gracefully', async () => {
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		vi.mocked(api.notificationUnreadCount).mockRejectedValue(new Error('Network error'));

		renderBadge();

		// The component sets `retry: 1` on the query, so the error state only
		// settles after the built-in retry delay — allow more than the default 1s.
		await waitFor(
			() => {
				expect(consoleWarnSpy).toHaveBeenCalledWith(
					'[NotificationBadge] Failed to fetch unread count'
				);
			},
			{ timeout: 4000 }
		);

		// Badge should not be rendered on error
		expect(screen.queryByRole('status')).not.toBeInTheDocument();

		consoleWarnSpy.mockRestore();
	});

	it('has correct ARIA labels for accessibility', async () => {
		vi.mocked(api.notificationUnreadCount).mockResolvedValue(unreadCountResult(1));

		renderBadge();

		await waitFor(() => {
			expect(screen.getByLabelText('1 unread notification')).toBeInTheDocument();
		});
	});

	it('applies custom className', async () => {
		renderBadge({ class: 'custom-badge-class' });

		await waitFor(() => {
			const badge = screen.getByRole('status');
			expect(badge).toHaveClass('custom-badge-class');
		});
	});

	it('has role="status" and aria-live="polite"', async () => {
		renderBadge();

		await waitFor(() => {
			const badge = screen.getByRole('status');
			expect(badge).toHaveAttribute('aria-live', 'polite');
		});
	});
});
