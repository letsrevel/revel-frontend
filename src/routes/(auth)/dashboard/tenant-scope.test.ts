import { render, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import RsvpsPage from './rsvps/+page.svelte';
import PassesPage from './passes/+page.svelte';
import TicketsPage from './tickets/+page.svelte';
import InvitationsPage from './invitations/+page.svelte';
import FollowingPage from './following/+page.svelte';

// Tenant-scoped "my" dashboards (#1056): on a custom domain every call carries
// `organization: tenant.id`; on the platform host the param is absent.

const mocks = vi.hoisted(() => ({
	rsvps: vi.fn(),
	tickets: vi.fn(),
	passes: vi.fn(),
	invitations: vi.fn(),
	following: vi.fn(),
	pageData: { value: {} as Record<string, unknown> }
}));

vi.mock('$lib/api/generated/sdk.gen', async (orig) => ({
	...(await orig<Record<string, unknown>>()),
	dashboardDashboardRsvps: mocks.rsvps,
	dashboardDashboardTickets: mocks.tickets,
	dashboardDashboardInvitations: mocks.invitations,
	seriespassListMySeriesPasses: mocks.passes,
	followingListFollowedOrganizations: mocks.following
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
	page: {
		url: new URL('http://localhost/dashboard'),
		get data() {
			return mocks.pageData.value;
		}
	}
}));

const EMPTY = { data: { count: 0, next: null, previous: null, results: [] }, error: undefined };

function renderPage(component: unknown) {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return render(QueryClientTestWrapper, {
		props: { client, component, componentProps: {} }
	});
}

describe.each([
	['rsvps', RsvpsPage, () => mocks.rsvps],
	['passes', PassesPage, () => mocks.passes],
	['tickets', TicketsPage, () => mocks.tickets],
	['invitations', InvitationsPage, () => mocks.invitations],
	['following', FollowingPage, () => mocks.following]
] as const)('dashboard %s tenant scoping', (_name, Page, getMock) => {
	beforeEach(() => {
		mocks.rsvps.mockReset().mockResolvedValue(EMPTY);
		mocks.tickets.mockReset().mockResolvedValue(EMPTY);
		mocks.passes.mockReset().mockResolvedValue(EMPTY);
		mocks.invitations.mockReset().mockResolvedValue(EMPTY);
		mocks.following.mockReset().mockResolvedValue(EMPTY);
	});

	it('passes the tenant organization on a tenant host', async () => {
		mocks.pageData.value = { tenant: { id: 'org-tenant' } };
		renderPage(Page);
		await waitFor(() => expect(getMock()).toHaveBeenCalled());
		for (const call of getMock().mock.calls) {
			expect(call[0].query.organization).toBe('org-tenant');
		}
	});

	it('sends no organization on the platform host', async () => {
		mocks.pageData.value = { tenant: null };
		renderPage(Page);
		await waitFor(() => expect(getMock()).toHaveBeenCalled());
		for (const call of getMock().mock.calls) {
			expect(call[0].query).not.toHaveProperty('organization');
		}
	});
});
