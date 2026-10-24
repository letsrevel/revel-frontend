import { render, screen } from '@testing-library/svelte';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import DashboardUpcomingEvents from './DashboardUpcomingEvents.svelte';

const pageData = vi.hoisted(() => ({
	value: {} as { tenant: { id: string; slug: string; name: string } | null }
}));
const TENANT = { id: 't1', slug: 'night-owls', name: 'Night Owls' };

vi.mock('$app/state', () => ({
	page: {
		get url() {
			return new URL('https://letsrevel.io/dashboard');
		},
		get data() {
			return pageData.value;
		}
	}
}));

describe('DashboardUpcomingEvents tenant copy', () => {
	beforeEach(() => {
		pageData.value = { tenant: null };
	});

	it('keeps the platform copy and has no action when tenant is null', () => {
		render(DashboardUpcomingEvents, { upcomingEvents: [], isLoading: false });
		expect(screen.getByRole('heading', { name: 'Discover Events' })).toBeInTheDocument();
		expect(screen.getByText('No events available')).toBeInTheDocument();
		expect(
			screen.getByText('Check back soon for upcoming events in your area!')
		).toBeInTheDocument();
		expect(screen.queryByRole('link', { name: 'See past events' })).not.toBeInTheDocument();
	});

	it('uses the org-scoped copy and a past-events link on a tenant host', () => {
		pageData.value = { tenant: TENANT };
		render(DashboardUpcomingEvents, { upcomingEvents: [], isLoading: false });
		expect(screen.getByRole('heading', { name: 'Upcoming events' })).toBeInTheDocument();
		expect(screen.queryByText('Discover Events')).not.toBeInTheDocument();
		expect(screen.getByText('No upcoming events')).toBeInTheDocument();
		expect(
			screen.getByText('Night Owls has no upcoming events right now. Check back soon!')
		).toBeInTheDocument();
		const link = screen.getByRole('link', { name: 'See past events' });
		expect(link).toHaveAttribute('href', '/#events-heading');
	});
});
