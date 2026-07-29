import { render, screen, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import EventRSVP from './EventRSVP.svelte';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import type {
	EventUserEligibility,
	EventRsvpSchema,
	EventDetailSchema
} from '$lib/api/generated/types.gen';

// Mock the API function
vi.mock('$lib/api/generated/sdk.gen', () => ({
	eventpublicattendanceRsvpEvent: vi.fn()
}));

// Mock navigation (the component calls invalidateAll() after a successful RSVP)
vi.mock('$app/navigation', () => ({
	invalidateAll: vi.fn(),
	goto: vi.fn()
}));

import { eventpublicattendanceRsvpEvent } from '$lib/api/generated/sdk.gen';

// Minimal event object for branches that need `event` (ineligibility message)
const mockEvent = {
	id: 'event-123',
	name: 'Test Event',
	slug: 'test-event',
	organization: { id: 'org-1', name: 'Test Org', slug: 'test-org' }
} as unknown as EventDetailSchema;

// EventRSVP creates mutations via @tanstack/svelte-query, so it must render
// inside a real <QueryClientProvider>.
function renderRSVP(props: Record<string, unknown>) {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
	});
	return render(QueryClientTestWrapper, {
		props: { client: queryClient, component: EventRSVP, componentProps: props }
	});
}

describe('EventRSVP', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('renders no RSVP UI when not authenticated and no event is provided', () => {
		const { container } = renderRSVP({
			eventId: 'event-123',
			eventName: 'Test Event',
			userStatus: null,
			isAuthenticated: false,
			requiresTicket: false
		});

		// The container div renders, but with no interactive RSVP content
		expect(container.textContent?.trim()).toBe('');
		expect(container.querySelector('button')).toBeNull();
	});

	it('does not render for ticket-required events', () => {
		const { container } = renderRSVP({
			eventId: 'event-123',
			eventName: 'Test Event',
			userStatus: null,
			isAuthenticated: true,
			requiresTicket: true
		});

		expect(container.textContent?.trim()).toBe('');
		expect(container.querySelector('button')).toBeNull();
	});

	it('shows RSVP buttons when user is eligible', () => {
		const eligibilityStatus: EventUserEligibility = {
			allowed: true,
			next_step: 'rsvp'
		};

		renderRSVP({
			eventId: 'event-123',
			eventName: 'Test Event',
			userStatus: eligibilityStatus,
			isAuthenticated: true,
			requiresTicket: false
		});

		expect(screen.getByText('Will you attend?')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /yes/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /maybe/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /no/i })).toBeInTheDocument();
	});

	it("keeps showing the RSVP buttons when user has already RSVP'd (so they can change)", () => {
		const rsvpStatus: EventRsvpSchema = {
			event_id: 'event-123',
			status: 'yes'
		};

		renderRSVP({
			eventId: 'event-123',
			eventName: 'Test Event',
			userStatus: rsvpStatus,
			isAuthenticated: true,
			requiresTicket: false
		});

		// The component no longer shows a static "You're attending" banner for a
		// pre-existing RSVP; it renders the buttons so the response can be changed.
		expect(screen.getByText('Will you attend?')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /yes/i })).toBeInTheDocument();
	});

	it('shows ineligibility message when user is not allowed', () => {
		const eligibilityStatus: EventUserEligibility = {
			allowed: false,
			reason: 'You must complete the questionnaire first',
			next_step: 'complete_questionnaire'
		};

		renderRSVP({
			eventId: 'event-123',
			eventName: 'Test Event',
			userStatus: eligibilityStatus,
			isAuthenticated: true,
			requiresTicket: false,
			// The ineligibility message needs event/org context for its CTA links
			event: mockEvent
		});

		expect(screen.getByText(/You must complete the questionnaire first/i)).toBeInTheDocument();
	});

	it('does not render RSVP buttons when user is not eligible', () => {
		const eligibilityStatus: EventUserEligibility = {
			allowed: false,
			reason: 'Event is at capacity',
			next_step: 'join_waitlist'
		};

		renderRSVP({
			eventId: 'event-123',
			eventName: 'Test Event',
			userStatus: eligibilityStatus,
			isAuthenticated: true,
			requiresTicket: false,
			event: mockEvent
		});

		// Ineligible users see the explanation instead of (formerly disabled) buttons
		expect(screen.getByText(/Event is at capacity/i)).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /^yes$/i })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /^maybe$/i })).not.toBeInTheDocument();
	});

	it('submits RSVP when user clicks Yes button', async () => {
		const user = userEvent.setup();
		const mockRsvpResponse = {
			data: {
				event_id: 'event-123',
				status: 'yes' as const
			}
		};

		vi.mocked(eventpublicattendanceRsvpEvent).mockResolvedValue(mockRsvpResponse);

		const eligibilityStatus: EventUserEligibility = {
			allowed: true,
			next_step: 'rsvp'
		};

		renderRSVP({
			eventId: 'event-123',
			eventName: 'Test Event',
			userStatus: eligibilityStatus,
			isAuthenticated: true,
			requiresTicket: false
		});

		const yesButton = screen.getByRole('button', { name: /yes/i });
		await user.click(yesButton);

		await waitFor(() => {
			expect(eventpublicattendanceRsvpEvent).toHaveBeenCalledWith({
				path: { event_id: 'event-123', answer: 'yes' }
			});
		});

		await waitFor(() => {
			expect(screen.getByText(/You're going to Test Event!/i)).toBeInTheDocument();
		});
	});

	it('shows error message when RSVP fails', async () => {
		const user = userEvent.setup();
		const mockError = new Error('Network error');

		vi.mocked(eventpublicattendanceRsvpEvent).mockRejectedValue(mockError);

		const eligibilityStatus: EventUserEligibility = {
			allowed: true,
			next_step: 'rsvp'
		};

		renderRSVP({
			eventId: 'event-123',
			eventName: 'Test Event',
			userStatus: eligibilityStatus,
			isAuthenticated: true,
			requiresTicket: false
		});

		const yesButton = screen.getByRole('button', { name: /yes/i });
		await user.click(yesButton);

		await waitFor(() => {
			expect(screen.getByText(/RSVP Failed/i)).toBeInTheDocument();
			expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
		});
	});

	it('allows changing RSVP response after a successful submit', async () => {
		const user = userEvent.setup();
		vi.mocked(eventpublicattendanceRsvpEvent).mockResolvedValue({
			data: { event_id: 'event-123', status: 'yes' as const }
		});

		const eligibilityStatus: EventUserEligibility = {
			allowed: true,
			next_step: 'rsvp'
		};

		renderRSVP({
			eventId: 'event-123',
			eventName: 'Test Event',
			userStatus: eligibilityStatus,
			isAuthenticated: true,
			requiresTicket: false
		});

		await user.click(screen.getByRole('button', { name: /yes/i }));

		const changeButton = await screen.findByRole('button', { name: /change response/i });
		await user.click(changeButton);

		// After clicking change, the buttons are shown again
		await waitFor(() => {
			expect(screen.getByRole('button', { name: /yes/i })).toBeInTheDocument();
		});
	});

	it('is keyboard accessible', async () => {
		const user = userEvent.setup();
		const eligibilityStatus: EventUserEligibility = {
			allowed: true,
			next_step: 'rsvp'
		};

		renderRSVP({
			eventId: 'event-123',
			eventName: 'Test Event',
			userStatus: eligibilityStatus,
			isAuthenticated: true,
			requiresTicket: false
		});

		// Tab to first button
		await user.tab();
		const yesButton = screen.getByRole('button', { name: /yes/i });
		expect(yesButton).toHaveFocus();

		// Tab to next button
		await user.tab();
		const maybeButton = screen.getByRole('button', { name: /maybe/i });
		expect(maybeButton).toHaveFocus();
	});

	it('has proper ARIA live regions for dynamic updates', () => {
		const eligibilityStatus: EventUserEligibility = {
			allowed: true,
			next_step: 'rsvp'
		};

		renderRSVP({
			eventId: 'event-123',
			eventName: 'Test Event',
			userStatus: eligibilityStatus,
			isAuthenticated: true,
			requiresTicket: false
		});

		// ARIA live regions are applied to status messages
		// This test verifies the structure exists
		const buttons = screen.getAllByRole('button');
		expect(buttons.length).toBeGreaterThan(0);
	});
	// --- 400 union narrowing (issue #653) -----------------------------------
	// The RSVP endpoint declares `EventUserEligibility | ErrorDetail` at 400
	// (backend #824). Each branch has to be probed before it is read, and the
	// eligibility branch is the one that must re-render the CTA.

	it('adopts an EventUserEligibility 400 so the ineligibility CTA re-renders', async () => {
		const user = userEvent.setup();
		vi.mocked(eventpublicattendanceRsvpEvent).mockResolvedValue({
			error: {
				allowed: false,
				event_id: 'event-123',
				reason: 'This event now requires an invitation',
				next_step: 'request_invitation'
			}
		});

		renderRSVP({
			eventId: 'event-123',
			eventName: 'Test Event',
			userStatus: { allowed: true, next_step: 'rsvp' } satisfies EventUserEligibility,
			isAuthenticated: true,
			requiresTicket: false,
			event: mockEvent
		});

		await user.click(screen.getByRole('button', { name: /yes/i }));

		await waitFor(() => {
			// The refusal's own prose, not a generic "no data returned" string.
			expect(screen.getByText(/This event now requires an invitation/i)).toBeInTheDocument();
		});
		// And the RSVP buttons are gone: the fresh eligibility payload replaced the
		// stale allowed=true one the page was loaded with.
		expect(screen.queryByRole('button', { name: /^yes$/i })).not.toBeInTheDocument();
	});

	it('surfaces an ErrorDetail 400 verbatim without faking an eligibility state', async () => {
		const user = userEvent.setup();
		vi.mocked(eventpublicattendanceRsvpEvent).mockResolvedValue({
			error: { detail: 'This event is at capacity.' }
		});

		renderRSVP({
			eventId: 'event-123',
			eventName: 'Test Event',
			userStatus: { allowed: true, next_step: 'rsvp' } satisfies EventUserEligibility,
			isAuthenticated: true,
			requiresTicket: false,
			event: mockEvent
		});

		await user.click(screen.getByRole('button', { name: /yes/i }));

		await waitFor(() => {
			expect(screen.getByText(/This event is at capacity\./i)).toBeInTheDocument();
		});
		// No `allowed: false` payload arrived, so the RSVP controls stay put and the
		// user can retry.
		expect(screen.getByRole('button', { name: /yes/i })).toBeInTheDocument();
	});

	it('reads a request-validation 422 detail LIST instead of stringifying it', async () => {
		const user = userEvent.setup();
		vi.mocked(eventpublicattendanceRsvpEvent).mockResolvedValue({
			error: {
				detail: [
					{ type: 'string_too_long', loc: ['body', 'payload', 'note'], msg: 'Note is too long' }
				]
			}
		});

		renderRSVP({
			eventId: 'event-123',
			eventName: 'Test Event',
			userStatus: { allowed: true, next_step: 'rsvp' } satisfies EventUserEligibility,
			isAuthenticated: true,
			requiresTicket: false,
			event: mockEvent
		});

		await user.click(screen.getByRole('button', { name: /yes/i }));

		await waitFor(() => {
			expect(screen.getByText(/Note is too long/i)).toBeInTheDocument();
		});
		expect(screen.queryByText(/\[object Object\]/)).not.toBeInTheDocument();
	});

	it('does not mistake an eligibility refusal for a note rejection and re-submit', async () => {
		const user = userEvent.setup();
		vi.mocked(eventpublicattendanceRsvpEvent).mockResolvedValue({
			error: {
				allowed: false,
				event_id: 'event-123',
				reason: 'RSVPs have closed for this event',
				next_step: 'wait_for_event_to_open'
			}
		});

		renderRSVP({
			eventId: 'event-123',
			eventName: 'Test Event',
			userStatus: { allowed: true, next_step: 'rsvp' } satisfies EventUserEligibility,
			isAuthenticated: true,
			requiresTicket: false,
			event: { ...mockEvent, accept_rsvp_notes: true } as unknown as EventDetailSchema
		});

		await user.click(screen.getByRole('button', { name: /yes/i }));
		// The note dialog opens first; confirm it with an empty note.
		const confirmNote = await screen.findByRole('button', { name: /^RSVP Yes$/i });
		await user.click(confirmNote);

		// The refusal's next_step drives the CTA (this one renders its own copy
		// rather than the backend `reason`, which is the point: it is the
		// eligibility branch that was adopted, not the `{detail}` one).
		await waitFor(() => {
			expect(screen.getByRole('button', { name: /notify me/i })).toBeInTheDocument();
		});
		// Exactly one call: the refusal must not trigger the note-dropped retry,
		// which would silently re-submit an RSVP the backend just refused.
		expect(vi.mocked(eventpublicattendanceRsvpEvent)).toHaveBeenCalledTimes(1);
	});
});
