import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import EventStatusBadge from './EventStatusBadge.svelte';
import type { EventDetailSchema } from '$lib/api/generated/types.gen';

/**
 * Helper to create a mock event with default values
 */
function createMockEvent(overrides: Partial<EventDetailSchema> = {}): EventDetailSchema {
	return {
		id: '123e4567-e89b-12d3-a456-426614174000',
		name: 'Test Event',
		slug: 'test-event',
		description: 'A test event',
		description_html: '<p>A test event</p>',
		invitation_message: null,
		invitation_message_html: '',
		start: '2025-12-01T18:00:00Z',
		end: '2025-12-01T22:00:00Z',
		rsvp_before: null,
		max_attendees: 0,
		attendee_count: 0,
		waitlist_open: false,
		event_type: 'public',
		visibility: 'public',
		status: 'approved',
		free_for_members: false,
		free_for_staff: false,
		requires_ticket: false,
		potluck_open: false,
		logo: null,
		cover_art: null,
		address: null,
		city: null,
		tags: [],
		organization: {
			id: '456',
			name: 'Test Org',
			slug: 'test-org',
			logo: null,
			description: 'Test organization',
			description_html: '<p>Test organization</p>',
			website: null,
			instagram: null,
			facebook: null,
			linkedin: null,
			twitter: null,
			member_count: 10
		},
		event_series: null,
		...overrides
	};
}

describe('EventStatusBadge', () => {
	beforeEach(() => {
		// Reset timers before each test
		vi.useFakeTimers();
	});

	describe('Cancelled Status', () => {
		it('shows "Cancelled" when event status is rejected', () => {
			const event = createMockEvent({
				status: 'rejected',
				start: '2025-12-01T18:00:00Z',
				end: '2025-12-01T22:00:00Z'
			});

			render(EventStatusBadge, { props: { event } });

			expect(screen.getByRole('status')).toHaveTextContent('Cancelled');
			expect(screen.getByRole('status')).toHaveClass('bg-destructive');
		});
	});

	describe('Full Status', () => {
		it('shows "Full" when event is at capacity', () => {
			const event = createMockEvent({
				max_attendees: 50,
				attendee_count: 50,
				start: '2025-12-01T18:00:00Z',
				end: '2025-12-01T22:00:00Z'
			});

			render(EventStatusBadge, { props: { event } });

			expect(screen.getByRole('status')).toHaveTextContent('Full');
			expect(screen.getByRole('status')).toHaveClass('bg-destructive');
		});

		it('shows "Full" when attendee count exceeds capacity', () => {
			const event = createMockEvent({
				max_attendees: 50,
				attendee_count: 55,
				start: '2025-12-01T18:00:00Z',
				end: '2025-12-01T22:00:00Z'
			});

			render(EventStatusBadge, { props: { event } });

			expect(screen.getByRole('status')).toHaveTextContent('Full');
		});

		it('does not show "Full" when max_attendees is 0 (unlimited)', () => {
			const event = createMockEvent({
				max_attendees: 0,
				attendee_count: 100,
				start: '2025-12-01T18:00:00Z',
				end: '2025-12-01T22:00:00Z'
			});

			render(EventStatusBadge, { props: { event } });

			expect(screen.getByRole('status')).not.toHaveTextContent('Full');
		});

		it('does not show "Full" when max_attendees is null', () => {
			const event = createMockEvent({
				max_attendees: undefined,
				attendee_count: 100,
				start: '2025-12-01T18:00:00Z',
				end: '2025-12-01T22:00:00Z'
			});

			render(EventStatusBadge, { props: { event } });

			expect(screen.getByRole('status')).not.toHaveTextContent('Full');
		});
	});

	describe('Past Status', () => {
		it('shows "Past" when event has ended', () => {
			vi.setSystemTime(new Date('2025-12-02T10:00:00Z'));

			const event = createMockEvent({
				start: '2025-12-01T18:00:00Z',
				end: '2025-12-01T22:00:00Z'
			});

			render(EventStatusBadge, { props: { event } });

			expect(screen.getByRole('status')).toHaveTextContent('Past');
			expect(screen.getByRole('status')).toHaveClass('bg-secondary');
		});
	});

	describe('Ongoing Status', () => {
		it('shows "Ongoing" when current time is during the event', () => {
			vi.setSystemTime(new Date('2025-12-01T20:00:00Z'));

			const event = createMockEvent({
				start: '2025-12-01T18:00:00Z',
				end: '2025-12-01T22:00:00Z'
			});

			render(EventStatusBadge, { props: { event } });

			expect(screen.getByRole('status')).toHaveTextContent('Ongoing');
			expect(screen.getByRole('status')).toHaveClass('bg-green-600');
		});

		it('shows "Ongoing" at the exact start time', () => {
			vi.setSystemTime(new Date('2025-12-01T18:00:00Z'));

			const event = createMockEvent({
				start: '2025-12-01T18:00:00Z',
				end: '2025-12-01T22:00:00Z'
			});

			render(EventStatusBadge, { props: { event } });

			expect(screen.getByRole('status')).toHaveTextContent('Ongoing');
		});

		it('shows "Ongoing" at the exact end time', () => {
			vi.setSystemTime(new Date('2025-12-01T22:00:00Z'));

			const event = createMockEvent({
				start: '2025-12-01T18:00:00Z',
				end: '2025-12-01T22:00:00Z'
			});

			render(EventStatusBadge, { props: { event } });

			expect(screen.getByRole('status')).toHaveTextContent('Ongoing');
		});
	});

	describe('Happening Today Status', () => {
		it('shows "Happening Today" when event starts today but has not started yet', () => {
			vi.setSystemTime(new Date('2025-12-01T12:00:00Z'));

			const event = createMockEvent({
				start: '2025-12-01T18:00:00Z',
				end: '2025-12-01T22:00:00Z'
			});

			render(EventStatusBadge, { props: { event } });

			expect(screen.getByRole('status')).toHaveTextContent('Happening Today');
			expect(screen.getByRole('status')).toHaveClass('bg-green-600');
		});

		it('does not show "Happening Today" for events starting tomorrow', () => {
			vi.setSystemTime(new Date('2025-12-01T12:00:00Z'));

			const event = createMockEvent({
				start: '2025-12-02T18:00:00Z',
				end: '2025-12-02T22:00:00Z'
			});

			render(EventStatusBadge, { props: { event } });

			expect(screen.getByRole('status')).not.toHaveTextContent('Happening Today');
			expect(screen.getByRole('status')).toHaveTextContent('Upcoming');
		});
	});

	describe('Upcoming Status', () => {
		it('shows "Upcoming" for future events not starting today', () => {
			vi.setSystemTime(new Date('2025-12-01T12:00:00Z'));

			const event = createMockEvent({
				start: '2025-12-15T18:00:00Z',
				end: '2025-12-15T22:00:00Z'
			});

			render(EventStatusBadge, { props: { event } });

			expect(screen.getByRole('status')).toHaveTextContent('Upcoming');
			expect(screen.getByRole('status')).toHaveClass('bg-primary');
		});
	});

	describe('Priority Order', () => {
		it('prioritizes "Cancelled" over "Full"', () => {
			const event = createMockEvent({
				status: 'rejected',
				max_attendees: 50,
				attendee_count: 50,
				start: '2025-12-01T18:00:00Z',
				end: '2025-12-01T22:00:00Z'
			});

			render(EventStatusBadge, { props: { event } });

			expect(screen.getByRole('status')).toHaveTextContent('Cancelled');
		});

		it('prioritizes "Full" over "Happening Today"', () => {
			vi.setSystemTime(new Date('2025-12-01T12:00:00Z'));

			const event = createMockEvent({
				max_attendees: 50,
				attendee_count: 50,
				start: '2025-12-01T18:00:00Z',
				end: '2025-12-01T22:00:00Z'
			});

			render(EventStatusBadge, { props: { event } });

			expect(screen.getByRole('status')).toHaveTextContent('Full');
		});

		it('prioritizes "Past" over "Full" (event ended while full)', () => {
			vi.setSystemTime(new Date('2025-12-02T10:00:00Z'));

			const event = createMockEvent({
				max_attendees: 50,
				attendee_count: 50,
				start: '2025-12-01T18:00:00Z',
				end: '2025-12-01T22:00:00Z'
			});

			render(EventStatusBadge, { props: { event } });

			expect(screen.getByRole('status')).toHaveTextContent('Past');
		});
	});

	describe('Accessibility', () => {
		it('has role="status" for screen readers', () => {
			const event = createMockEvent();

			render(EventStatusBadge, { props: { event } });

			expect(screen.getByRole('status')).toBeInTheDocument();
		});

		it('has aria-live="polite" for dynamic updates', () => {
			const event = createMockEvent();

			render(EventStatusBadge, { props: { event } });

			expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
		});

		it('icons have aria-hidden="true"', () => {
			const event = createMockEvent();

			const { container } = render(EventStatusBadge, { props: { event } });

			const icon = container.querySelector('svg');
			expect(icon).toHaveAttribute('aria-hidden', 'true');
		});

		it('status is conveyed by text, not just color', () => {
			const event = createMockEvent();

			render(EventStatusBadge, { props: { event } });

			const badge = screen.getByRole('status');
			// Text content should be meaningful
			expect(badge.textContent).toMatch(/Upcoming|Happening Today|Ongoing|Past|Full|Cancelled/);
		});
	});

	describe('Custom className', () => {
		it('applies custom className', () => {
			const event = createMockEvent();

			render(EventStatusBadge, { props: { event, class: 'custom-class mb-4' } });

			expect(screen.getByRole('status')).toHaveClass('custom-class', 'mb-4');
		});

		it('merges custom className with base classes', () => {
			const event = createMockEvent();

			render(EventStatusBadge, { props: { event, class: 'ml-2' } });

			const badge = screen.getByRole('status');
			expect(badge).toHaveClass('ml-2');
			expect(badge).toHaveClass('inline-flex', 'items-center', 'rounded-full');
		});
	});
});
