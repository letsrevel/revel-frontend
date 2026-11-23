import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import * as m from '$lib/paraglide/messages.js';
import InvitationsPage from './+page.svelte';

// The Sent tab defaults to the "pending" status filter. An empty list under
// that (or any) status filter must say "adjust your filters", not "You haven't
// sent any invitations"; the latter is only true for the "All" chip with no search.

const mocks = vi.hoisted(() => ({
	invitations: vi.fn(),
	requests: vi.fn()
}));

vi.mock('$lib/api/generated/sdk.gen', async (orig) => ({
	...(await orig<Record<string, unknown>>()),
	dashboardDashboardInvitations: mocks.invitations,
	dashboardDashboardInvitationRequests: mocks.requests
}));
vi.mock('$lib/stores/auth.svelte', () => ({
	authStore: { accessToken: 'tok', user: null, permissions: null }
}));
vi.mock('$app/navigation', () => ({ goto: vi.fn(), invalidateAll: vi.fn() }));
vi.mock('$app/state', () => ({
	page: { url: new URL('http://localhost/dashboard/invitations'), data: {} }
}));

const EMPTY = { data: { count: 0, next: null, previous: null, results: [] }, error: undefined };

function renderPage() {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return render(QueryClientTestWrapper, {
		props: { client, component: InvitationsPage, componentProps: {} }
	});
}

describe('invitations page, Sent tab empty state', () => {
	beforeEach(() => {
		mocks.invitations.mockReset().mockResolvedValue(EMPTY);
		mocks.requests.mockReset().mockResolvedValue(EMPTY);
	});

	it('shows the adjust-filters copy under the default pending status filter', async () => {
		renderPage();
		await userEvent.click(screen.getByRole('button', { name: m['dashboard.invitations.sent']() }));

		expect(
			await screen.findByText(m['dashboard.invitations.tryAdjustingFilters']())
		).toBeInTheDocument();
		expect(
			screen.queryByText(m['dashboard.invitations.noSentInvitations']())
		).not.toBeInTheDocument();
	});

	it('shows the "no invitations sent" copy once the All chip is selected', async () => {
		renderPage();
		await userEvent.click(screen.getByRole('button', { name: m['dashboard.invitations.sent']() }));
		await screen.findByText(m['dashboard.invitations.tryAdjustingFilters']());

		await userEvent.click(
			screen.getByRole('button', { name: m['dashboard.tickets.status_all']() })
		);

		await waitFor(() =>
			expect(screen.getByText(m['dashboard.invitations.noSentInvitations']())).toBeInTheDocument()
		);
		expect(
			screen.queryByText(m['dashboard.invitations.tryAdjustingFilters']())
		).not.toBeInTheDocument();
	});
});
