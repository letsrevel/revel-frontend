import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import NotificationItem from './NotificationItem.svelte';
import type { NotificationSchema } from '$lib/api/generated/types.gen';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';

// Mock the API functions
vi.mock('$lib/api/generated', () => ({
	notificationMarkRead: vi.fn().mockResolvedValue({
		data: { read_at: new Date().toISOString() }
	}),
	notificationMarkUnread: vi.fn().mockResolvedValue({
		data: { read_at: null }
	})
}));

// Mock the toast
vi.mock('svelte-sonner', () => ({
	toast: {
		error: vi.fn()
	}
}));

// Mock the navigation
vi.mock('$app/navigation', () => ({
	goto: vi.fn()
}));

// Helper to create a mock notification
function createMockNotification(overrides?: Partial<NotificationSchema>): NotificationSchema {
	return {
		id: '123',
		notification_type: 'event_invitation',
		title: 'New Event Invitation',
		body: '<p>You have been invited to <strong>Summer BBQ</strong></p>',
		context: { event_id: 'event-123' },
		read_at: null,
		created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
		...overrides
	};
}

// Helper to render inside a real QueryClientProvider (the component creates mutations)
function renderItem(props: Record<string, unknown>) {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: { retry: false },
			mutations: { retry: false }
		}
	});

	return render(QueryClientTestWrapper, {
		props: {
			client: queryClient,
			component: NotificationItem,
			componentProps: props
		}
	});
}

describe('NotificationItem', () => {
	const mockAuthToken = 'test-token-123';
	let user: ReturnType<typeof userEvent.setup>;

	beforeEach(() => {
		user = userEvent.setup();
		vi.clearAllMocks();
	});

	it('renders unread notification with all elements', () => {
		const notification = createMockNotification();

		renderItem({ notification, authToken: mockAuthToken });

		// Check title is present
		expect(screen.getByRole('heading', { name: /New Event Invitation/i })).toBeInTheDocument();

		// Check body HTML is rendered
		expect(screen.getByText(/You have been invited to/i)).toBeInTheDocument();
		expect(screen.getByText(/Summer BBQ/i)).toBeInTheDocument();

		// Check relative time is displayed
		expect(screen.getByText(/ago/i)).toBeInTheDocument();

		// Check mark as read button is present
		expect(screen.getByRole('button', { name: /mark as read/i })).toBeInTheDocument();
	});

	it('renders read notification with different styling', () => {
		const notification = createMockNotification({
			read_at: new Date(Date.now() - 1000 * 60 * 15).toISOString() // Read 15 mins ago
		});

		renderItem({ notification, authToken: mockAuthToken });

		// Check mark as unread button is present
		expect(screen.getByRole('button', { name: /mark as unread/i })).toBeInTheDocument();
	});

	it('displays correct relative time for recent notifications', () => {
		const notification = createMockNotification({
			created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString() // 5 minutes ago
		});

		renderItem({ notification, authToken: mockAuthToken });

		expect(screen.getByText(/5 minutes ago/i)).toBeInTheDocument();
	});

	it('displays "now" for very recent notifications', () => {
		const notification = createMockNotification({
			created_at: new Date(Date.now() - 1000 * 10).toISOString() // 10 seconds ago
		});

		renderItem({ notification, authToken: mockAuthToken });

		// formatRelativeTime uses Intl.RelativeTimeFormat, which renders sub-30s
		// deltas as "now" (previously a hand-rolled "just now").
		expect(screen.getByText(/^now$/i)).toBeInTheDocument();
	});

	it('truncates body in compact mode', () => {
		const notification = createMockNotification({
			body: '<p>This is a very long notification body that should be truncated when in compact mode. It has multiple sentences and should only show the first two lines.</p>'
		});

		const { container } = renderItem({
			notification,
			authToken: mockAuthToken,
			compact: true
		});

		// Check if the compact-mode line-clamp class is applied
		const bodyElement = container.querySelector('.line-clamp-4');
		expect(bodyElement).toBeInTheDocument();
	});

	it('is keyboard accessible and navigates on Enter', async () => {
		const notification = createMockNotification();
		const { goto } = await import('$app/navigation');

		renderItem({ notification, authToken: mockAuthToken });

		const card = screen.getByRole('button', { name: /New Event Invitation/i });
		card.focus();

		// Press Enter
		await user.keyboard('{Enter}');

		// Should navigate to event page
		expect(goto).toHaveBeenCalledWith('/events/event-123');
	});

	it('is keyboard accessible and navigates on Space', async () => {
		const notification = createMockNotification();
		const { goto } = await import('$app/navigation');

		renderItem({ notification, authToken: mockAuthToken });

		const card = screen.getByRole('button', { name: /New Event Invitation/i });
		card.focus();

		// Press Space
		await user.keyboard(' ');

		// Should navigate to event page
		expect(goto).toHaveBeenCalledWith('/events/event-123');
	});

	it('extracts URL from different context patterns', () => {
		const contexts = [
			{ event_id: 'event-123', expectedUrl: '/events/event-123' },
			{ organization_slug: 'my-org', expectedUrl: '/org/my-org' },
			{ org_slug: 'my-org', expectedUrl: '/org/my-org' },
			{ invitation_id: 'inv-123', expectedUrl: '/invitations/inv-123' },
			{ url: '/custom/path', expectedUrl: '/custom/path' }
		];

		contexts.forEach(({ expectedUrl: _expectedUrl, ...context }) => {
			const notification = createMockNotification({ context });

			const { container, unmount } = renderItem({ notification, authToken: mockAuthToken });

			// Card should be clickable
			const card = container.querySelector('[role="button"]');
			expect(card).toBeInTheDocument();

			unmount();
		});
	});

	// The backend's org-scoped notification contexts carry `organization_slug`
	// (see revel-backend/src/notifications/context_schemas.py); `org_slug` was
	// never emitted. Both must resolve to the org page.
	it.each([['organization_slug'], ['org_slug']])(
		'navigates to the org page for a non-subscription notification with %s',
		async (key) => {
			const notification = createMockNotification({
				notification_type: 'membership_request_approved',
				context: { [key]: 'tech-community' }
			});
			const { goto } = await import('$app/navigation');

			renderItem({ notification, authToken: mockAuthToken });

			await user.click(screen.getByRole('button', { name: /New Event Invitation/i }));

			expect(goto).toHaveBeenCalledWith('/org/tech-community');
		}
	);

	it('falls back to the notifications page when the context has neither slug key', async () => {
		const notification = createMockNotification({
			notification_type: 'membership_request_approved',
			// Real MembershipRequestApprovedContext shape minus frontend_url:
			// organization identity only, no slug and no URL of any kind.
			context: { organization_id: 'org-123', organization_name: 'Tech Community' }
		});
		const { goto } = await import('$app/navigation');

		renderItem({ notification, authToken: mockAuthToken });

		await user.click(screen.getByRole('button', { name: /New Event Invitation/i }));

		expect(goto).toHaveBeenCalledWith(expect.stringContaining('/account/notifications'));
	});

	describe('subscription notifications', () => {
		// Every subscription_* context carries `organization_slug` plus URLs that
		// point either at org routes this app does not have
		// (`/org/{slug}/subscription`) or at Stripe. The member's own
		// subscription surface is /account/memberships, so the card body must
		// land there rather than falling through to the notifications list.
		const subscriptionTypes = [
			'subscription_renewal_succeeded',
			'subscription_payment_failed',
			'subscription_expired',
			'subscription_cancellation_confirmed',
			'subscription_renewal_reminder',
			'subscription_price_migration_notice',
			'subscription_revival_checkout'
		] as const;

		it.each(subscriptionTypes)('navigates %s to the memberships page', async (type) => {
			const notification = createMockNotification({
				notification_type: type,
				title: 'Subscription update',
				context: {
					organization_name: 'Tech Community',
					organization_slug: 'tech-community',
					plan_name: 'Gold',
					manage_subscription_url: 'https://revel.test/org/tech-community/subscription'
				}
			});
			const { goto } = await import('$app/navigation');

			renderItem({ notification, authToken: mockAuthToken });

			await user.click(screen.getByRole('button', { name: /Subscription update/i }));

			expect(goto).toHaveBeenCalledTimes(1);
			expect(goto).toHaveBeenCalledWith(expect.stringContaining('/account/memberships'));
		});

		it('never hands goto the absolute Stripe checkout URL', async () => {
			const checkoutUrl = 'https://checkout.stripe.com/c/pay/cs_test_123';
			const notification = createMockNotification({
				notification_type: 'subscription_revival_checkout',
				title: 'Subscription update',
				context: {
					organization_slug: 'tech-community',
					plan_name: 'Gold',
					amount: '10.00 EUR',
					checkout_url: checkoutUrl
				}
			});
			const { goto } = await import('$app/navigation');

			renderItem({ notification, authToken: mockAuthToken });

			await user.click(screen.getByRole('button', { name: /Subscription update/i }));

			expect(goto).toHaveBeenCalledWith(expect.stringContaining('/account/memberships'));
			expect(goto).not.toHaveBeenCalledWith(expect.stringContaining('checkout.stripe.com'));
		});

		it('still prefers frontend_url over the memberships page for non-subscription types', async () => {
			const notification = createMockNotification({
				notification_type: 'membership_request_approved',
				context: {
					organization_slug: 'tech-community',
					frontend_url: 'https://revel.test/org/tech-community'
				}
			});
			const { goto } = await import('$app/navigation');

			renderItem({ notification, authToken: mockAuthToken });

			await user.click(screen.getByRole('button', { name: /New Event Invitation/i }));

			expect(goto).toHaveBeenCalledWith('/org/tech-community');
		});
	});

	it('navigates to the notifications page when context has no URL', async () => {
		const notification = createMockNotification({
			context: {} // No URL-related keys
		});
		const { goto } = await import('$app/navigation');

		renderItem({ notification, authToken: mockAuthToken });

		// The card is still an interactive button; clicking it falls back to the
		// notifications page instead of a context-specific deep link.
		const card = screen.getByRole('button', { name: /New Event Invitation/i });
		await user.click(card);

		expect(goto).toHaveBeenCalledWith(expect.stringContaining('/account/notifications'));
	});

	it('calls onStatusChange callback after marking as read', async () => {
		const notification = createMockNotification();
		const onStatusChange = vi.fn();
		const { notificationMarkRead } = await import('$lib/api/generated');

		renderItem({
			notification,
			authToken: mockAuthToken,
			onStatusChange
		});

		const markReadButton = screen.getByRole('button', { name: /mark as read/i });
		await user.click(markReadButton);

		// Wait for mutation to complete
		await vi.waitFor(() => {
			expect(notificationMarkRead).toHaveBeenCalledWith({
				path: { notification_id: '123' },
				headers: { Authorization: `Bearer ${mockAuthToken}` }
			});
		});

		// Callback should be called with updated notification
		await vi.waitFor(() => {
			expect(onStatusChange).toHaveBeenCalledWith(
				expect.objectContaining({
					id: '123',
					read_at: expect.any(String)
				})
			);
		});
	});

	it('shows error toast on mark read failure', async () => {
		const notification = createMockNotification();
		const { notificationMarkRead } = await import('$lib/api/generated');
		const { toast } = await import('svelte-sonner');

		// Mock API to fail
		vi.mocked(notificationMarkRead).mockRejectedValueOnce(new Error('Network error'));

		renderItem({ notification, authToken: mockAuthToken });

		const markReadButton = screen.getByRole('button', { name: /mark as read/i });
		await user.click(markReadButton);

		// Wait for error toast
		await vi.waitFor(() => {
			expect(toast.error).toHaveBeenCalled();
		});
	});

	it('stops propagation when clicking mark read/unread button', async () => {
		const notification = createMockNotification();
		const { goto } = await import('$app/navigation');

		renderItem({ notification, authToken: mockAuthToken });

		const markReadButton = screen.getByRole('button', { name: /mark as read/i });
		await user.click(markReadButton);

		// Should NOT navigate
		expect(goto).not.toHaveBeenCalled();
	});

	it('applies custom className prop', () => {
		const notification = createMockNotification();

		const { container } = renderItem({
			notification,
			authToken: mockAuthToken,
			class: 'custom-test-class'
		});

		const card = container.querySelector('.custom-test-class');
		expect(card).toBeInTheDocument();
	});

	it('has proper ARIA labels for screen readers', () => {
		const notification = createMockNotification();

		renderItem({ notification, authToken: mockAuthToken });

		const card = screen.getByRole('button', {
			name: /New Event Invitation.*Unread.*Click to view details/i
		});

		expect(card).toBeInTheDocument();
	});
});
