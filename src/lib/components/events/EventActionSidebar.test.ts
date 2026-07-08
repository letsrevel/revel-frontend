import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import { userEvent } from '@testing-library/user-event';
import { QueryClient } from '@tanstack/svelte-query';
import EventActionSidebar from './EventActionSidebar.svelte';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import type { EventDetailSchema } from '$lib/api/generated/types.gen';
import type {
	EventRsvpSchema,
	EventTicketSchema,
	EventUserEligibility
} from '$lib/api/generated/types.gen';
import type { TierSchemaWithId } from '$lib/types/tickets';

// Mock event helper
function createMockEvent(overrides: Partial<EventDetailSchema> = {}): EventDetailSchema {
	return {
		id: 'test-event-id',
		name: 'Test Event',
		slug: 'test-event',
		description: 'Test event description',
		event_type: 'public',
		visibility: 'public',
		status: 'approved',
		start: '2030-12-01T18:00:00Z',
		end: '2030-12-01T22:00:00Z',
		attendee_count: 10,
		max_attendees: 50,
		requires_ticket: false,
		potluck_open: false,
		organization: {
			id: 'org-id',
			name: 'Test Organization',
			slug: 'test-org',
			description: 'Test org',
			visibility: 'public',
			member_count: 100
		},
		...overrides
	} as EventDetailSchema;
}

// EventActionSidebar renders children (BookmarkButton, EventRSVP) that create
// queries/mutations, so it must render inside a real <QueryClientProvider>.
function renderSidebar(props: Record<string, unknown>) {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
	});
	return render(QueryClientTestWrapper, {
		props: { client: queryClient, component: EventActionSidebar, props }
	});
}

describe('EventActionSidebar', () => {
	describe('Rendering', () => {
		it('renders with event status badge', () => {
			const event = createMockEvent();
			renderSidebar({
				event,
				userStatus: null,
				isAuthenticated: false
			});

			// Badge should be visible
			expect(screen.getByRole('status')).toBeInTheDocument();
		});

		it('renders quick info section', () => {
			const event = createMockEvent();
			renderSidebar({
				event,
				userStatus: null,
				isAuthenticated: false
			});

			// Quick info uses role="list"
			expect(screen.getByRole('list', { name: /event quick information/i })).toBeInTheDocument();
		});

		it('applies sidebar variant classes', () => {
			const event = createMockEvent();
			const { container } = renderSidebar({
				event,
				userStatus: null,
				isAuthenticated: false,
				variant: 'sidebar'
			});

			const aside = container.querySelector('aside');
			expect(aside?.className).toContain('sticky');
		});

		it('applies card variant classes', () => {
			const event = createMockEvent();
			const { container } = renderSidebar({
				event,
				userStatus: null,
				isAuthenticated: false,
				variant: 'card'
			});

			const aside = container.querySelector('aside');
			expect(aside?.className).not.toContain('sticky');
		});

		it('applies custom class', () => {
			const event = createMockEvent();
			const { container } = renderSidebar({
				event,
				userStatus: null,
				isAuthenticated: false,
				class: 'custom-class'
			});

			const aside = container.querySelector('aside');
			expect(aside?.className).toContain('custom-class');
		});
	});

	describe('Unauthenticated User', () => {
		it('shows login prompt when not authenticated', () => {
			const event = createMockEvent();
			renderSidebar({
				event,
				userStatus: null,
				isAuthenticated: false
			});

			// Free events render EventRSVP, which shows a "Login to RSVP" link
			expect(screen.getByRole('link', { name: /login to rsvp/i })).toBeInTheDocument();
		});

		it('does not show attendance status when not authenticated', () => {
			const event = createMockEvent();
			renderSidebar({
				event,
				userStatus: null,
				isAuthenticated: false
			});

			expect(screen.queryByText(/you're attending/i)).not.toBeInTheDocument();
		});
	});

	describe('Authenticated User - No Status', () => {
		it('shows RSVP buttons for free event when user is eligible', () => {
			const event = createMockEvent({ requires_ticket: false });
			const userStatus: EventUserEligibility = {
				allowed: true,
				event_id: 'event-id',
				next_step: 'rsvp'
			};
			renderSidebar({
				event,
				userStatus,
				isAuthenticated: true
			});

			expect(screen.getByText('Will you attend?')).toBeInTheDocument();
			expect(screen.getByRole('button', { name: /yes/i })).toBeInTheDocument();
		});

		it('shows buy tickets button for ticketed event', () => {
			const event = createMockEvent({ requires_ticket: true });
			renderSidebar({
				event,
				userStatus: null,
				isAuthenticated: true
			});

			expect(screen.getByRole('button', { name: /get tickets/i })).toBeInTheDocument();
		});
	});

	describe('User with Approved RSVP', () => {
		it('shows attendance confirmation', () => {
			const event = createMockEvent();
			const userStatus: EventRsvpSchema = {
				event_id: 'event-id',
				status: 'yes'
			};

			renderSidebar({
				event,
				userStatus,
				isAuthenticated: true
			});

			expect(screen.getByText(/you're attending/i)).toBeInTheDocument();
		});

		it('shows change RSVP button', () => {
			const event = createMockEvent();
			const userStatus: EventRsvpSchema = {
				event_id: 'event-id',
				status: 'yes'
			};

			renderSidebar({
				event,
				userStatus,
				isAuthenticated: true
			});

			expect(screen.getByRole('button', { name: /change rsvp/i })).toBeInTheDocument();
		});

		it('does not show primary action button', () => {
			const event = createMockEvent();
			const userStatus: EventRsvpSchema = {
				event_id: 'event-id',
				status: 'yes'
			};

			renderSidebar({
				event,
				userStatus,
				isAuthenticated: true
			});

			expect(screen.queryByRole('button', { name: /^rsvp$/i })).not.toBeInTheDocument();
		});
	});

	describe('User with Active Ticket', () => {
		it('shows ticket confirmation', () => {
			const event = createMockEvent();
			const userStatus: EventTicketSchema = {
				event_id: 'event-id',
				id: 'ticket-id',
				status: 'active',
				tier: {
					id: 'tier-id',
					name: 'VIP Ticket',
					price: '50.00',
					currency: 'USD',
					event_id: 'event-id',
					total_available: 100
				} as TierSchemaWithId
			};

			renderSidebar({
				event,
				userStatus,
				isAuthenticated: true
			});

			expect(screen.getByText(/you have a ticket/i)).toBeInTheDocument();
		});

		it('shows ticket tier name', () => {
			const event = createMockEvent();
			const userStatus: EventTicketSchema = {
				event_id: 'event-id',
				id: 'ticket-id',
				status: 'active',
				tier: {
					id: 'tier-id',
					name: 'VIP Ticket',
					price: '50.00',
					currency: 'USD',
					event_id: 'event-id',
					total_available: 100
				} as TierSchemaWithId
			};

			renderSidebar({
				event,
				userStatus,
				isAuthenticated: true
			});

			expect(screen.getByText('VIP Ticket')).toBeInTheDocument();
		});

		it('shows show-ticket button', () => {
			const event = createMockEvent();
			const userStatus: EventTicketSchema = {
				event_id: 'event-id',
				id: 'ticket-id',
				status: 'active',
				tier: {
					id: 'tier-id',
					name: 'General Admission',
					price: '25.00',
					currency: 'USD'
				}
			};

			renderSidebar({
				event,
				userStatus,
				isAuthenticated: true
			});

			expect(screen.getByRole('button', { name: /show ticket/i })).toBeInTheDocument();
		});

		it('shows checked in status', () => {
			const event = createMockEvent();
			const userStatus: EventTicketSchema = {
				event_id: 'event-id',
				id: 'ticket-id',
				status: 'checked_in',
				tier: {
					id: 'tier-id',
					name: 'General Admission',
					price: '25.00',
					currency: 'USD'
				}
			};

			renderSidebar({
				event,
				userStatus,
				isAuthenticated: true
			});

			expect(screen.getByText(/you're checked in/i)).toBeInTheDocument();
		});
	});

	describe('User Not Eligible', () => {
		it('shows eligibility status when not allowed (ticketed event)', () => {
			const event = createMockEvent({ requires_ticket: true });
			const userStatus: EventUserEligibility = {
				allowed: false,
				event_id: 'event-id',
				reason: 'This is a members-only event',
				next_step: 'become_member'
			};

			renderSidebar({
				event,
				userStatus,
				isAuthenticated: true
			});

			expect(screen.getByText(/eligibility status/i)).toBeInTheDocument();
			expect(screen.getByText(/this is a members-only event/i)).toBeInTheDocument();
		});

		it('does not show eligibility when allowed', () => {
			const event = createMockEvent();
			const userStatus: EventUserEligibility = {
				allowed: true,
				event_id: 'event-id',
				next_step: 'rsvp'
			};

			renderSidebar({
				event,
				userStatus,
				isAuthenticated: true
			});

			expect(screen.queryByText(/eligibility status/i)).not.toBeInTheDocument();
		});
	});

	describe('Accessibility', () => {
		it('has proper ARIA label on container', () => {
			const event = createMockEvent();
			renderSidebar({
				event,
				userStatus: null,
				isAuthenticated: false
			});

			expect(screen.getByRole('complementary', { name: /event actions/i })).toBeInTheDocument();
		});

		it('has proper heading hierarchy', () => {
			const event = createMockEvent({ requires_ticket: true });
			const userStatus: EventUserEligibility = {
				allowed: false,
				event_id: 'event-id',
				reason: 'Not eligible',
				next_step: 'become_member'
			};

			renderSidebar({
				event,
				userStatus,
				isAuthenticated: true
			});

			// Check for heading
			expect(screen.getByText(/eligibility status/i)).toBeInTheDocument();
		});

		it('attendance status has live region', () => {
			const event = createMockEvent();
			const userStatus: EventRsvpSchema = {
				event_id: 'event-id',
				status: 'yes'
			};

			const { container } = renderSidebar({
				event,
				userStatus,
				isAuthenticated: true
			});

			const statusElement = container.querySelector('[aria-live="polite"]');
			expect(statusElement).toBeInTheDocument();
		});
	});

	describe('Keyboard Navigation', () => {
		it('buttons are keyboard accessible', async () => {
			const user = userEvent.setup();
			const event = createMockEvent();

			renderSidebar({
				event,
				userStatus: null,
				isAuthenticated: false
			});

			const link = screen.getByRole('link', { name: /login to rsvp/i });

			// Tab to the login link
			await user.tab();
			expect(link).toHaveFocus();
		});

		it('secondary action button is keyboard accessible', async () => {
			const user = userEvent.setup();
			const event = createMockEvent();
			const userStatus: EventRsvpSchema = {
				event_id: 'event-id',
				status: 'yes'
			};

			renderSidebar({
				event,
				userStatus,
				isAuthenticated: true
			});

			const button = screen.getByRole('button', { name: /change rsvp/i });

			// Tab to button
			await user.tab();
			expect(button).toHaveFocus();
		});
	});
});
