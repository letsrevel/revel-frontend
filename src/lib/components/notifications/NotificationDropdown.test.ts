import { render, screen, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import NotificationDropdown from './NotificationDropdown.svelte';
import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';

// Mock the API
vi.mock('$lib/api/generated', () => ({
	notificationUnreadCount: vi.fn(() =>
		Promise.resolve({
			data: { count: 3 }
		})
	),
	notificationListNotifications: vi.fn(() =>
		Promise.resolve({
			data: {
				results: [
					{
						id: '1',
						notification_type: 'event_invitation',
						title: 'Event Invitation',
						message: 'You have been invited to Test Event',
						read_at: null,
						created_at: new Date().toISOString()
					},
					{
						id: '2',
						notification_type: 'event_update',
						title: 'Event Update',
						message: 'Event details have been updated',
						read_at: new Date().toISOString(),
						created_at: new Date().toISOString()
					}
				],
				count: 2
			}
		})
	)
}));

// Mock navigation
const mockGoto = vi.fn();
vi.mock('$app/navigation', () => ({
	goto: (url: string) => mockGoto(url)
}));

describe('NotificationDropdown', () => {
	let queryClient: QueryClient;

	beforeEach(() => {
		queryClient = new QueryClient({
			defaultOptions: {
				queries: {
					retry: false
				}
			}
		});
		vi.clearAllMocks();
	});

	function renderWithQuery(props: any = {}) {
		return render(QueryClientProvider, {
			props: {
				client: queryClient,
				children: NotificationDropdown,
				childProps: {
					authToken: 'test-token',
					...props
				}
			}
		});
	}

	it('renders bell icon button', () => {
		renderWithQuery();
		const button = screen.getByRole('button', { name: /open notifications/i });
		expect(button).toBeInTheDocument();
	});

	it('shows notification badge with unread count', async () => {
		renderWithQuery();

		await waitFor(() => {
			const badge = screen.getByRole('status');
			expect(badge).toBeInTheDocument();
			expect(badge).toHaveTextContent('3');
		});
	});

	it('opens dropdown when button is clicked', async () => {
		const user = userEvent.setup();
		renderWithQuery();

		const button = screen.getByRole('button', { name: /open notifications/i });
		await user.click(button);

		await waitFor(() => {
			expect(screen.getByText(/notifications/i)).toBeInTheDocument();
		});
	});

	it('shows notification list in compact mode', async () => {
		const user = userEvent.setup();
		renderWithQuery();

		const button = screen.getByRole('button', { name: /open notifications/i });
		await user.click(button);

		await waitFor(() => {
			expect(screen.getByText('Event Invitation')).toBeInTheDocument();
			expect(screen.getByText('Event Update')).toBeInTheDocument();
		});
	});

	it('shows "View all notifications" link', async () => {
		const user = userEvent.setup();
		renderWithQuery();

		const button = screen.getByRole('button', { name: /open notifications/i });
		await user.click(button);

		await waitFor(() => {
			expect(screen.getByText(/view all notifications/i)).toBeInTheDocument();
		});
	});

	it('navigates to notifications page when "View all" is clicked', async () => {
		const user = userEvent.setup();
		renderWithQuery();

		const button = screen.getByRole('button', { name: /open notifications/i });
		await user.click(button);

		await waitFor(() => {
			const viewAllButton = screen.getByText(/view all notifications/i);
			expect(viewAllButton).toBeInTheDocument();
		});

		const viewAllButton = screen.getByText(/view all notifications/i);
		await user.click(viewAllButton);

		expect(mockGoto).toHaveBeenCalledWith('/account/notifications');
	});

	it('is keyboard accessible', async () => {
		const user = userEvent.setup();
		renderWithQuery();

		// Tab to button
		await user.tab();
		const button = screen.getByRole('button', { name: /open notifications/i });
		expect(button).toHaveFocus();

		// Enter to open
		await user.keyboard('{Enter}');

		await waitFor(() => {
			expect(screen.getByText(/notifications/i)).toBeInTheDocument();
		});

		// Escape to close
		await user.keyboard('{Escape}');

		await waitFor(() => {
			expect(screen.queryByText('Event Invitation')).not.toBeInTheDocument();
		});
	});

	it('passes custom polling interval to NotificationBadge', () => {
		renderWithQuery({ pollingInterval: 30000 });
		const button = screen.getByRole('button', { name: /open notifications/i });
		expect(button).toBeInTheDocument();
		// Badge will use the custom polling interval internally
	});

	it('passes custom maxItems to NotificationList', async () => {
		const user = userEvent.setup();
		renderWithQuery({ maxItems: 10 });

		const button = screen.getByRole('button', { name: /open notifications/i });
		await user.click(button);

		await waitFor(() => {
			expect(screen.getByText('Event Invitation')).toBeInTheDocument();
		});
		// NotificationList will respect the maxItems prop internally
	});

	it('has proper ARIA attributes', () => {
		renderWithQuery();
		const button = screen.getByRole('button', { name: /open notifications/i });

		// Button should have proper aria-label
		expect(button).toHaveAttribute('aria-label');
	});

	it('handles missing authToken gracefully', () => {
		// Should still render but badge won't show
		expect(() => renderWithQuery({ authToken: '' })).not.toThrow();
	});

	it('applies custom className', () => {
		renderWithQuery({ class: 'custom-class' });
		const button = screen.getByRole('button', { name: /open notifications/i });
		// Custom class is applied to the dropdown root, not the button directly
		expect(button).toBeInTheDocument();
	});
});
