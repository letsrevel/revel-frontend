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
	organizationadminmembershiprequestsApproveMembershipRequest,
	organizationadminmembershiprequestsRejectMembershipRequest
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

/**
 * One page of the list endpoint. `count` is the *total* across pages, not the
 * length of `results` — a count above the page size is what makes the tab
 * render its pager, so the page-reset test can actually reach page 2.
 */
function listResponse(
	results: OrganizationMembershipRequestRetrieve[],
	{ count = results.length, next = null as string | null } = {}
) {
	return {
		data: { results, count, next, previous: null },
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

	it('exposes the active filter via aria-pressed, not colour alone', async () => {
		const user = userEvent.setup();
		renderTab();
		await screen.findByRole('button', { name: /^pending/i });

		expect(screen.getByRole('button', { name: /^pending/i })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		expect(screen.getByRole('button', { name: /^rejected/i })).toHaveAttribute(
			'aria-pressed',
			'false'
		);

		await user.click(screen.getByRole('button', { name: /^rejected/i }));

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /^rejected/i })).toHaveAttribute(
				'aria-pressed',
				'true'
			);
		});
		expect(screen.getByRole('button', { name: /^pending/i })).toHaveAttribute(
			'aria-pressed',
			'false'
		);
	});

	it('refetches with status=completed when Completed is clicked', async () => {
		const user = userEvent.setup();
		renderTab();
		await screen.findByRole('button', { name: /^completed/i });

		await user.click(screen.getByRole('button', { name: /^completed/i }));

		await waitFor(() => {
			expect(lastListQuery().status).toBe('completed');
		});
	});

	it('resets to page 1 when a filter is clicked from a deeper page', async () => {
		const user = userEvent.setup();
		// A total above the page size (50) is what makes the pager render at all —
		// with a single-row count the tab never leaves page 1 and the reset this
		// test guards is unobservable.
		vi.mocked(organizationadminmembershiprequestsListMembershipRequests).mockResolvedValue(
			listResponse([pendingRequest], { count: 60, next: 'http://api/next' }) as never
		);
		renderTab();

		await user.click(await screen.findByRole('button', { name: /^next/i }));
		await waitFor(() => {
			expect(lastListQuery().page).toBe(2);
		});

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

describe('MembershipRequestsTab reject errors', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(organizationadminmembershiprequestsListMembershipRequests).mockResolvedValue(
			listResponse([pendingRequest]) as never
		);
	});

	it('surfaces the backend message in a toast when reject fails', async () => {
		const user = userEvent.setup();
		vi.mocked(organizationadminmembershiprequestsRejectMembershipRequest).mockResolvedValue({
			data: undefined,
			error: { message: 'Application already closed.' }
		} as never);

		renderTab();

		const reject = await screen.findByRole('button', { name: /reject request from/i });
		await user.click(reject);

		await waitFor(() => {
			expect(toast.error).toHaveBeenCalledWith('Application already closed.');
		});
	});

	it('falls back to localized copy when the reject error has no backend message', async () => {
		const user = userEvent.setup();
		vi.mocked(organizationadminmembershiprequestsRejectMembershipRequest).mockResolvedValue({
			data: undefined,
			error: {}
		} as never);

		renderTab();

		const reject = await screen.findByRole('button', { name: /reject request from/i });
		await user.click(reject);

		await waitFor(() => {
			expect(toast.error).toHaveBeenCalledWith('Could not reject the application.');
		});
	});
});

describe('MembershipRequestsTab approve tier resolution', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(organizationadminmembershiprequestsApproveMembershipRequest).mockResolvedValue({
			data: {},
			error: undefined
		} as never);
	});

	it('approves directly with an empty body when the application carries a tier', async () => {
		const user = userEvent.setup();
		const tieredRequest = {
			...pendingRequest,
			tier: { id: 't1', name: 'Gold' }
		} as unknown as OrganizationMembershipRequestRetrieve;
		vi.mocked(organizationadminmembershiprequestsListMembershipRequests).mockResolvedValue(
			listResponse([tieredRequest]) as never
		);

		// Two tiers would normally force the picker open — the request's own tier wins.
		renderTab();

		const approve = await screen.findByRole('button', { name: /approve request from/i });
		await user.click(approve);

		await waitFor(() => {
			expect(organizationadminmembershiprequestsApproveMembershipRequest).toHaveBeenCalled();
		});
		const call = vi.mocked(organizationadminmembershiprequestsApproveMembershipRequest).mock
			.calls[0][0] as { body: Record<string, unknown> };
		expect(call.body).toEqual({});
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
	});

	it('opens the tier picker for a tier-less application when several tiers exist', async () => {
		const user = userEvent.setup();
		vi.mocked(organizationadminmembershiprequestsListMembershipRequests).mockResolvedValue(
			listResponse([pendingRequest]) as never
		);

		renderTab();

		const approve = await screen.findByRole('button', { name: /approve request from/i });
		await user.click(approve);

		await screen.findByRole('dialog');
		expect(organizationadminmembershiprequestsApproveMembershipRequest).not.toHaveBeenCalled();
	});
});
