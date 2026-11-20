import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import type {
	MemberInvitationSchema,
	PaginatedResponseSchemaMemberInvitationSchema
} from '$lib/api/generated/types.gen';

const sdk = vi.hoisted(() => ({
	organizationadminmemberinvitationsListMemberInvitations: vi.fn(),
	organizationadminmemberinvitationsRevokeMemberInvitation: vi.fn()
}));
vi.mock('$lib/api', () => sdk);
vi.mock('$lib/api/client', () => ({ client: {} }));
const toast = vi.hoisted(() => ({ success: vi.fn(), info: vi.fn(), error: vi.fn() }));
vi.mock('svelte-sonner', () => ({ toast }));

import PendingInvitations from './PendingInvitations.svelte';

function invitation(id: string, name: string): MemberInvitationSchema {
	return {
		id,
		invitee_id: `u-${id}`,
		invitee_display_name: name,
		tier_id: 't1',
		tier_name: 'Full',
		expires_at: '2026-12-01T12:00:00Z',
		created_at: '2026-11-17T12:00:00Z'
	};
}

interface ListResult {
	data: PaginatedResponseSchemaMemberInvitationSchema;
	response: { status: number };
}

interface Harness {
	invalidate: MockInstance<QueryClient['invalidateQueries']>;
	user: UserEvent;
	client: QueryClient;
}

const page = (results: MemberInvitationSchema[]): ListResult => ({
	data: { count: results.length, next: null, previous: null, results },
	response: { status: 200 }
});

function setup(): Harness {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	const invalidate = vi.spyOn(client, 'invalidateQueries');
	render(QueryClientTestWrapper, {
		props: {
			client,
			component: PendingInvitations as never,
			componentProps: { slug: 'acme', accessToken: 'tok' }
		}
	});
	return { invalidate, user: userEvent.setup(), client };
}

beforeEach(() => {
	for (const fn of Object.values(sdk)) fn.mockReset();
	for (const fn of Object.values(toast)) fn.mockReset();
});

describe('PendingInvitations', () => {
	it('renders nothing when there are no pending invitations', async () => {
		sdk.organizationadminmemberinvitationsListMemberInvitations.mockResolvedValue(page([]));
		setup();
		await waitFor(() =>
			expect(sdk.organizationadminmemberinvitationsListMemberInvitations).toHaveBeenCalled()
		);
		expect(screen.queryByTestId('pending-invitations')).toBeNull();
		expect(screen.queryByText('Pending invitations')).toBeNull();
	});

	it('lists name, tier and expiry with a Withdraw button per row', async () => {
		sdk.organizationadminmemberinvitationsListMemberInvitations.mockResolvedValue(
			page([invitation('i1', 'Ada Lovelace'), invitation('i2', 'Grace Hopper')])
		);
		setup();
		expect(await screen.findByRole('heading', { name: 'Pending invitations' })).toBeInTheDocument();
		const rows = screen.getAllByTestId('pending-invitation');
		expect(rows).toHaveLength(2);
		expect(rows[0]).toHaveTextContent('Ada Lovelace');
		expect(rows[0]).toHaveTextContent('Full');
		expect(rows[0]).toHaveTextContent(/Expires .*2026/);
		expect(
			screen.getByRole('button', { name: 'Withdraw invitation to Grace Hopper' })
		).toBeVisible();
	});

	it('withdraws an invitation, toasts and refreshes the list', async () => {
		sdk.organizationadminmemberinvitationsListMemberInvitations.mockResolvedValue(
			page([invitation('i1', 'Ada Lovelace')])
		);
		sdk.organizationadminmemberinvitationsRevokeMemberInvitation.mockResolvedValue({
			response: { status: 204 }
		});
		const { user, invalidate } = setup();
		await user.click(
			await screen.findByRole('button', { name: 'Withdraw invitation to Ada Lovelace' })
		);
		await waitFor(() => expect(toast.success).toHaveBeenCalled());
		expect(sdk.organizationadminmemberinvitationsRevokeMemberInvitation).toHaveBeenCalledWith(
			expect.objectContaining({ path: { slug: 'acme', invitation_id: 'i1' } })
		);
		const keys = invalidate.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));
		expect(keys).toContain(JSON.stringify(['organization', 'acme', 'member-invitations']));
	});

	it('shows a 404 inline as already accepted or expired', async () => {
		sdk.organizationadminmemberinvitationsListMemberInvitations.mockResolvedValue(
			page([invitation('i1', 'Ada Lovelace')])
		);
		sdk.organizationadminmemberinvitationsRevokeMemberInvitation.mockResolvedValue({
			error: { detail: 'Not found' },
			response: { status: 404 }
		});
		const { user } = setup();
		await user.click(
			await screen.findByRole('button', { name: 'Withdraw invitation to Ada Lovelace' })
		);
		expect(await screen.findByTestId('register-error')).toHaveTextContent(
			'already accepted or has expired'
		);
	});

	it('keeps the 404 explanation visible when the refreshed list is empty', async () => {
		sdk.organizationadminmemberinvitationsListMemberInvitations
			.mockResolvedValueOnce(page([invitation('i1', 'Ada Lovelace')]))
			.mockResolvedValue(page([]));
		sdk.organizationadminmemberinvitationsRevokeMemberInvitation.mockResolvedValue({
			error: { detail: 'Not found' },
			response: { status: 404 }
		});
		const { user } = setup();
		await user.click(
			await screen.findByRole('button', { name: 'Withdraw invitation to Ada Lovelace' })
		);
		await waitFor(() => expect(screen.queryAllByTestId('pending-invitation')).toHaveLength(0));
		expect(screen.getByTestId('register-error')).toHaveTextContent(
			'already accepted or has expired'
		);
		// The focused Withdraw button is gone: focus lands on the section heading, not <body>.
		await waitFor(() =>
			expect(document.activeElement).toBe(
				screen.getByRole('heading', { name: 'Pending invitations' })
			)
		);
	});

	it('shows a load failure with a retry instead of hiding the section', async () => {
		sdk.organizationadminmemberinvitationsListMemberInvitations
			.mockResolvedValueOnce({ error: { detail: 'boom' }, response: { status: 500 } })
			.mockResolvedValue(page([invitation('i1', 'Ada Lovelace')]));
		const { user } = setup();
		expect(await screen.findByTestId('pending-invitations-load-error')).toHaveTextContent(
			"Couldn't load pending invitations."
		);
		await user.click(screen.getByRole('button', { name: 'Try again' }));
		expect(await screen.findByTestId('pending-invitation')).toHaveTextContent('Ada Lovelace');
		expect(screen.queryByTestId('pending-invitations-load-error')).toBeNull();
	});

	it('shows another failure inline', async () => {
		sdk.organizationadminmemberinvitationsListMemberInvitations.mockResolvedValue(
			page([invitation('i1', 'Ada Lovelace')])
		);
		sdk.organizationadminmemberinvitationsRevokeMemberInvitation.mockResolvedValue({
			error: { detail: 'boom' },
			response: { status: 500 }
		});
		const { user } = setup();
		await user.click(
			await screen.findByRole('button', { name: 'Withdraw invitation to Ada Lovelace' })
		);
		expect(await screen.findByTestId('register-error')).toBeInTheDocument();
		expect(toast.success).not.toHaveBeenCalled();
	});

	describe('focus after a withdrawal (WCAG 2.4.3)', () => {
		const ok = { response: { status: 204 } };

		it("moves to the next row's Withdraw button", async () => {
			sdk.organizationadminmemberinvitationsListMemberInvitations
				.mockResolvedValueOnce(
					page([invitation('i1', 'Ada Lovelace'), invitation('i2', 'Grace Hopper')])
				)
				.mockResolvedValue(page([invitation('i2', 'Grace Hopper')]));
			sdk.organizationadminmemberinvitationsRevokeMemberInvitation.mockResolvedValue(ok);
			const { user } = setup();
			await user.click(
				await screen.findByRole('button', { name: 'Withdraw invitation to Ada Lovelace' })
			);
			await waitFor(() =>
				expect(
					screen.getByRole('button', { name: 'Withdraw invitation to Grace Hopper' })
				).toHaveFocus()
			);
		});

		it('moves to the previous row when the last one was withdrawn', async () => {
			sdk.organizationadminmemberinvitationsListMemberInvitations
				.mockResolvedValueOnce(
					page([invitation('i1', 'Ada Lovelace'), invitation('i2', 'Grace Hopper')])
				)
				.mockResolvedValue(page([invitation('i1', 'Ada Lovelace')]));
			sdk.organizationadminmemberinvitationsRevokeMemberInvitation.mockResolvedValue(ok);
			const { user } = setup();
			await user.click(
				await screen.findByRole('button', { name: 'Withdraw invitation to Grace Hopper' })
			);
			await waitFor(() =>
				expect(
					screen.getByRole('button', { name: 'Withdraw invitation to Ada Lovelace' })
				).toHaveFocus()
			);
		});

		it('moves to a stable sr-only target when no rows remain', async () => {
			sdk.organizationadminmemberinvitationsListMemberInvitations
				.mockResolvedValueOnce(page([invitation('i1', 'Ada Lovelace')]))
				.mockResolvedValue(page([]));
			sdk.organizationadminmemberinvitationsRevokeMemberInvitation.mockResolvedValue(ok);
			const { user } = setup();
			await user.click(
				await screen.findByRole('button', { name: 'Withdraw invitation to Ada Lovelace' })
			);
			await waitFor(() => expect(screen.getByTestId('pending-invitations-focus')).toHaveFocus());
			expect(screen.getByTestId('pending-invitations-focus')).toHaveTextContent(
				'No pending invitations.'
			);
		});
	});

	describe('clearing a withdraw failure', () => {
		it('clears a non-404 failure once a refetch brings fresh data', async () => {
			sdk.organizationadminmemberinvitationsListMemberInvitations.mockResolvedValue(
				page([invitation('i1', 'Ada Lovelace')])
			);
			sdk.organizationadminmemberinvitationsRevokeMemberInvitation.mockResolvedValue({
				error: { detail: 'boom' },
				response: { status: 500 }
			});
			const { user, client } = setup();
			await user.click(
				await screen.findByRole('button', { name: 'Withdraw invitation to Ada Lovelace' })
			);
			expect(await screen.findByTestId('register-error')).toBeInTheDocument();
			await client.invalidateQueries({ queryKey: ['organization', 'acme', 'member-invitations'] });
			await waitFor(() => expect(screen.queryByTestId('register-error')).toBeNull());
		});

		it('keeps the accepted-or-expired explanation across later refetches', async () => {
			sdk.organizationadminmemberinvitationsListMemberInvitations
				.mockResolvedValueOnce(page([invitation('i1', 'Ada Lovelace')]))
				.mockResolvedValue(page([]));
			sdk.organizationadminmemberinvitationsRevokeMemberInvitation.mockResolvedValue({
				error: { detail: 'Not found' },
				response: { status: 404 }
			});
			const { user, client } = setup();
			await user.click(
				await screen.findByRole('button', { name: 'Withdraw invitation to Ada Lovelace' })
			);
			await waitFor(() => expect(screen.queryAllByTestId('pending-invitation')).toHaveLength(0));
			await client.invalidateQueries({ queryKey: ['organization', 'acme', 'member-invitations'] });
			expect(screen.getByTestId('register-error')).toHaveTextContent(
				'already accepted or has expired'
			);
		});
	});
});
