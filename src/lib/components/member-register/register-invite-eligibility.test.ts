import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import type { MembershipRecordSchema, MembershipTierSchema } from '$lib/api/generated/types.gen';

const sdk = vi.hoisted(() => ({
	organizationadminmemberregisterCreateMemberRegisterRecord: vi.fn(),
	organizationadminmemberregisterlinkingInviteMemberRegisterRecord: vi.fn()
}));
vi.mock('$lib/api', () => sdk);
vi.mock('$lib/api/client', () => ({ client: {} }));

const toast = vi.hoisted(() => ({ success: vi.fn(), info: vi.fn(), error: vi.fn() }));
vi.mock('svelte-sonner', () => ({ toast }));

import RecordFormDialog from './RecordFormDialog.svelte';
import RegisterRowActions from './RegisterRowActions.svelte';

const tiers: MembershipTierSchema[] = [{ id: 'tier-1', name: 'Full', kind: 'standard' }];

function record(extra: Partial<MembershipRecordSchema> = {}): MembershipRecordSchema {
	return {
		id: 'r1',
		full_name: 'Ada Lovelace',
		email: 'ada@example.org',
		tier_name: 'Full',
		tier_id: 'tier-1',
		kind: 'standard',
		source: 'manual',
		valid_from: '2026-01-10T09:30:00Z',
		valid_until: null,
		created_at: '2026-01-10T09:30:00Z',
		has_account: false,
		invite_status: 'not_invited',
		can_invite: true,
		invite_blocked_reason: null,
		has_duplicate_claim: false,
		...extra
	};
}

function renderIn(component: unknown, componentProps: Record<string, unknown>) {
	render(QueryClientTestWrapper, {
		props: {
			client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
			component: component as never,
			componentProps
		}
	});
}

beforeEach(() => {
	for (const fn of Object.values(sdk)) fn.mockReset();
	for (const fn of Object.values(toast)) fn.mockReset();
});
afterEach(() => {
	document.body.style.pointerEvents = '';
});

const formProps = {
	open: true,
	record: null,
	slug: 'acme',
	accessToken: 'tok',
	tiers,
	onClose: vi.fn()
};
const inviteCheckbox = () => screen.queryByLabelText('Send an invite');

describe('"Send an invite" on create', () => {
	async function fill(email: string, from: string, until = '') {
		await userEvent.type(screen.getByLabelText(/full name/i), 'Ada Lovelace');
		if (email) await userEvent.type(screen.getByLabelText(/^email/i), email);
		await userEvent.selectOptions(screen.getByLabelText(/^tier$/i), 'tier-1');
		await userEvent.type(screen.getByLabelText(/valid from/i), from);
		if (until) await userEvent.type(screen.getByLabelText(/valid until/i), until);
	}

	it('is offered for an entry that is invitable right away', async () => {
		renderIn(RecordFormDialog, formProps);
		await fill('ada@example.org', '2026-01-10T09:30');
		expect(inviteCheckbox()).toBeInTheDocument();
	});

	it('is hidden without an email, for a future start, and for an end already past', async () => {
		renderIn(RecordFormDialog, formProps);
		await fill('', '2026-01-10T09:30');
		expect(inviteCheckbox()).not.toBeInTheDocument();
		await userEvent.type(screen.getByLabelText(/^email/i), 'ada@example.org');
		expect(inviteCheckbox()).toBeInTheDocument();

		await userEvent.type(screen.getByLabelText(/valid until/i), '2026-02-01T09:30');
		expect(inviteCheckbox()).not.toBeInTheDocument();
	});

	it('is hidden for a future start', async () => {
		renderIn(RecordFormDialog, formProps);
		await fill('ada@example.org', '2099-01-10T09:30');
		expect(inviteCheckbox()).not.toBeInTheDocument();
	});

	it('shows the backend reason when the invite after create is refused', async () => {
		sdk.organizationadminmemberregisterCreateMemberRegisterRecord.mockResolvedValue({
			data: record()
		});
		sdk.organizationadminmemberregisterlinkingInviteMemberRegisterRecord.mockResolvedValue({
			error: { detail: 'This address already belongs to another member.' },
			response: { status: 400 }
		});
		renderIn(RecordFormDialog, formProps);
		await fill('ada@example.org', '2026-01-10T09:30');
		await userEvent.click(screen.getByLabelText('Send an invite'));
		await userEvent.click(screen.getByRole('button', { name: /^add entry$/i }));
		await waitFor(() => expect(toast.error).toHaveBeenCalled());
		expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/invite wasn't sent/i), {
			description: 'This address already belongs to another member.'
		});
	});
});

describe('"Manage access" row action', () => {
	async function items(rec: MembershipRecordSchema): Promise<string[]> {
		renderIn(RegisterRowActions, {
			record: rec,
			isOwner: false,
			onEdit: vi.fn(),
			onEnd: vi.fn(),
			onDelete: vi.fn(),
			onInvite: vi.fn(),
			onUnlink: vi.fn(),
			onManageAccess: vi.fn()
		});
		screen.getByTestId('register-row-actions').focus();
		await userEvent.keyboard('{Enter}');
		await waitFor(() =>
			expect(screen.queryAllByRole('menuitem', { hidden: true }).length).toBeGreaterThan(0)
		);
		return screen
			.queryAllByRole('menuitem', { hidden: true })
			.map((el) => el.textContent?.trim() ?? '');
	}
	const linked = { user_id: 'u1', has_account: true, invite_status: 'linked' as const };

	it('is offered on a linked, current standard entry', async () => {
		expect(await items(record(linked))).toContain('Manage access');
	});

	it('is also offered while a future end date has not passed yet', async () => {
		expect(await items(record({ ...linked, valid_until: '2099-01-01T00:00:00Z' }))).toContain(
			'Manage access'
		);
	});

	it('is not offered on an ended linked entry', async () => {
		expect(await items(record({ ...linked, valid_until: '2026-02-01T00:00:00Z' }))).not.toContain(
			'Manage access'
		);
	});

	it('is not offered on an unlinked entry or a day membership', async () => {
		expect(await items(record())).not.toContain('Manage access');
	});
});
