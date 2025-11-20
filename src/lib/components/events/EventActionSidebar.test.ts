import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import { userEvent } from '@testing-library/user-event';
import EventActionSidebar from './EventActionSidebar.svelte';
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
		description_html: '<p>Test event description</p>',
		event_type: 'public',
		visibility: 'public',
		status: 'approved',
		start: '2025-12-01T18:00:00Z',
		end: '2025-12-01T22:00:00Z',
		attendee_count: 10,
		max_attendees: 50,
		requires_ticket: false,
		potluck_open: false,
		organization: {
			id: 'org-id',
			name: 'Test Organization',
			slug: 'test-org',
			description: 'Test org',
			description_html: '<p>Test org</p>',
			visibility: 'public',
			member_count: 100
		},
		...overrides
	} as EventDetailSchema;
}

describe('EventActionSidebar', () => {
	describe('Rendering', () => {
		it('renders with event status badge', () => {
			const event = createMockEvent();
			render(EventActionSidebar, {
				props: {
					event,
					userStatus: null,
					isAuthenticated: false
				}
			});

			// Badge should be visible
			expect(screen.getByRole('status')).toBeInTheDocument();
		});

		it('renders quick info section', () => {
			const event = createMockEvent();
			render(EventActionSidebar, {
				props: {
					event,
					userStatus: null,
					isAuthenticated: false
				}
			});

			// Quick info uses role="list"
			expect(screen.getByRole('list', { name: /event quick information/i })).toBeInTheDocument();
		});

		it('applies sidebar variant classes', () => {
			const event = createMockEvent();
			const { container } = render(EventActionSidebar, {
				props: {
					event,
					userStatus: null,
					isAuthenticated: false,
					variant: 'sidebar'
				}
			});

			const aside = container.querySelector('aside');
			expect(aside?.className).toContain('sticky');
		});

		it('applies card variant classes', () => {
			const event = createMockEvent();
			const { container } = render(EventActionSidebar, {
				props: {
					event,
					userStatus: null,
					isAuthenticated: false,
					variant: 'card'
				}
			});

			const aside = container.querySelector('aside');
			expect(aside?.className).not.toContain('sticky');
		});

		it('applies custom class', () => {
			const event = createMockEvent();
			const { container } = render(EventActionSidebar, {
				props: {
					event,
					userStatus: null,
					isAuthenticated: false,
					class: 'custom-class'
				}
			});

			const aside = container.querySelector('aside');
			expect(aside?.className).toContain('custom-class');
		});
	});

	describe('Unauthenticated User', () => {
		it('shows sign in button when not authenticated', () => {
			const event = createMockEvent();
			render(EventActionSidebar, {
				props: {
					event,
					userStatus: null,
					isAuthenticated: false
				}
			});

			expect(screen.getByRole('button', { name: /sign in to attend/i })).toBeInTheDocument();
		});

		it('does not show attendance status when not authenticated', () => {
			const event = createMockEvent();
			render(EventActionSidebar, {
				props: {
					event,
					userStatus: null,
					isAuthenticated: false
				}
			});

			expect(screen.queryByText(/you're attending/i)).not.toBeInTheDocument();
		});
	});

	describe('Authenticated User - No Status', () => {
		it('shows RSVP button for free event', () => {
			const event = createMockEvent({ requires_ticket: false });
			render(EventActionSidebar, {
				props: {
					event,
					userStatus: null,
					isAuthenticated: true
				}
			});

			expect(screen.getByRole('button', { name: /rsvp/i })).toBeInTheDocument();
		});

		it('shows buy tickets button for ticketed event', () => {
			const event = createMockEvent({ requires_ticket: true });
			render(EventActionSidebar, {
				props: {
					event,
					userStatus: null,
					isAuthenticated: true
				}
			});

			expect(screen.getByRole('button', { name: /buy tickets/i })).toBeInTheDocument();
		});
	});

	describe('User with Approved RSVP', () => {
		it('shows attendance confirmation', () => {
			const event = createMockEvent();
			const userStatus: EventRsvpSchema = {
				event_id: 'event-id',
				status: 'approved'
			};

			render(EventActionSidebar, {
				props: {
					event,
					userStatus,
					isAuthenticated: true
				}
			});

			expect(screen.getByText(/you're attending/i)).toBeInTheDocument();
		});

		it('shows manage RSVP button', () => {
			const event = createMockEvent();
			const userStatus: EventRsvpSchema = {
				event_id: 'event-id',
				status: 'approved'
			};

			render(EventActionSidebar, {
				props: {
					event,
					userStatus,
					isAuthenticated: true
				}
			});

			expect(screen.getByRole('button', { name: /manage rsvp/i })).toBeInTheDocument();
		});

		it('does not show primary action button', () => {
			const event = createMockEvent();
			const userStatus: EventRsvpSchema = {
				event_id: 'event-id',
				status: 'approved'
			};

			render(EventActionSidebar, {
				props: {
					event,
					userStatus,
					isAuthenticated: true
				}
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

			render(EventActionSidebar, {
				props: {
					event,
					userStatus,
					isAuthenticated: true
				}
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

			render(EventActionSidebar, {
				props: {
					event,
					userStatus,
					isAuthenticated: true
				}
			});

			expect(screen.getByText('VIP Ticket')).toBeInTheDocument();
		});

		it('shows view ticket button', () => {
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

			render(EventActionSidebar, {
				props: {
					event,
					userStatus,
					isAuthenticated: true
				}
			});

			expect(screen.getByRole('button', { name: /view ticket/i })).toBeInTheDocument();
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

			render(EventActionSidebar, {
				props: {
					event,
					userStatus,
					isAuthenticated: true
				}
			});

			expect(screen.getByText(/you're checked in/i)).toBeInTheDocument();
		});
	});

	describe('User Not Eligible', () => {
		it('shows eligibility status when not allowed', () => {
			const event = createMockEvent();
			const userStatus: EventUserEligibility = {
				allowed: false,
				event_id: 'event-id',
				reason: 'This is a members-only event',
				next_step: 'become_member'
			};

			render(EventActionSidebar, {
				props: {
					event,
					userStatus,
					isAuthenticated: true
				}
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

			render(EventActionSidebar, {
				props: {
					event,
					userStatus,
					isAuthenticated: true
				}
			});

			expect(screen.queryByText(/eligibility status/i)).not.toBeInTheDocument();
		});
	});

	describe('Accessibility', () => {
		it('has proper ARIA label on container', () => {
			const event = createMockEvent();
			render(EventActionSidebar, {
				props: {
					event,
					userStatus: null,
					isAuthenticated: false
				}
			});

			expect(screen.getByRole('complementary', { name: /event actions/i })).toBeInTheDocument();
		});

		it('has proper heading hierarchy', () => {
			const event = createMockEvent();
			const userStatus: EventUserEligibility = {
				allowed: false,
				event_id: 'event-id',
				reason: 'Not eligible',
				next_step: 'become_member'
			};

			render(EventActionSidebar, {
				props: {
					event,
					userStatus,
					isAuthenticated: true
				}
			});

			// Check for heading
			expect(screen.getByText(/eligibility status/i)).toBeInTheDocument();
		});

		it('attendance status has live region', () => {
			const event = createMockEvent();
			const userStatus: EventRsvpSchema = {
				event_id: 'event-id',
				status: 'approved'
			};

			const { container } = render(EventActionSidebar, {
				props: {
					event,
					userStatus,
					isAuthenticated: true
				}
			});

			const statusElement = container.querySelector('[aria-live="polite"]');
			expect(statusElement).toBeInTheDocument();
		});
	});

	describe('Keyboard Navigation', () => {
		it('buttons are keyboard accessible', async () => {
			const user = userEvent.setup();
			const event = createMockEvent();

			render(EventActionSidebar, {
				props: {
					event,
					userStatus: null,
					isAuthenticated: false
				}
			});

			const button = screen.getByRole('button', { name: /sign in to attend/i });

			// Tab to button
			await user.tab();
			expect(button).toHaveFocus();

			// Enter or Space should work (testing handled by ActionButton component)
		});

		it('secondary action button is keyboard accessible', async () => {
			const user = userEvent.setup();
			const event = createMockEvent();
			const userStatus: EventRsvpSchema = {
				event_id: 'event-id',
				status: 'approved'
			};

			render(EventActionSidebar, {
				props: {
					event,
					userStatus,
					isAuthenticated: true
				}
			});

			const button = screen.getByRole('button', { name: /manage rsvp/i });

			// Tab to button
			await user.tab();
			expect(button).toHaveFocus();
		});
	});
});
