import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import EventDetails from './EventDetails.svelte';
import type { EventDetailSchema } from '$lib/api/generated/types.gen';

function createMockEvent(overrides: Partial<EventDetailSchema> = {}): EventDetailSchema {
	return {
		id: '123e4567-e89b-12d3-a456-426614174000',
		name: 'Test Event',
		slug: 'test-event',
		description: 'A test event',
		invitation_message: null,
		start: '2025-12-01T18:00:00Z',
		end: '2025-12-01T22:00:00Z',
		rsvp_before: null,
		max_attendees: 0,
		attendee_count: 0,
		waitlist_open: false,
		event_type: 'public',
		visibility: 'public',
		status: 'approved',
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
			website: null,
			instagram: null,
			facebook: null,
			linkedin: null,
			twitter: null,
			member_count: 10
		},
		event_series: null,
		is_open_ended: false,
		...overrides
	} as EventDetailSchema;
}

describe('EventDetails — open-ended end display', () => {
	it('shows the end time for a timed event', () => {
		render(EventDetails, { props: { event: createMockEvent() } });
		expect(screen.getByText(/Ends/i)).toBeInTheDocument();
	});

	it('hides the end time and shows the open-ended hint when is_open_ended', () => {
		render(EventDetails, { props: { event: createMockEvent({ is_open_ended: true }) } });
		expect(screen.queryByText(/Ends/i)).not.toBeInTheDocument();
		expect(screen.getByText(/Open-ended/i)).toBeInTheDocument();
	});
});
