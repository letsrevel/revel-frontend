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

describe('EventDetails', () => {
	it('renders the description', () => {
		render(EventDetails, { props: { event: createMockEvent() } });
		expect(screen.getByText('A test event')).toBeInTheDocument();
	});

	// The metadata grid moved out: date, location, type and capacity live in the
	// sidebar's EventQuickInfo, so they must not be repeated here.
	it('does not repeat the event metadata grid', () => {
		render(EventDetails, {
			props: { event: createMockEvent({ max_attendees: 50, attendee_count: 45 }) }
		});
		expect(screen.queryByText(/Only 5 spots left/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/Ends/i)).not.toBeInTheDocument();
	});

	it('shows the invitation message only for private events', () => {
		render(EventDetails, {
			props: {
				event: createMockEvent({ visibility: 'private', invitation_message: 'Come along!' })
			}
		});
		expect(screen.getByText('Come along!')).toBeInTheDocument();
	});

	it('hides the invitation message on public events', () => {
		render(EventDetails, {
			props: { event: createMockEvent({ visibility: 'public', invitation_message: 'Come along!' }) }
		});
		expect(screen.queryByText('Come along!')).not.toBeInTheDocument();
	});
});
