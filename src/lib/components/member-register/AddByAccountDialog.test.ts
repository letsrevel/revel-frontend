import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import type {
	MembershipRecordSchema,
	MembershipTierSchema,
	OrgUserLookupSchema
} from '$lib/api/generated/types.gen';

const sdk = vi.hoisted(() => ({
	organizationadminuserlookupLookupUser: vi.fn(),
	organizationadminmembersAddMember: vi.fn(),
	organizationadminmemberregisterGetMemberRegisterRecord: vi.fn(),
	organizationadminmemberregisterListMemberRegister: vi.fn()
}));
vi.mock('$lib/api', () => sdk);
vi.mock('$lib/api/client', () => ({ client: {} }));
const toast = vi.hoisted(() => ({ success: vi.fn(), info: vi.fn(), error: vi.fn() }));
vi.mock('svelte-sonner', () => ({ toast }));

import AddByAccountDialog from './AddByAccountDialog.svelte';
import { clearLookupThrottles } from '$lib/member-register/lookup-throttle';

function rec(id: string, extra: Partial<MembershipRecordSchema> = {}): MembershipRecordSchema {
	return {
		id,
		full_name: 'Ada Lovelace',
		email: null,
		tier_name: 'Full',
		tier_id: 't1',
		kind: 'standard',
		source: 'manual',
		valid_from: '2026-01-10T09:30:00Z',
		valid_until: null,
		created_at: '2026-01-10T09:30:00Z',
		has_account: true,
		invite_status: 'linked',
		can_invite: false,
		invite_blocked_reason: null,
		has_duplicate_claim: false,
		user_id: 'u1',
		...extra
	};
}

function tier(id: string, name: string): MembershipTierSchema {
	return { id, name, kind: 'standard' } as MembershipTierSchema;
}

const found = (extra: Partial<OrgUserLookupSchema> = {}) => ({
	data: { user_id: 'u1', display_name: 'Ada Lovelace', is_member: false, ...extra },
	response: { status: 200 }
});
const notFound = {
	error: { detail: 'No such user', code: 'user_not_found' },
	response: { status: 404 }
};

const cb = {
	onClose: vi.fn(),
	onOpenPerson: vi.fn(),
	onOpenApplications: vi.fn(),
	onCreateInviteLink: vi.fn(),
	onOpenTiers: vi.fn()
};

function setup(tiers: MembershipTierSchema[] = [tier('t1', 'Full')]) {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	const invalidate = vi.spyOn(client, 'invalidateQueries');
	const view = render(QueryClientTestWrapper, {
		props: {
			client,
			component: AddByAccountDialog as never,
			componentProps: { open: true, slug: 'acme', accessToken: 'tok', tiers, ...cb }
		}
	});
	return { invalidate, user: userEvent.setup(), view, client };
}

async function lookup(user: ReturnType<typeof userEvent.setup>, email = 'ada@example.org') {
	await user.type(screen.getByLabelText('Account email'), email);
	await user.click(screen.getByRole('button', { name: 'Find account' }));
}

beforeEach(() => {
	clearLookupThrottles();
	for (const fn of Object.values(sdk)) fn.mockReset();
	for (const fn of Object.values(toast)) fn.mockReset();
	for (const fn of Object.values(cb)) fn.mockReset();
});

describe('AddByAccountDialog', () => {
	it('validates an empty and a malformed email client-side', async () => {
		const { user } = setup();
		await user.click(screen.getByRole('button', { name: 'Find account' }));
		expect(screen.getByText('Enter an email address.')).toBeInTheDocument();
		await user.type(screen.getByLabelText('Account email'), 'nope');
		await user.click(screen.getByRole('button', { name: 'Find account' }));
		expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
		expect(sdk.organizationadminuserlookupLookupUser).not.toHaveBeenCalled();
	});

	it('a) not found: neutral copy and the invite-link CTA', async () => {
		sdk.organizationadminuserlookupLookupUser.mockResolvedValue(notFound);
		const { user } = setup();
		await lookup(user);
		expect(await screen.findByTestId('by-account-not-found')).toHaveTextContent(
			'No verified account uses this email'
		);
		await user.click(screen.getByRole('button', { name: 'Create an invite link instead' }));
		expect(cb.onClose).toHaveBeenCalled();
		expect(cb.onCreateInviteLink).toHaveBeenCalledOnce();
		expect(sdk.organizationadminuserlookupLookupUser.mock.calls[0][0].query.email).toBe(
			'ada@example.org'
		);
	});

	it('b) pending application: review button', async () => {
		sdk.organizationadminuserlookupLookupUser.mockResolvedValue(
			found({ pending_request_id: 'p1' })
		);
		const { user } = setup();
		await lookup(user);
		expect(await screen.findByTestId('by-account-pending')).toHaveTextContent(
			'Ada Lovelace has a pending membership application.'
		);
		await user.click(screen.getByRole('button', { name: 'Review application' }));
		expect(cb.onOpenApplications).toHaveBeenCalledOnce();
		expect(cb.onClose).toHaveBeenCalled();
	});

	it('c) existing membership: status badge and Open person seeded from the register record', async () => {
		sdk.organizationadminuserlookupLookupUser.mockResolvedValue(
			found({ membership_status: 'paused', register_record_id: 'r1' })
		);
		sdk.organizationadminmemberregisterGetMemberRegisterRecord.mockResolvedValue({
			data: rec('r1'),
			response: { status: 200 }
		});
		const { user } = setup();
		await lookup(user);
		expect(await screen.findByTestId('by-account-has-membership')).toBeInTheDocument();
		expect(screen.getByTestId('status-badge')).toHaveTextContent('Paused');
		await user.click(await screen.findByRole('button', { name: 'Open person' }));
		expect(cb.onOpenPerson).toHaveBeenCalledWith(expect.objectContaining({ id: 'r1' }));
		expect(cb.onClose).toHaveBeenCalled();
	});

	it('c) existing membership without any register entry: status only, no Open button', async () => {
		sdk.organizationadminuserlookupLookupUser.mockResolvedValue(
			found({ membership_status: 'banned' })
		);
		sdk.organizationadminmemberregisterListMemberRegister.mockResolvedValue({
			data: { count: 0, results: [] },
			response: { status: 200 }
		});
		const { user } = setup();
		await lookup(user);
		expect(await screen.findByTestId('by-account-has-membership')).toBeInTheDocument();
		expect(screen.getByTestId('status-badge')).toHaveTextContent('Banned');
		expect(screen.queryByRole('button', { name: 'Open person' })).not.toBeInTheDocument();
	});

	it('shows the typed email when the account has no display name', async () => {
		sdk.organizationadminuserlookupLookupUser.mockResolvedValue(found({ display_name: '' }));
		const { user } = setup();
		await lookup(user);
		expect(await screen.findByTestId('by-account-found')).toHaveTextContent(
			'Account found: ada@example.org'
		);
	});

	it('d) adds with the only tier preselected, invalidates, toasts and opens the sheet', async () => {
		sdk.organizationadminuserlookupLookupUser.mockResolvedValue(found());
		sdk.organizationadminmembersAddMember.mockResolvedValue({
			data: {},
			response: { status: 201 }
		});
		sdk.organizationadminmemberregisterListMemberRegister.mockResolvedValue({
			data: { count: 1, results: [rec('r9')] },
			response: { status: 200 }
		});
		const { user, invalidate } = setup();
		await lookup(user);
		await screen.findByTestId('by-account-found');
		expect(screen.getByLabelText('Tier')).toHaveValue('t1');
		await user.click(screen.getByRole('button', { name: 'Add as member' }));
		await waitFor(() => expect(cb.onOpenPerson).toHaveBeenCalled());
		expect(sdk.organizationadminmembersAddMember).toHaveBeenCalledWith(
			expect.objectContaining({ path: { slug: 'acme', user_id: 'u1' }, body: { tier_id: 't1' } })
		);
		const keys = invalidate.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));
		expect(keys).toContain(JSON.stringify(['organization', 'acme', 'members']));
		expect(keys).toContain(
			JSON.stringify(['organization', 'acme', 'register-possible-duplicates'])
		);
		expect(keys).toContain(JSON.stringify(['organization', 'acme', 'member']));
		expect(toast.success).toHaveBeenCalled();
		expect(cb.onOpenPerson).toHaveBeenCalledWith(expect.objectContaining({ id: 'r9' }));
		expect(cb.onClose).toHaveBeenCalled();
	});

	it('d) with several tiers the admin must choose', async () => {
		sdk.organizationadminuserlookupLookupUser.mockResolvedValue(found());
		const { user } = setup([tier('t1', 'Full'), tier('t2', 'Student')]);
		await lookup(user);
		await screen.findByTestId('by-account-found');
		expect(screen.getByRole('button', { name: 'Add as member' })).toBeDisabled();
		await user.selectOptions(screen.getByLabelText('Tier'), 't2');
		expect(screen.getByRole('button', { name: 'Add as member' })).toBeEnabled();
	});

	it('d) AlreadyMember race re-runs the lookup and shows the membership', async () => {
		sdk.organizationadminuserlookupLookupUser
			.mockResolvedValueOnce(found())
			.mockResolvedValueOnce(
				found({ membership_status: 'active', is_member: true, register_record_id: 'r1' })
			);
		sdk.organizationadminmembersAddMember.mockResolvedValue({
			error: { detail: 'already', code: 'already_member' },
			response: { status: 400 }
		});
		sdk.organizationadminmemberregisterGetMemberRegisterRecord.mockResolvedValue({
			data: rec('r1'),
			response: { status: 200 }
		});
		const { user } = setup();
		await lookup(user);
		await screen.findByTestId('by-account-found');
		await user.click(screen.getByRole('button', { name: 'Add as member' }));
		expect(await screen.findByTestId('by-account-has-membership')).toBeInTheDocument();
		expect(sdk.organizationadminuserlookupLookupUser).toHaveBeenCalledTimes(2);
		expect(cb.onOpenPerson).not.toHaveBeenCalled();
	});

	it('d) a plain 400 (not already_member) shows the refusal without a second lookup', async () => {
		sdk.organizationadminuserlookupLookupUser.mockResolvedValue(found());
		sdk.organizationadminmembersAddMember.mockResolvedValue({
			error: { detail: 'Tier is not available.' },
			response: { status: 400 }
		});
		const { user } = setup();
		await lookup(user);
		await screen.findByTestId('by-account-found');
		await user.click(screen.getByRole('button', { name: 'Add as member' }));
		expect(await screen.findByTestId('register-error')).toHaveTextContent('Tier is not available.');
		expect(sdk.organizationadminuserlookupLookupUser).toHaveBeenCalledTimes(1);
		expect(cb.onClose).not.toHaveBeenCalled();
	});

	it('d) already_member whose re-lookup still says addable shows the refusal', async () => {
		sdk.organizationadminuserlookupLookupUser.mockResolvedValue(found());
		sdk.organizationadminmembersAddMember.mockResolvedValue({
			error: { detail: 'You are already a member of this organization.', code: 'already_member' },
			response: { status: 400 }
		});
		const { user } = setup();
		await lookup(user);
		await screen.findByTestId('by-account-found');
		await user.click(screen.getByRole('button', { name: 'Add as member' }));
		await waitFor(() => expect(sdk.organizationadminuserlookupLookupUser).toHaveBeenCalledTimes(2));
		expect(await screen.findByTestId('register-error')).toBeInTheDocument();
		expect(cb.onClose).not.toHaveBeenCalled();
	});

	it('d) a failed refresh after a successful add still reports success', async () => {
		sdk.organizationadminuserlookupLookupUser.mockResolvedValue(found());
		sdk.organizationadminmembersAddMember.mockResolvedValue({
			data: {},
			response: { status: 201 }
		});
		sdk.organizationadminmemberregisterListMemberRegister.mockResolvedValue({
			error: { detail: 'boom' },
			response: { status: 500 }
		});
		const { user } = setup();
		await lookup(user);
		await screen.findByTestId('by-account-found');
		await user.click(screen.getByRole('button', { name: 'Add as member' }));
		await waitFor(() => expect(toast.success).toHaveBeenCalled());
		expect(cb.onClose).toHaveBeenCalled();
		expect(cb.onOpenPerson).not.toHaveBeenCalled();
		expect(screen.queryByTestId('register-error')).toBeNull();
	});

	it('e) 429 shows the wait and disables the submit', async () => {
		sdk.organizationadminuserlookupLookupUser.mockResolvedValue({
			error: { detail: 'throttled' },
			response: { status: 429, headers: new Headers({ 'Retry-After': '1200' }) }
		});
		const { user } = setup();
		await lookup(user);
		expect(await screen.findByRole('alert')).toHaveTextContent(/Too many lookups.*20 minutes/);
		expect(await screen.findByRole('button', { name: 'Find account' })).toBeDisabled();
	});

	it('e) a stale 429 (email edited meanwhile) shows nothing but still locks Find', async () => {
		let settle: (value: unknown) => void = () => undefined;
		sdk.organizationadminuserlookupLookupUser.mockReturnValue(
			new Promise((resolve) => {
				settle = resolve;
			})
		);
		const { user } = setup();
		await lookup(user);
		await user.type(screen.getByLabelText('Account email'), 'x');
		settle({
			error: { detail: 'throttled' },
			response: { status: 429, headers: new Headers({ 'Retry-After': '1200' }) }
		});
		await waitFor(() =>
			expect(screen.getByRole('button', { name: 'Find account' })).toBeDisabled()
		);
		expect(screen.queryByRole('alert')).toBeNull();
	});

	it('e) another error shows a generic message and allows retry', async () => {
		sdk.organizationadminuserlookupLookupUser.mockResolvedValue({
			error: { detail: 'boom' },
			response: { status: 500 }
		});
		const { user } = setup();
		await lookup(user);
		expect(await screen.findByRole('alert')).toBeInTheDocument();
		expect(await screen.findByRole('button', { name: 'Find account' })).toBeEnabled();
	});

	it('changing the email clears the previous result', async () => {
		sdk.organizationadminuserlookupLookupUser.mockResolvedValue(notFound);
		const { user } = setup();
		await lookup(user);
		await screen.findByTestId('by-account-not-found');
		await user.type(screen.getByLabelText('Account email'), 'x');
		expect(screen.queryByTestId('by-account-not-found')).not.toBeInTheDocument();
	});

	it('a seed failure keeps the already-has-membership state, without the Open button', async () => {
		sdk.organizationadminuserlookupLookupUser.mockResolvedValue(
			found({ membership_status: 'active', is_member: true, register_record_id: 'r1' })
		);
		sdk.organizationadminmemberregisterGetMemberRegisterRecord.mockResolvedValue({
			error: { detail: 'boom' },
			response: { status: 500 }
		});
		const { user } = setup();
		await lookup(user);
		expect(await screen.findByTestId('by-account-has-membership')).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Open person' })).not.toBeInTheDocument();
		expect(screen.queryByTestId('register-error')).toBeNull();
	});

	it('a failed 400 re-lookup does not resurrect the refusal on a later manual Find', async () => {
		sdk.organizationadminuserlookupLookupUser
			.mockResolvedValueOnce(found())
			.mockResolvedValueOnce({ error: { detail: 'boom' }, response: { status: 500 } })
			.mockResolvedValueOnce(found());
		sdk.organizationadminmembersAddMember.mockResolvedValue({
			error: { detail: 'Tier is not available.', code: 'already_member' },
			response: { status: 400 }
		});
		const { user } = setup();
		await lookup(user);
		await screen.findByTestId('by-account-found');
		await user.click(screen.getByRole('button', { name: 'Add as member' }));
		await waitFor(() => expect(sdk.organizationadminuserlookupLookupUser).toHaveBeenCalledTimes(2));
		await screen.findByRole('alert');
		await user.click(screen.getByRole('button', { name: 'Find account' }));
		await screen.findByTestId('by-account-found');
		await waitFor(() => expect(sdk.organizationadminuserlookupLookupUser).toHaveBeenCalledTimes(3));
		expect(screen.queryByTestId('register-error')).toBeNull();
		expect(screen.queryByRole('alert')).toBeNull();
	});

	it('disables Add as member while the 400 re-lookup is in flight', async () => {
		let resolveSecond: (v: unknown) => void = () => undefined;
		sdk.organizationadminuserlookupLookupUser
			.mockResolvedValueOnce(found())
			.mockReturnValueOnce(new Promise((r) => (resolveSecond = r)));
		sdk.organizationadminmembersAddMember.mockResolvedValue({
			error: { detail: 'nope', code: 'already_member' },
			response: { status: 400 }
		});
		const { user } = setup();
		await lookup(user);
		await screen.findByTestId('by-account-found');
		await waitFor(() =>
			expect(screen.getByRole('button', { name: 'Add as member' })).toBeEnabled()
		);
		await user.click(screen.getByRole('button', { name: 'Add as member' }));
		await waitFor(() => expect(sdk.organizationadminuserlookupLookupUser).toHaveBeenCalledTimes(2));
		expect(screen.getByRole('button', { name: 'Add as member' })).toBeDisabled();
		resolveSecond(found());
		await waitFor(() =>
			expect(screen.getByRole('button', { name: 'Add as member' })).toBeEnabled()
		);
	});

	it('keeps the 429 lockout across close and reopen', async () => {
		sdk.organizationadminuserlookupLookupUser.mockResolvedValue({
			error: { detail: 'throttled' },
			response: { status: 429, headers: new Headers({ 'Retry-After': '1200' }) }
		});
		const { user, view } = setup();
		await lookup(user);
		await screen.findByRole('alert');
		view.unmount();
		const second = setup();
		expect(screen.getByRole('button', { name: 'Find account' })).toBeDisabled();
		second.view.unmount();
	});

	it('explains a missing standard tier and offers Go to Tiers', async () => {
		sdk.organizationadminuserlookupLookupUser.mockResolvedValue(found());
		const { user } = setup([]);
		await lookup(user);
		expect(await screen.findByTestId('by-account-no-tiers')).toHaveTextContent(
			'Create a standard membership tier first'
		);
		expect(screen.queryByRole('button', { name: 'Add as member' })).toBeNull();
		await user.click(screen.getByRole('button', { name: 'Go to Tiers' }));
		expect(cb.onClose).toHaveBeenCalled();
		expect(cb.onOpenTiers).toHaveBeenCalledOnce();
	});
});
