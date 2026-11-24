import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import * as m from '$lib/paraglide/messages.js';
import RsvpsPage from './rsvps/+page.svelte';
import TicketsPage from './tickets/+page.svelte';

// #1290: the empty state must show the "nothing yet" copy when no filter is
// active, and the "adjust your filters" copy only when one is.

const mocks = vi.hoisted(() => ({
	rsvps: vi.fn(),
	tickets: vi.fn(),
	passes: vi.fn()
}));

vi.mock('$lib/api/generated/sdk.gen', async (orig) => ({
	...(await orig<Record<string, unknown>>()),
	dashboardDashboardRsvps: mocks.rsvps,
	dashboardDashboardTickets: mocks.tickets,
	seriespassListMySeriesPasses: mocks.passes
}));
vi.mock('$lib/api', async (orig) => ({
	...(await orig<Record<string, unknown>>()),
	seriespassListMySeriesPasses: mocks.passes
}));
vi.mock('$lib/stores/auth.svelte', () => ({
	authStore: { accessToken: 'tok', user: null, permissions: null }
}));
vi.mock('$app/navigation', () => ({ goto: vi.fn(), invalidateAll: vi.fn() }));
vi.mock('$app/state', () => ({
	page: { url: new URL('http://localhost/dashboard'), data: {} }
}));

const EMPTY = { data: { count: 0, next: null, previous: null, results: [] }, error: undefined };

function renderPage(component: unknown) {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return render(QueryClientTestWrapper, {
		props: { client, component, componentProps: {} }
	});
}

describe.each([
	[
		'tickets',
		TicketsPage,
		m['dashboardTicketsPage.emptyHint'](),
		m['dashboardTicketsPage.noResultsFiltered'](),
		m['dashboardTicketsPage.browseEvents'](),
		m['dashboardTicketsPage.clearFilters']()
	],
	[
		'rsvps',
		RsvpsPage,
		m['dashboardRsvpsPage.emptyHint'](),
		m['dashboardRsvpsPage.noResultsFiltered'](),
		m['dashboardRsvpsPage.browseEvents'](),
		m['dashboardRsvpsPage.clearFilters']()
	]
])('%s page empty state', (_name, Page, emptyHint, filteredCopy, browse, clear) => {
	beforeEach(() => {
		mocks.rsvps.mockReset().mockResolvedValue(EMPTY);
		mocks.tickets.mockReset().mockResolvedValue(EMPTY);
		mocks.passes.mockReset().mockResolvedValue(EMPTY);
	});

	it('shows the unfiltered copy and a browse action when no filter is active', async () => {
		renderPage(Page);

		expect(await screen.findByText(emptyHint)).toBeInTheDocument();
		expect(screen.queryByText(filteredCopy)).not.toBeInTheDocument();
		expect(screen.getByRole('link', { name: browse })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: clear })).not.toBeInTheDocument();
	});

	it('shows the filtered copy and a clear action once a search is applied', async () => {
		renderPage(Page);
		await screen.findByText(emptyHint);

		await userEvent.type(screen.getByRole('searchbox'), 'zzz');

		await waitFor(() => expect(screen.getByText(filteredCopy)).toBeInTheDocument(), {
			timeout: 2000
		});
		expect(screen.queryByText(emptyHint)).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: clear })).toBeInTheDocument();
	});
});
