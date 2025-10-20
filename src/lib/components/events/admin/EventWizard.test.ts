import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import EventWizard from './EventWizard.svelte';
import type { OrganizationRetrieveSchema } from '$lib/api/generated/types.gen';

// Mock TanStack Query
vi.mock('@tanstack/svelte-query', () => ({
	createMutation: vi.fn(() => ({
		mutate: vi.fn(),
		mutateAsync: vi.fn(),
		isPending: false,
		isSuccess: false,
		isError: false,
		error: null
	})),
	useQueryClient: vi.fn(() => ({
		invalidateQueries: vi.fn()
	}))
}));

// Mock navigation
vi.mock('$app/navigation', () => ({
	goto: vi.fn()
}));

// Mock API SDK
vi.mock('$lib/api/generated/sdk.gen', () => ({
	organizationadminCreateEvent: vi.fn(),
	eventadminUpdateEvent: vi.fn(),
	eventadminUploadLogo: vi.fn(),
	eventadminUploadCoverArt: vi.fn()
}));

const mockOrganization: OrganizationRetrieveSchema = {
	id: 'org-123',
	name: 'Test Organization',
	slug: 'test-org',
	description: 'A test organization',
	description_html: '<p>A test organization</p>',
	logo: null,
	cover_art: null,
	city: null,
	address: null,
	tags: [],
	visibility: 'public',
	is_stripe_connected: false
};

describe('EventWizard', () => {
	it('renders Step 1 initially', () => {
		render(EventWizard, {
			props: {
				organization: mockOrganization
			}
		});

		expect(screen.getByText('Create New Event')).toBeInTheDocument();
		expect(screen.getByText(/Start with the essentials/i)).toBeInTheDocument();
	});

	it('displays step indicators', () => {
		render(EventWizard, {
			props: {
				organization: mockOrganization
			}
		});

		// Step 1 should be active
		const step1 = screen.getByText('1').closest('div');
		expect(step1).toHaveClass('border-primary');

		// Step 2 should be inactive
		const step2 = screen.getByText('2').closest('div');
		expect(step2).toHaveClass('text-muted-foreground');
	});

	it('shows edit mode when existingEvent is provided', () => {
		render(EventWizard, {
			props: {
				organization: mockOrganization,
				existingEvent: {
					id: 'event-123',
					name: 'Test Event',
					slug: 'test-event',
					start: '2025-12-01T18:00:00Z',
					end: '2025-12-01T20:00:00Z',
					description: 'Test description',
					description_html: '<p>Test description</p>',
					invitation_message: null,
					invitation_message_html: '',
					visibility: 'public',
					event_type: 'public',
					status: 'approved',
					requires_ticket: false,
					free_for_members: false,
					free_for_staff: false,
					potluck_open: false,
					max_attendees: undefined,
					waitlist_open: false,
					rsvp_before: null,
					logo: null,
					cover_art: null,
					city: null,
					address: null,
					tags: [],
					attendee_count: 0,
					organization: mockOrganization,
					event_series: null
				}
			}
		});

		expect(screen.getByText('Edit Event')).toBeInTheDocument();
	});

	it('is keyboard accessible', () => {
		render(EventWizard, {
			props: {
				organization: mockOrganization
			}
		});

		// Check that form inputs are accessible
		const nameInput = screen.getByLabelText(/Event Name/i);
		expect(nameInput).toBeInTheDocument();
		nameInput.focus();
		expect(document.activeElement).toBe(nameInput);
	});
});
