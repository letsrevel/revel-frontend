import { render, screen, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import MembershipRequestsTab from './MembershipRequestsTab.svelte';
import type {
	MembershipTierSchema,
	OrganizationAdminDetailSchema,
	OrganizationMembershipRequestRetrieve
} from '$lib/api/generated/types.gen';

vi.mock('$lib/api/generated/sdk.gen', () => ({
	organizationadminmembershiprequestsListMembershipRequests: vi.fn(),
	organizationadminmembershiprequestsApproveMembershipRequest: vi.fn(),
	organizationadminmembershiprequestsRejectMembershipRequest: vi.fn()
}));
import {
	organizationadminmembershiprequestsListMembershipRequests,
	organizationadminmembershiprequestsApproveMembershipRequest
} from '$lib/api/generated/sdk.gen';

vi.mock('svelte-sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
import { toast } from 'svelte-sonner';

vi.mock('$lib/stores/auth.svelte', () => ({ authStore: { accessToken: 'test-token' } }));

const organization = { slug: 'test-org' } as unknown as OrganizationAdminDetailSchema;

const tiers = [
	{ id: 'tier-1', name: 'Gold' },
	{ id: 'tier-2', name: 'Silver' }
] as unknown as MembershipTierSchema[];

const pendingRequest = {
	id: 'req-1',
	status: 'pending',
	message: 'Please let me in',
	created_at: '2026-07-20T10:00:00Z',
	user: {
		id: 'user-1',
		email: 'applicant@example.com',
		first_name: 'Ada',
		last_name: 'Lovelace',
		preferred_name: null,
		pronouns: null,
		profile_picture_url: null,
		profile_picture_thumbnail_url: null,
		profile_picture_preview_url: null
	}
} as unknown as OrganizationMembershipRequestRetrieve;

function listResponse(results: OrganizationMembershipRequestRetrieve[]) {
	return {
		data: { results, count: results.length, next: null, previous: null },
		error: undefined
	};
}

function renderTab(tierList: MembershipTierSchema[] = tiers) {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
	});
	return render(QueryClientTestWrapper, {
		props: {
			client,
			component: MembershipRequestsTab,
			componentProps: { organization, tiers: tierList }
		}
	});
}

/** Last `query` object handed to the list endpoint. */
function lastListQuery() {
	const calls = vi.mocked(organizationadminmembershiprequestsListMembershipRequests).mock.calls;
	const last = calls[calls.length - 1][0] as { query: { status?: string; page: number } };
	return last.query;
}

describe('MembershipRequestsTab filters', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(organizationadminmembershiprequestsListMembershipRequests).mockResolvedValue(
			listResponse([pendingRequest]) as never
		);
	});

	it('renders all six status filters', async () => {
		renderTab();
		await screen.findByRole('button', { name: /^pending/i });
		for (const name of [
			/^pending/i,
			/^approved/i,
			/^completed/i,
			/^rejected/i,
			/^cancelled/i,
			/^all/i
		]) {
			expect(screen.getByRole('button', { name })).toBeInTheDocument();
		}
	});

	it('refetches with status=completed and resets to page 1 when Completed is clicked', async () => {
		const user = userEvent.setup();
		renderTab();
		await screen.findByRole('button', { name: /^completed/i });

		await user.click(screen.getByRole('button', { name: /^completed/i }));

		await waitFor(() => {
			expect(lastListQuery().status).toBe('completed');
		});
		expect(lastListQuery().page).toBe(1);
	});

	it('refetches with status=cancelled when Cancelled is clicked', async () => {
		const user = userEvent.setup();
		renderTab();
		await screen.findByRole('button', { name: /^cancelled/i });

		await user.click(screen.getByRole('button', { name: /^cancelled/i }));

		await waitFor(() => {
			expect(lastListQuery().status).toBe('cancelled');
		});
	});

	it('sends no status filter when All is clicked', async () => {
		const user = userEvent.setup();
		renderTab();
		await screen.findByRole('button', { name: /^all/i });

		await user.click(screen.getByRole('button', { name: /^all/i }));

		await waitFor(() => {
			expect(lastListQuery().status).toBeUndefined();
		});
	});
});

describe('MembershipRequestsTab approve errors', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(organizationadminmembershiprequestsListMembershipRequests).mockResolvedValue(
			listResponse([pendingRequest]) as never
		);
	});

	it('surfaces the backend message in a toast when approve fails', async () => {
		const user = userEvent.setup();
		vi.mocked(organizationadminmembershiprequestsApproveMembershipRequest).mockResolvedValue({
			data: undefined,
			error: { message: 'Tier is archived.' }
		} as never);

		// Single tier → approve goes straight through without opening the modal.
		renderTab([tiers[0]]);

		const approve = await screen.findByRole('button', { name: /approve request from/i });
		await user.click(approve);

		await waitFor(() => {
			expect(toast.error).toHaveBeenCalledWith('Tier is archived.');
		});
	});

	it('falls back to localized copy when the approve error has no backend message', async () => {
		const user = userEvent.setup();
		vi.mocked(organizationadminmembershiprequestsApproveMembershipRequest).mockResolvedValue({
			data: undefined,
			error: {}
		} as never);

		renderTab([tiers[0]]);

		const approve = await screen.findByRole('button', { name: /approve request from/i });
		await user.click(approve);

		await waitFor(() => {
			expect(toast.error).toHaveBeenCalledWith('Could not approve the application.');
		});
	});
});
