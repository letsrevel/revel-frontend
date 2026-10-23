import { render, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import Page from './+page.svelte';

// Tenant-scoped memberships hub (#1056): `/api/me/{memberships,
// membership-subscriptions,applications}` get `organization` on a tenant host.

const mocks = vi.hoisted(() => ({
	memberships: vi.fn(),
	subscriptions: vi.fn(),
	applications: vi.fn(),
	pageData: { value: {} as Record<string, unknown> }
}));

vi.mock('$lib/api/generated/sdk.gen', async (orig) => ({
	...(await orig<Record<string, unknown>>()),
	mesubscriptionsListMyMemberships: mocks.memberships,
	mesubscriptionsListMySubscriptions: mocks.subscriptions,
	memembershipapplicationsListApplications: mocks.applications
}));
vi.mock('$lib/stores/auth.svelte', () => ({ authStore: { accessToken: 'tok' } }));
vi.mock('$app/navigation', () => ({ invalidateAll: vi.fn() }));
vi.mock('$app/state', () => ({
	page: {
		url: new URL('http://localhost/account/memberships'),
		get data() {
			return mocks.pageData.value;
		}
	}
}));

const EMPTY = { data: { count: 0, next: null, previous: null, results: [] }, error: undefined };

function renderPage() {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return render(QueryClientTestWrapper, {
		props: { client, component: Page, componentProps: {} }
	});
}

describe('account memberships tenant scoping', () => {
	beforeEach(() => {
		for (const fn of [mocks.memberships, mocks.subscriptions, mocks.applications]) {
			fn.mockReset().mockResolvedValue(EMPTY);
		}
	});

	it('passes the tenant organization to all three member endpoints', async () => {
		mocks.pageData.value = { tenant: { id: 'org-tenant' } };
		renderPage();
		for (const fn of [mocks.memberships, mocks.subscriptions, mocks.applications]) {
			await waitFor(() => expect(fn).toHaveBeenCalled());
			expect(fn.mock.calls[0][0].query.organization).toBe('org-tenant');
		}
	});

	it('sends no organization on the platform host', async () => {
		mocks.pageData.value = { tenant: null };
		renderPage();
		for (const fn of [mocks.memberships, mocks.subscriptions, mocks.applications]) {
			await waitFor(() => expect(fn).toHaveBeenCalled());
			expect(fn.mock.calls[0][0].query).not.toHaveProperty('organization');
		}
	});
});
