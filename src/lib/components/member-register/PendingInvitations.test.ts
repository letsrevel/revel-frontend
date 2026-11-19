import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import type { MemberInvitationSchema } from '$lib/api/generated/types.gen';

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

const page = (results: MemberInvitationSchema[]) => ({
	data: { count: results.length, next: null, previous: null, results },
	response: { status: 200 }
});

function setup() {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	const invalidate = vi.spyOn(client, 'invalidateQueries');
	render(QueryClientTestWrapper, {
		props: {
			client,
			component: PendingInvitations as never,
			componentProps: { slug: 'acme', accessToken: 'tok' }
		}
	});
	return { invalidate, user: userEvent.setup() };
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
});
