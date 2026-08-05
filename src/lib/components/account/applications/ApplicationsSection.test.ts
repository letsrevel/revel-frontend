import { render, screen, waitFor, within } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import ApplicationsSection from './ApplicationsSection.svelte';
import type { MembershipApplicationSchema } from '$lib/api/generated/types.gen';

const listMock = vi.hoisted(() => vi.fn());
const getApplicationMock = vi.hoisted(() => vi.fn());
vi.mock('$lib/api/generated/sdk.gen', () => ({
	memembershipapplicationsListApplications: listMock,
	memembershipapplicationsGetApplication: getApplicationMock
}));
vi.mock('$lib/stores/auth.svelte', () => ({ authStore: { accessToken: 'tok' } }));

function makeApplication(
	overrides: Partial<MembershipApplicationSchema> = {}
): MembershipApplicationSchema {
	return {
		id: 'app-1',
		organization_id: 'org-1',
		organization_name: 'Acme',
		organization_slug: 'acme',
		organization_logo_url: null,
		tier_id: null,
		tier_name: null,
		plan_id: null,
		subscription_id: null,
		questionnaire_submission_id: null,
		status: 'pending',
		message: null,
		created_at: '2026-07-01T00:00:00Z',
		updated_at: '2026-07-01T00:00:00Z',
		...overrides
	};
}

function mockList(results: MembershipApplicationSchema[]) {
	listMock.mockResolvedValue({
		data: { count: results.length, next: null, previous: null, results },
		error: undefined
	});
}

describe('ApplicationsSection', () => {
	let queryClient: QueryClient;

	function renderSection() {
		return render(QueryClientTestWrapper, {
			props: { client: queryClient, component: ApplicationsSection, componentProps: {} }
		});
	}

	beforeEach(() => {
		listMock.mockReset();
		// Rows advance themselves; keep the read inert so grouping is the only variable.
		getApplicationMock.mockReset().mockImplementation(
			() =>
				new Promise(() => {
					/* never settles: the per-row advance stays in flight */
				})
		);
		queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
		});
	});

	it('splits open applications from closed ones under their own headings', async () => {
		mockList([
			makeApplication({ id: 'a', organization_name: 'Open Pending' }),
			makeApplication({ id: 'b', organization_name: 'Open Approved', status: 'approved' }),
			makeApplication({ id: 'c', organization_name: 'Done Rejected', status: 'rejected' }),
			makeApplication({ id: 'd', organization_name: 'Done Cancelled', status: 'cancelled' }),
			makeApplication({ id: 'e', organization_name: 'Done Completed', status: 'completed' })
		]);
		renderSection();

		const inProgress = await screen.findByRole('list', { name: 'In progress' });
		expect(within(inProgress).getAllByRole('listitem')).toHaveLength(2);
		expect(within(inProgress).getByText('Open Pending')).toBeInTheDocument();
		expect(within(inProgress).getByText('Open Approved')).toBeInTheDocument();

		const closed = screen.getByRole('list', { name: 'Closed' });
		expect(within(closed).getAllByRole('listitem')).toHaveLength(3);
		expect(within(closed).getByText('Done Completed')).toBeInTheDocument();
	});

	it('nests the group headings under the section heading', async () => {
		mockList([makeApplication()]);
		renderSection();

		// The section heading paints before the list resolves, so wait on the group
		// heading — otherwise this asserts against the loading state.
		expect(await screen.findByRole('heading', { level: 3, name: 'In progress' })).toBeVisible();
		expect(screen.getByRole('heading', { level: 2, name: 'Applications' })).toBeVisible();
	});

	it('omits a group with no rows', async () => {
		mockList([makeApplication({ status: 'rejected' })]);
		renderSection();

		expect(await screen.findByRole('list', { name: 'Closed' })).toBeInTheDocument();
		expect(screen.queryByRole('list', { name: 'In progress' })).toBeNull();
	});

	it('invites the member to apply somewhere when the list is empty', async () => {
		mockList([]);
		renderSection();

		// The EmptyState splits into a title (h3) + body paragraph, both of which
		// contain "no applications yet" — target the heading so the query doesn't
		// ambiguously match both.
		expect(
			await screen.findByRole('heading', { level: 3, name: /no applications yet/i })
		).toBeInTheDocument();
		expect(screen.getByText(/when you apply to join an organization/i)).toBeInTheDocument();
		expect(screen.queryByRole('list', { name: 'In progress' })).toBeNull();
	});

	it('says the list failed instead of claiming there are no applications', async () => {
		// The queryFn throws on `res.error`, so an errored response and a rejected
		// call land in the same place — mirror the SDK's own `{ error }` shape.
		listMock.mockResolvedValue({ data: undefined, error: { detail: 'boom' } });
		renderSection();

		expect(await screen.findByText(/could not load your applications/i)).toBeInTheDocument();
		expect(screen.queryByText(/no applications yet/i)).toBeNull();
	});

	it('announces the load failure instead of swapping it in silently', async () => {
		// The error replaces the spinner *after* first paint, so a member who has
		// already tabbed on never hears it without a live region.
		listMock.mockResolvedValue({ data: undefined, error: { detail: 'boom' } });
		renderSection();

		const alert = await screen.findByRole('alert');
		expect(alert).toHaveTextContent(/could not load your applications/i);
	});

	it('keeps the loaded rows when a background refetch fails', async () => {
		// A refetch that fails must not throw away rows the member is already
		// reading: the error state is for "nothing to show", not "the last poll
		// blipped".
		listMock.mockResolvedValueOnce({
			data: { count: 1, next: null, previous: null, results: [makeApplication()] },
			error: undefined
		});
		listMock.mockResolvedValue({ data: undefined, error: { detail: 'boom' } });
		renderSection();

		await screen.findByRole('list', { name: 'In progress' });
		await queryClient.refetchQueries({ queryKey: ['me', 'applications'] });

		await waitFor(() => {
			expect(queryClient.getQueryState(['me', 'applications'])?.status).toBe('error');
		});
		expect(screen.getByRole('list', { name: 'In progress' })).toBeInTheDocument();
		expect(screen.queryByText(/could not load your applications/i)).toBeNull();
	});

	it('requests a single generous page of applications', async () => {
		mockList([]);
		renderSection();

		await screen.findByRole('heading', { level: 3, name: /no applications yet/i });
		expect(listMock).toHaveBeenCalledWith(expect.objectContaining({ query: { page_size: 50 } }));
	});
});
