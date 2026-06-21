import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import type { EventInListSchema } from '$lib/api/generated/types.gen';
import Page from './+page.svelte';

const organization = { slug: 'acme', name: 'Acme' };

function ev(overrides: Partial<EventInListSchema>): EventInListSchema {
	return {
		id: 'e1',
		name: 'Summer Gala',
		slug: 'summer-gala',
		start: '2026-09-01T18:00:00Z',
		end: '2026-09-01T22:00:00Z',
		status: 'open',
		requires_ticket: true,
		attendee_count: 12,
		timezone: 'UTC',
		...overrides
	} as EventInListSchema;
}

describe('Tickets tab page', () => {
	it('renders the empty state with a link to events when no events', () => {
		render(Page, { props: { data: { organization, events: [] } as never } });
		expect(screen.getByText('No ticketed events yet')).toBeInTheDocument();
		const cta = screen.getByRole('link', { name: 'Go to Events' });
		expect(cta).toHaveAttribute('href', '/org/acme/admin/events');
	});

	it('renders one card per event linking to the per-event tickets page', () => {
		const events = [
			ev({ id: 'A', name: 'Summer Gala' }),
			ev({ id: 'B', name: 'Workshop Night' })
		];
		render(Page, { props: { data: { organization, events } as never } });

		const galaLink = screen.getByRole('link', { name: /Summer Gala/ });
		expect(galaLink).toHaveAttribute('href', '/org/acme/admin/events/A/tickets');
		const workshopLink = screen.getByRole('link', { name: /Workshop Night/ });
		expect(workshopLink).toHaveAttribute('href', '/org/acme/admin/events/B/tickets');
	});
});
