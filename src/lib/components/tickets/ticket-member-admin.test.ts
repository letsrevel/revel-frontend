import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';

const sdk = vi.hoisted(() => ({
	organizationadminmemberinvitationsCreateMemberInvitation: vi.fn(),
	organizationadminblacklistCreateBlacklistEntry: vi.fn()
}));
vi.mock('$lib/api', () => sdk);
vi.mock('$lib/api/client', () => ({ client: {} }));
vi.mock('$app/navigation', () => ({ invalidateAll: vi.fn() }));
vi.mock('$lib/queries/membership-tiers', () => ({ listStandardTiers: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), info: vi.fn(), error: vi.fn() }));
vi.mock('svelte-sonner', () => ({ toast }));

import InviteMemberHarness from './InviteMemberHarness.svelte';

const create = sdk.organizationadminmemberinvitationsCreateMemberInvitation;
const onDone = vi.fn();

function setup() {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	const invalidate = vi.spyOn(client, 'invalidateQueries');
	render(QueryClientTestWrapper, {
		props: { client, component: InviteMemberHarness as never, componentProps: { onDone } }
	});
	return { invalidate, user: userEvent.setup() };
}

beforeEach(() => {
	create.mockReset();
	onDone.mockReset();
	for (const fn of Object.values(toast)) fn.mockReset();
});

describe('createInviteMemberMutation', () => {
	it('toasts success, refreshes the invitations list and calls onDone', async () => {
		create.mockResolvedValue({ data: { id: 'i1' }, response: { status: 201 } });
		const { user, invalidate } = setup();
		await user.click(screen.getByRole('button', { name: 'Invite' }));
		await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
		expect(create).toHaveBeenCalledWith(
			expect.objectContaining({
				path: { slug: 'acme' },
				body: { user_id: 'u1', tier_id: 't1' }
			})
		);
		expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Ada Lovelace'));
		const keys = invalidate.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));
		expect(keys).toContain(JSON.stringify(['organization', 'acme', 'member-invitations']));
	});

	it('already_member: an info toast, then onDone', async () => {
		create.mockResolvedValue({
			error: { detail: 'Translated, never matched.', code: 'already_member' },
			response: { status: 400 }
		});
		const { user } = setup();
		await user.click(screen.getByRole('button', { name: 'Invite' }));
		await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
		expect(toast.info).toHaveBeenCalledWith('This user is already a member.');
		expect(toast.success).not.toHaveBeenCalled();
		expect(toast.error).not.toHaveBeenCalled();
	});

	it('a generic error toasts the backend detail and leaves the modal open', async () => {
		create.mockResolvedValue({
			error: { detail: 'Tier is not available.' },
			response: { status: 400 }
		});
		const { user } = setup();
		await user.click(screen.getByRole('button', { name: 'Invite' }));
		await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Tier is not available.'));
		expect(onDone).not.toHaveBeenCalled();
	});

	it('falls back to the generic message when the backend sends no detail', async () => {
		create.mockResolvedValue({ error: {}, response: { status: 500 } });
		const { user } = setup();
		await user.click(screen.getByRole('button', { name: 'Invite' }));
		await waitFor(() =>
			expect(toast.error).toHaveBeenCalledWith('Failed to send the invitation. Please try again.')
		);
		expect(onDone).not.toHaveBeenCalled();
	});

	it('404 (guest checkout or unverified email): explains it and suggests an invite link', async () => {
		create.mockResolvedValue({ error: { detail: 'Not found.' }, response: { status: 404 } });
		const { user } = setup();
		await user.click(screen.getByRole('button', { name: 'Invite' }));
		await waitFor(() =>
			expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Share an invite link'))
		);
		expect(toast.error).not.toHaveBeenCalledWith('Not found.');
		expect(onDone).not.toHaveBeenCalled();
	});
});
